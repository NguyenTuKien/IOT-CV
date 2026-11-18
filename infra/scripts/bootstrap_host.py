#!/usr/bin/env python3
"""Provision an EC2 over verified SSH; registration credential travels only via stdin."""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True)
    parser.add_argument("--key", type=Path, required=True)
    parser.add_argument("--known-hosts", type=Path, required=True)
    parser.add_argument("--volume-id", required=True)
    args = parser.parse_args()
    try:
        # Chỉ dùng giá trị ĐÃ chuẩn hoá cho lệnh ssh (chặn chèn tham số qua
        # --host/--key/--volume-id).
        host = str(ipaddress.IPv4Address(args.host))
        volume = re.fullmatch(r"vol-[0-9a-f]+", args.volume_id)
        if volume is None:
            raise ValueError("Invalid data volume ID")
        volume_id = volume.group(0)
        key, known_hosts = args.key.resolve(strict=True), args.known_hosts.resolve(strict=True)
        if not (key.is_file() and known_hosts.is_file()):
            raise ValueError("SSH key/known_hosts must be files")
        response = subprocess.run(
            ["gh", "api", "--method", "POST",
             "repos/ngtukien/IOT-CV/actions/runners/registration-token"],
            capture_output=True, text=True, check=True,
        )
        token = json.loads(response.stdout)["token"]
        payload = json.dumps({
            "script": Path(__file__).with_name("provision.sh").read_text(),
            "env": {"DATA_VOLUME_ID": volume_id, "ACTIONS_RUNNER_INPUT_TOKEN": token},
        })
        remote = (
            "sudo -n python3 -c 'import json,os,subprocess,sys; "
            "d=json.load(sys.stdin); e=os.environ.copy(); e.update(d[\"env\"]); "
            "r=subprocess.run([\"bash\",\"-s\"],input=d[\"script\"],text=True,env=e); "
            "sys.exit(r.returncode)'"
        )
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
             "-o", "UpdateHostKeys=no", "-o", "ControlMaster=no",
             "-o", "UserKnownHostsFile=" + str(known_hosts),
             "-i", str(key), "--", "ubuntu@" + host, remote],
            input=payload, text=True, env=os.environ.copy(),
        )
        return result.returncode
    except Exception:
        # Never render gh responses, token payloads or subprocess input on error.
        print("Host bootstrap failed; inspect non-secret SSH/provision output.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
