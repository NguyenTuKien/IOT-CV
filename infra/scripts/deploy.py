#!/usr/bin/env python3
"""Deploy/rollback immutable Compose releases on the dedicated EC2 runner."""

from __future__ import annotations

import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path("/srv/iotcv")
TOKEN_PATH = Path("/etc/iotcv/secrets/tunnel_token")
SOURCE = Path(__file__).resolve().parents[1]


def image_ref(value: str, repository: str) -> str:
    pattern = re.escape(repository) + r"@sha256:[0-9a-f]{64}"
    if not re.fullmatch(pattern, value) or value.endswith("0" * 64):
        raise ValueError("Expected an immutable image digest in the configured repository")
    return value


def release_sha(value: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("Expected a full commit SHA")
    return value


def current_release(link: Path, root: Path = ROOT) -> Path | None:
    if not link.is_symlink():
        if link.exists():
            raise RuntimeError("Refusing to overwrite an unmanaged current-release path")
        return None
    target = link.resolve(strict=True)
    if target.parent != (root / "releases").resolve():
        raise RuntimeError("Release link escaped the managed releases directory")
    release_sha(target.name)
    marker = json.loads((target / ".iotcv-release.json").read_text())
    if marker.get("sha") != target.name:
        raise RuntimeError("Release ownership marker does not match")
    return target


def atomic_link(link: Path, target: Path) -> None:
    temporary = link.with_name("." + link.name + "-" + uuid.uuid4().hex)
    temporary.symlink_to(target)
    os.replace(temporary, link)


def write_secret(value: str) -> None:
    if not value.strip():
        raise ValueError("CLOUDFLARE_TUNNEL_TOKEN must be supplied by GitHub Secrets")
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.parent.chmod(0o700)
    fd, name = tempfile.mkstemp(prefix=".tunnel-", dir=TOKEN_PATH.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(value.strip() + "\n")
        os.chmod(name, 0o400)
        os.chown(name, 65532, 65532)
        os.replace(name, TOKEN_PATH)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def compose(target: Path, environment: str, docker_env: dict) -> list[str]:
    return [
        "docker", "compose", "--project-name", "iotcv-" + environment,
        "--project-directory", str(target), "--file", str(target / "docker-compose.prod.yml"),
        "--env-file", str(target / ".env"), "--profile", "tunnel",
    ]


def start_and_verify(target: Path, environment: str, hostname: str, docker_env: dict) -> None:
    command = compose(target, environment, docker_env)
    subprocess.run(
        command + ["up", "--detach", "--pull", "always", "--wait", "--wait-timeout", "180"],
        env=docker_env, check=True,
    )
    subprocess.run(
        command + ["exec", "-T", "iotcv", "python", "/usr/local/bin/iotcv-verify.py",
                   "--demo", "--tunnel", "--assets-dir", "/app/frontend/dist/assets"],
        env=docker_env, check=True,
    )
    subprocess.run(
        [sys.executable, "-B", str(target / "scripts/verify.py"), "--demo",
         "--base-url", "https://" + hostname],
        env=docker_env, check=True,
    )


def deploy() -> dict:
    if os.geteuid() != 0:
        raise RuntimeError("Deployment requires the dedicated runner's sudo context")
    environment = os.environ.get("ENVIRONMENT", "demo")
    hostname = os.environ.get("PUBLIC_HOSTNAME", "uav.ngtukien.id.vn")
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,19}", environment):
        raise ValueError("Invalid deployment environment")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]+[a-z0-9]", hostname):
        raise ValueError("Invalid public hostname")
    operation = os.environ.get("DEPLOY_OPERATION", "deploy")
    if operation not in ("deploy", "rollback"):
        raise ValueError("Invalid deployment operation")
    if not os.path.ismount(ROOT / "data"):
        raise RuntimeError("Retained data disk is not mounted; refusing ephemeral storage")
    expected_volume = os.environ.get("DATA_VOLUME_ID", "")
    marker = (ROOT / "data/.iotcv-data-volume").read_text().strip()
    if not expected_volume or marker != expected_volume:
        raise RuntimeError("Data disk identity does not match Terraform output")

    ROOT.joinpath("releases").mkdir(parents=True, exist_ok=True)
    old = current_release(ROOT / "current")
    write_secret(os.environ.get("CLOUDFLARE_TUNNEL_TOKEN", ""))
    app_repository = os.environ.get("REGISTRY_IMAGE", "ghcr.io/ngtukien/iot-cv")
    tunnel_repository = os.environ.get("TUNNEL_REGISTRY_IMAGE", app_repository + "-tunnel")
    if operation == "rollback":
        requested = os.environ.get("ROLLBACK_SHA", "")
        if requested:
            target = ROOT / "releases" / release_sha(requested)
            manifest = json.loads((target / ".iotcv-release.json").read_text())
            if manifest.get("sha") != target.name:
                raise RuntimeError("Unmanaged rollback release")
        else:
            target = current_release(ROOT / "previous")
            if target is None:
                raise RuntimeError("No previous release is available")
        manifest = json.loads((target / ".iotcv-release.json").read_text())
        image_ref(manifest["application_image"], app_repository)
        image_ref(manifest["tunnel_image"], tunnel_repository)
    else:
        sha = release_sha(os.environ.get("RELEASE_SHA", ""))
        app_image = image_ref(os.environ.get("IOTCV_IMAGE", ""), app_repository)
        tunnel_image = image_ref(os.environ.get("CLOUDFLARED_IMAGE", ""), tunnel_repository)
        target = ROOT / "releases" / sha
        manifest = {"sha": sha, "application_image": app_image, "tunnel_image": tunnel_image}
        existing = target / ".iotcv-release.json"
        if existing.exists() and json.loads(existing.read_text()) != manifest:
            raise RuntimeError("Refusing to overwrite an immutable release")
        target.mkdir(parents=True, exist_ok=True)
        for folder in ("docker", "scripts"):
            target.joinpath(folder).mkdir(exist_ok=True)
        for relative in ("docker-compose.prod.yml", "docker/mosquitto.conf", "scripts/verify.py"):
            shutil.copyfile(SOURCE / relative, target / relative)
        settings = {
            "ENVIRONMENT": environment, "PUBLIC_HOSTNAME": hostname,
            "IOTCV_IMAGE": app_image, "CLOUDFLARED_IMAGE": tunnel_image,
            "IOTCV_DATA_DIR": str(ROOT / "data"), "CLOUDFLARED_TOKEN_FILE": str(TOKEN_PATH),
            "TELEMETRY_AUTOSTART": "0", "MAVLINK_ENDPOINT": "",
            "CAMERA_FAKE": "1", "VISION_ENABLED": "1", "RECORD_VIDEO": "0",
        }
        # This file contains only public settings and a token FILE PATH.
        env_text = "".join(key + "=" + value + "\n" for key, value in settings.items())
        (target / ".env").write_text(env_text)
        (target / ".env").chmod(0o640)
        existing.write_text(json.dumps(manifest, indent=2) + "\n")

    with tempfile.TemporaryDirectory(prefix="iotcv-docker-auth-", dir="/run") as auth:
        docker_env = {**os.environ, "DOCKER_CONFIG": auth}
        password = os.environ.get("REGISTRY_PASSWORD", "")
        if password:
            login = subprocess.run(
                ["docker", "login", "ghcr.io", "--username", os.environ["REGISTRY_USERNAME"],
                 "--password-stdin"], input=password, text=True, env=docker_env,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )
            if login.returncode:
                raise RuntimeError("Registry authentication failed")
        try:
            start_and_verify(target, environment, hostname, docker_env)
        except Exception:
            if old is not None and old != target:
                start_and_verify(old, environment, hostname, docker_env)
                print("Previous healthy release restored.", file=sys.stderr)
            raise
    if old is not None and old != target:
        atomic_link(ROOT / "previous", old)
    atomic_link(ROOT / "current", target)
    return {"operation": operation, "release": target.name, "url": "https://" + hostname}


def main() -> int:
    try:
        # Khoá nằm trong ROOT (root sở hữu, không ai khác ghi được), không ở /run/lock dùng chung.
        ROOT.mkdir(mode=0o755, parents=True, exist_ok=True)
        with open(ROOT / ".deploy.lock", "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = deploy()
        print(json.dumps(result))
        return 0
    except Exception:
        # Do not render exceptions which may include credentials from an SDK/CLI.
        print("Deployment failed; see non-secret Compose/probe output.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
