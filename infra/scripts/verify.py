#!/usr/bin/env python3
"""Read-only deployment probes; never sends a drone-control command."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import websockets


def fetch(url: str) -> tuple[int, str, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": "iotcv-deployment-probe"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, response.headers.get_content_type(), response.read(8_000_000)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get_content_type(), exc.read(4096)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def video_frame(base: str) -> dict:
    with urllib.request.urlopen(base + "/api/video/stream", timeout=10) as response:
        require(response.status == 200, "Raw MJPEG stream is unavailable")
        buffer = b""
        while b"\r\n\r\n" not in buffer:
            buffer += response.read(512)
            require(0 < len(buffer) < 8192, "Invalid MJPEG part headers")
        header, jpeg = buffer.split(b"\r\n\r\n", 1)
        match = re.search(rb"Content-Length:\s*(\d+)", header, re.IGNORECASE)
        require(match is not None, "MJPEG has no Content-Length")
        length = int(match.group(1))
        require(0 < length <= 5 * 1024 * 1024, "Invalid JPEG size")
        while len(jpeg) < length:
            chunk = response.read(length - len(jpeg))
            require(bool(chunk), "MJPEG ended before the first frame")
            jpeg += chunk
        require(
            jpeg[:2] == b"\xff\xd8" and jpeg[length - 2 : length] == b"\xff\xd9",
            "Invalid JPEG",
        )
        return {"jpeg_bytes": length}


async def websocket_probe(base: str, demo: bool) -> list[str]:
    parts = urllib.parse.urlsplit(base)
    scheme = "wss" if parts.scheme == "https" else "ws"
    uri = urllib.parse.urlunsplit((scheme, parts.netloc, "/ws", "", ""))
    received: set[str] = set()
    async with asyncio.timeout(15):
        async with websockets.connect(uri, open_timeout=10) as socket:
            await socket.send(json.dumps({"v": 1, "type": "ping", "data": {}}))
            while not {"status", "telemetry", "pong"}.issubset(received):
                frame = json.loads(await socket.recv())
                require(frame.get("v") == 1, "WebSocket contract version changed")
                received.add(frame.get("type", ""))
                if demo and frame.get("type") in ("status", "telemetry"):
                    require(frame["data"].get("connected") is False, "Demo connected to MAVLink")
    return sorted(received)


def run_checks(base: str, assets: Path | None, demo: bool, tunnel: bool) -> dict:
    parts = urllib.parse.urlsplit(base)
    require(parts.scheme in ("http", "https") and bool(parts.hostname), "Invalid probe URL")
    require(
        parts.username is None and parts.password is None,
        "Credentials must not appear in URLs",
    )
    base = base.rstrip("/")
    code, _, body = fetch(base + "/api/health")
    require(code == 200 and json.loads(body).get("status") == "ok", "Health endpoint failed")
    code, _, body = fetch(base + "/api/status")
    require(code == 200, "Status endpoint failed")
    status = json.loads(body)
    if demo:
        require(status.get("connected") is False, "Demo must remain disconnected from MAVLink")
        require(status.get("camera", {}).get("fake") is True, "Demo must use fake camera")
        limits = status["limits"]
        expected = {
            "min_alt": 2, "max_alt": 10, "max_distance_home": 50,
            "max_velocity": 1, "manual_command_timeout_ms": 300, "deadman_tick_ms": 50,
        }
        require(
            all(limits.get(key) == value for key, value in expected.items()),
            "Demo limits changed",
        )
    routes = ["/", "/mission", "/vision", "/flights", "/system"]
    for route in routes:
        code, content_type, _ = fetch(base + route)
        require(code == 200 and content_type == "text/html", "SPA route failed: " + route)
    for route in ("/api/definitely-not-an-endpoint", "/assets/definitely-missing.js"):
        code, _, _ = fetch(base + route)
        require(code == 404, "SPA fallback hid a missing endpoint/asset")
    checked_assets = 0
    if assets is not None:
        files = sorted(
            path for path in assets.rglob("*") if path.is_file() and path.suffix != ".map"
        )
        require(bool(files), "Built frontend assets are missing")
        for path in files:
            url = base + "/assets/" + urllib.parse.quote(path.relative_to(assets).as_posix())
            code, _, data = fetch(url)
            require(code == 200 and bool(data), "Static asset failed: " + path.name)
            checked_assets += 1
    frame = video_frame(base)
    ws_types = asyncio.run(websocket_probe(base, demo))
    if tunnel:
        code, _, _ = fetch("http://cloudflared:2000/ready")
        require(code == 200, "Tunnel has no ready edge connection")
    return {
        "health": "ok", "connected": status.get("connected"), "spa_routes": routes,
        "static_assets_checked": checked_assets, "websocket_types": ws_types, **frame,
        "tunnel_ready_checked": tunnel,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--assets-dir", type=Path)
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--tunnel", action="store_true")
    args = parser.parse_args()
    try:
        result = run_checks(args.base_url, args.assets_dir, args.demo, args.tunnel)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        print("Deployment verification failed: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
