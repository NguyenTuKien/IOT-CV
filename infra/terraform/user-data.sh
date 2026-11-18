#!/bin/bash
set -euo pipefail

# Only PUBLIC host-key material is emitted to the authenticated EC2 console.
# The controller uses it instead of blindly trusting ssh-keyscan.
ssh-keygen -A
printf '\nIOTCV_SSH_PUBLIC_KEY_BEGIN\n'
cut -d ' ' -f 1,2 /etc/ssh/ssh_host_ed25519_key.pub
printf 'IOTCV_SSH_PUBLIC_KEY_END\n'
