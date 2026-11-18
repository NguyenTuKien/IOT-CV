#!/bin/bash
# Bootstrap the dedicated Ubuntu EC2 only. No tunnel token is accepted here.
set -euo pipefail
[[ "$EUID" == 0 ]] || { printf 'Run provision as root.\n' >&2; exit 1; }
: "${DATA_VOLUME_ID:?Supply the Terraform data volume ID}"
[[ "$DATA_VOLUME_ID" =~ ^vol-[0-9a-f]+$ ]] || exit 1
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq ca-certificates curl python3-venv python3-packaging \
  libicu74 libssl3t64 libkrb5-3 zlib1g libunwind8 sudo
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  https://download.docker.com/linux/ubuntu/gpg \
  --output /usr/share/keyrings/iotcv-docker.asc
cat > /etc/apt/sources.list.d/iotcv-docker.sources <<'REPO'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /usr/share/keyrings/iotcv-docker.asc
REPO
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
docker_changed=$(python3 - <<'PY'
import json
from pathlib import Path
path = Path('/etc/docker/daemon.json')
old = json.loads(path.read_text()) if path.exists() else {}
new = {**old, 'log-driver': 'json-file',
       'log-opts': {**old.get('log-opts', {}), 'max-size': '10m', 'max-file': '3'}}
if old != new:
    path.write_text(json.dumps(new) + '\n')
    print('yes')
else:
    print('no')
PY
)
systemctl enable --now docker
[[ "$docker_changed" == no ]] || systemctl restart docker

getent group iotcv >/dev/null || groupadd --gid 10001 iotcv
id iotcv >/dev/null 2>&1 || useradd --uid 10001 --gid 10001 -M -s /usr/sbin/nologin iotcv
getent group iotcv-runner >/dev/null || groupadd --gid 10002 iotcv-runner
id iotcv-runner >/dev/null 2>&1 || useradd --uid 10002 --gid 10002 -m -s /bin/bash iotcv-runner
usermod --append --groups docker iotcv-runner

# Match the EBS serial, never a guessed /dev/sdf or the OS disk.
device=$(python3 - <<'PY'
import json, os, subprocess
expected = os.environ['DATA_VOLUME_ID'].replace('-', '')
data = json.loads(subprocess.check_output(
    ['lsblk', '--json', '--output', 'PATH,SERIAL,FSTYPE,MOUNTPOINT'], text=True))
matches = [x for x in data['blockdevices'] if x.get('serial') == expected]
if len(matches) != 1 or matches[0].get('mountpoint') == '/':
    raise SystemExit('Refusing unidentified/root data disk')
if matches[0].get('fstype') not in (None, '', 'ext4'):
    raise SystemExit('Refusing incompatible existing filesystem')
print(matches[0]['path'])
PY
)
fs_type=$(blkid -s TYPE -o value "$device" || true)
[[ -n "$fs_type" ]] || mkfs.ext4 -q "$device"
uuid=$(blkid -s UUID -o value "$device")
install -d -m 0755 /srv/iotcv/data
export IOTCV_DATA_UUID="$uuid"
python3 - <<'PY'
import os
from pathlib import Path
path = Path('/etc/fstab')
text = path.read_text()
entry = 'UUID=' + os.environ['IOTCV_DATA_UUID'] + ' /srv/iotcv/data ext4 defaults,nofail 0 2'
existing = [x for x in text.splitlines() if x and not x.startswith('#')
            and len(x.split()) > 1 and x.split()[1] == '/srv/iotcv/data']
if existing and existing != [entry]:
    raise SystemExit('Refusing to replace an existing data mount')
if not existing:
    path.write_text(text.rstrip() + '\n' + entry + '\n')
PY
mountpoint -q /srv/iotcv/data || mount /srv/iotcv/data
printf '%s\n' "$DATA_VOLUME_ID" > /srv/iotcv/data/.iotcv-data-volume
install -d -m 0755 -o 10001 -g 10001 /srv/iotcv/data/logs /srv/iotcv/data/models
install -d -m 0755 -o 1883 -g 1883 /srv/iotcv/data/mosquitto
install -d -m 0750 -o 10002 -g 10002 /srv/iotcv/data/runner-work /opt/iotcv-runner
install -d -m 0700 /etc/iotcv/secrets

if [[ ! -x /opt/iotcv-runner/bin/Runner.Listener ]]; then
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-x64-2.338.2.tar.gz \
    --output /tmp/iotcv-runner-2.338.2.tar.gz
  printf '%s  %s\n' \
    baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40 \
    /tmp/iotcv-runner-2.338.2.tar.gz | sha256sum --check --status
  tar -xzf /tmp/iotcv-runner-2.338.2.tar.gz -C /opt/iotcv-runner
  chown -R 10002:10002 /opt/iotcv-runner
fi
if [[ ! -f /opt/iotcv-runner/.runner ]]; then
  : "${ACTIONS_RUNNER_INPUT_TOKEN:?Supply one-time registration token through environment}"
  (
    cd /opt/iotcv-runner
    sudo --user iotcv-runner --preserve-env=ACTIONS_RUNNER_INPUT_TOKEN \
      ./config.sh --unattended \
      --url https://github.com/ngtukien/IOT-CV --name iotcv-demo \
      --labels iotcv-demo --work /srv/iotcv/data/runner-work --disableupdate
  )
fi
printf 'iotcv-runner ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/iotcv-runner
chmod 0440 /etc/sudoers.d/iotcv-runner
visudo -cf /etc/sudoers.d/iotcv-runner
cat > /etc/systemd/system/iotcv-github-runner.service <<'UNIT'
[Unit]
Description=IOT-CV trusted-main GitHub deployment runner
After=network-online.target docker.service
Wants=network-online.target
RequiresMountsFor=/srv/iotcv/data
[Service]
User=iotcv-runner
WorkingDirectory=/opt/iotcv-runner
ExecStart=/opt/iotcv-runner/run.sh
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=90
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now iotcv-github-runner
printf 'Docker, retained data disk and deployment runner are ready.\n'
