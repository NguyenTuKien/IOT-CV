# infra — triển khai web IOT-CV lên AWS EC2

Bản demo công khai: `https://uav.ngtukien.id.vn`. Ở bản này backend chạy với `CAMERA_FAKE=1` và
`TELEMETRY_AUTOSTART=0`, nên **không nối drone thật**. Phase 15 (AI thật) không nằm trong phạm vi.

## Kiến trúc

```
push main (đổi backend/frontend/ml/models/deps)
  └─ .github/workflows/iotcv-deploy.yml
       ├─ checks  (gọi iotcv-ci.yml, GitHub-hosted): ruff+pytest, pnpm lint/test/typecheck/build,
       │           terraform fmt/validate, test script, docker compose config, build 2 image
       ├─ images  (GitHub-hosted): build + push ghcr.io/ngtukien/iot-cv và iot-cv-tunnel, tag = SHA
       ├─ terraform (TẮT mặc định, bật bằng vars.TERRAFORM_APPLY_ENABLED=1 khi SCP cho phép OIDC)
       └─ deploy  (self-hosted runner "iotcv-demo" chạy TRÊN EC2): infra/scripts/deploy.py
             → docker compose up theo digest → kiểm nội bộ → kiểm https://uav.ngtukien.id.vn
             → hỏng thì tự dựng lại bản cũ
```

Trên EC2 (Docker Compose, `infra/docker-compose.prod.yml`): `iotcv` (FastAPI + web tĩnh, cổng 8000
chỉ trong mạng nội bộ), `mosquitto`, `cloudflared`. **Không mở cổng web nào ra Internet.** Security
group chỉ cho SSH từ một IP; người dùng vào web qua Cloudflare Tunnel.

## Tài nguyên AWS (đã tạo 18/11/2026)

| | |
|---|---|
| Account / region | 648879824333 / ap-southeast-2 (Sydney) |
| EC2 | `i-0272cb5da31d0a5dc`, m7i-flex.large, Ubuntu 24.04 |
| Elastic IP | 3.104.216.212 |
| Security group | `sg-0afe574abb43d6008`, SSH chỉ từ 171.224.179.81/32 |
| Ổ dữ liệu | `vol-09f64d220897ea718`, 30 GiB, mã hoá, **giữ lại khi xoá EC2**, mount `/srv/iotcv/data` |
| Terraform state | S3 `iotcv-648879824333-ap-southeast-2-tfstate`, key `demo/ec2/terraform.tfstate` |

Terraform: `infra/terraform/bootstrap` (bucket state), `infra/terraform` (EC2, EIP, SG, ổ, IAM SSM),
`infra/terraform/oidc` (role GitHub OIDC, chưa dùng được vì SCP tổ chức chặn
`iam:*OpenIDConnectProvider*`). Lệnh mẫu: `backend.hcl.example`, `terraform.tfvars.example`.

## Cấu hình GitHub

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `CLOUDFLARE_TUNNEL_TOKEN` | token tunnel; **chỉ** nằm ở đây, deploy ghi ra `/etc/iotcv/secrets/tunnel_token` (0400) |
| Variable | `DATA_VOLUME_ID` | `vol-09f64d220897ea718` (deploy từ chối chạy nếu ổ mount sai) |
| Variable (tuỳ chọn) | `DEPLOY_ENABLED=0` | công tắc tắt toàn bộ pipeline |
| Variable (tuỳ chọn) | `TERRAFORM_APPLY_ENABLED=1` | bật job terraform (cần `AWS_ROLE_ARN` + biến `TF_*`) |
| Variable (tuỳ chọn) | `REGISTRY_IMAGE`, `TUNNEL_REGISTRY_IMAGE`, `PUBLIC_HOSTNAME`, `DEPLOY_ENVIRONMENT` | có mặc định trong workflow |

Cloudflare Zero Trust → Tunnel → Public hostname `uav.ngtukien.id.vn` phải trỏ tới
**`http://iotcv:8000`** (tên service trong Compose).

## Vận hành

- **Deploy tự động:** merge/push vào `main` có đổi mã ứng dụng.
- **Deploy tay / rollback:** Actions → *iotcv ec2 deployment* → Run workflow trên `main`,
  `operation=deploy` hoặc `rollback` (để trống `rollback_sha` = về bản ngay trước).
- **Release trên máy:** `/srv/iotcv/releases/<sha>/`, symlink `current` và `previous`.
- **SSH:** `ssh -i <khoá riêng> -o UserKnownHostsFile=<known_hosts đã xác minh> ubuntu@3.104.216.212`.
  Khoá nằm ngoài repo. Host key lấy từ console EC2 (`GetConsoleOutput`), không tin lần đầu.
- **Xem log:** `sudo docker compose -p iotcv-demo -f /srv/iotcv/current/docker-compose.prod.yml logs -f`.
- **Runner:** `systemctl status iotcv-github-runner` (chạy `/opt/iotcv-runner/run.sh` dưới user
  `iotcv-runner`, chỉ nhận job có nhãn `iotcv-demo`).

### Dựng lại máy từ đầu

```bash
terraform -chdir=infra/terraform apply ...           # tạo EC2/EIP/ổ
python3 infra/scripts/bootstrap_host.py --host <EIP> --key <khoá> \
  --known-hosts <known_hosts> --volume-id <vol-...>  # cài Docker, mount ổ, đăng ký runner
```

`provision.sh` chạy lại nhiều lần được: không format ổ đã có ext4, không đăng ký runner lần hai.

## Bẫy đã gặp

- Unit systemd của runner phải gọi `run.sh`. `runsvc.sh` chỉ được sinh khi chạy `svc.sh install`;
  gọi nó thì runner chết `203/EXEC` và GitHub báo runner offline (18/11/2026).
- Workflow chỉ chạy trên `main`; push nhánh khác không deploy.
- `infra/requirements.lock` sinh bằng
  `uv pip compile infra/requirements.in --generate-hashes --python-version 3.13 --python-platform x86_64-unknown-linux-gnu --only-binary :all: -o infra/requirements.lock`.
- Mỗi thư mục Terraform cần `.terraform.lock.hcl` riêng, vì CI chạy `init -lockfile=readonly`.
