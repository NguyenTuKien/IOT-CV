# 06 · Tiến trình thực hiện và cách làm việc

Dữ liệu cho slide "Quá trình thực hiện" và lời nói kèm. Viết theo bản FINAL của BRIEF: chỉ kể việc đã đạt.
Mỗi hàng có nguồn. Ngày theo định dạng dd/mm/2026.

Nguồn đã đọc: `git log` của `d:\Coding\IOT-CV` (nhánh `main`) và `D:\XLA` (nhánh `main`), `gh pr list --state merged`
ở hai repo, `plans/PROGRESS.md`, `plans/_phase-index.md`, `plans/reports/*`, memory dự án
(`C:\Users\Nghaiz\.claude\projects\d--Coding-IOT-CV\memory\*.md`), và 36 file phiên `*.jsonl` của hai thư mục
`d--Coding-IOT-CV` (31 file) và `d--Python-XLA` (5 file), đọc bằng script lọc dòng `type=user`, không đọc nguyên file.

Lưu ý nguồn phiên: file `*.jsonl` còn trên đĩa chỉ phủ từ 08/10 đến 26/11. Các phiên 21/09 đến 13/10 đã không còn file
(memory nhắc tới các mã phiên `43e57020`, `afef103b`, `b915656a` nhưng không có `.jsonl` tương ứng). Mốc giai đoạn
đầu vì vậy lấy từ git, PROGRESS và memory.

## (a) Mốc thời gian

| Giai đoạn | Ngày | Mốc đã đạt | Nguồn |
|---|---|---|---|
| Chuẩn bị | 17/08 | Tạo repo IOT-CV, dựng khung backend MAVLink, web GCS, firmware ESP32, CI lint/test | `git log` IOT-CV: 7 commit ngày 17/08 (`first commit` … `ci: thêm workflow lint/test`) |
| Chuẩn bị | 21/09 | Chốt thiết kế tổng thể (FastAPI + pymavlink, Vite + React 19, DroneBridge, SITL trên WSL2, Python 3.13) và kế hoạch 25 phase UAV; 6 báo cáo nghiên cứu cùng ngày | PR #10; `plans/reports/260921-brainstorm-thiet-ke-tong-the.md`, `260921-research-*.md` (6 file); `plans/_phase-index.md` |
| Cài công cụ PC | 21/09 | Phase 00 xong 13/13 cổng: Mission Planner 1.3.83, MAVProxy 1.8.74, STM32CubeProgrammer 2.23.0, PlatformIO 6.2.0, esptool 5.4.0, uv, pnpm, Docker, WSL Ubuntu 24.04; toolchain và cache dồn sang ổ D | `plans/PROGRESS.md` dòng 36 (ngày) và 58 (bảng phiên bản); PR #25 |
| Cài công cụ PC | 21/09 | Phase 01 tái cấu trúc repo: uv, Vite, mosquitto, CI 3 job | PR #26; `plans/PROGRESS.md` dòng 83 |
| Drone ảo SITL | 21/09 đến 22/09 | Phase 02 build ArduCopter 4.7.1 và chạy SITL trên WSL2; Phase 03 có 5 runner SITL tự động chạy thật | PR #27, #29; `plans/PROGRESS.md` dòng 147, 201 |
| Backend và web | 22/09 | Phase 05 lớp MAVLink bền + WebSocket hai chiều + hợp đồng WebSocket; Phase 06 điều khiển và dead-man 300 ms, nghiệm thu trên SITL thật | PR #28, #31; `plans/PROGRESS.md` dòng 396, 475 |
| Drone ảo SITL | 25/09 | Phase 04 nạp tham số dự án vào SITL, drone ảo tự phanh trước vật cản bằng TFmini Plus ảo | PR #32; `plans/PROGRESS.md` dòng 341 |
| Backend và web | 25/09 | Phase 07 đến 10: nạp + đọc lại mission, máy trạng thái an toàn, REST; web HUD, bản đồ sống, trình soạn mission, lái tay WASD, E2E dead-man | PR #33, #34, #35, #36; `plans/PROGRESS.md` dòng 547, 588, 632 |
| Nạp firmware | 25/09 | Phase 11 firmware ArduPilot custom build đã kiểm feature, bộ tham số `01-base.param`, `02-avoid-tfmini.param` | PR #37; `plans/PROGRESS.md` dòng 661 |
| Chuẩn bị (linh kiện) | 12/10 | Chốt danh sách linh kiện thật, camera ESP32-S3 N16R8 + OV3660; nạp DroneBridge v2.4.1 lên ESP32 cầu MAVLink; web GCS nhiều trang, bản đồ nhiều lớp, 3D three.js | `docs/phan-cung-thuc-te.md` dòng 9, 20; PR #38, #42 |
| Nạp firmware | 13/10 | Nạp ArduPilot 4.7.1 lên SpeedyBee F405 V5 hoàn toàn bằng script (`nap_dfu.py` → `kiem_fc.py` → `nap_param.py`), `01-base` đọc lại 34/34 dòng đúng; firmware camera ESP32-S3 nạp được cả qua Wi-Fi (OTA) | PR #44, #45, #46, #47, #48; `plans/PROGRESS.md` dòng 776 đến 790; memory `iot-cv-phase14-nap-fc.md` |
| Lắp ráp | 17/10 | Hướng dẫn lắp ráp tương tác: sơ đồ, mô hình 3D, 76 bước có tick | PR #49; `docs/huong-dan/lap-rap-phan-cung.html` |
| Bay thử | 24/10 | Chuyến bay đầu tiên trên khung S500 đã lắp: Stabilize treo 82 s rung 3 đến 4 m/s², Loiter treo 155 s cao tới 7,5 m, GPS 9 đến 15 vệ tinh | `plans/reports/261025-kiem-tra-phan-cung-that.md` dòng 30, 50, 51 |
| Cấu hình và hiệu chỉnh | 25/10 đến 26/10 | Kiểm phần cứng thật, hiệu chỉnh accel 6 mặt và Level, chốt bản đồ tay cầm FS-i6X, cài RC failsafe; TFmini Plus chạy 100 khung/s đơn vị cm; backend nhận drone thật qua Wi-Fi 160/160 | PR #50, #51; `plans/reports/261025-hieu-chinh-bay-trong-nha.md` mục 1, 2; `plans/reports/261026-tfmini-va-receiver.md`; memory `iot-cv-tfmini-da-sua-20261026.md` |
| Cấu hình và hiệu chỉnh | 01/11 | Cấu hình bay ngoài trời: geofence trần 20 m, RTL 15 m, tốc độ 3 m/s; hiệu chỉnh la bàn ngoài trời đạt (`COMPASS_SCALE` 1,005), Calibrate Level và Radio Calibration đạt | `plans/reports/261101-cau-hinh-bay-ngoai-troi.md`; memory `iot-cv-cau-hinh-ngoai-troi-20261101.md` |
| Bay thử | 01/11 | Buổi bay ngoài trời hơn chục chuyến qua Stabilize, AltHold, Loiter, Auto mission, RTL; 5 chuyến có log FC đầy đủ hạ cánh cách điểm cất cánh 3 đến 19 cm, rung ≤ 26, Clip 0, EKF ≤ 0,44 | `plans/reports/261102-phan-tich-bay-01-11.md`; memory `iot-cv-phan-tich-bay-20261101.md`; phiên `1435b5a6` (tin người dùng 01/11) |
| Bay thử | 02/11 | Nạp mission mới lên drone đang bay AUTO từ web dưới đất (chuyến 10:40: GUIDED giữ chỗ → nạp → đọc lại → bay lại từ điểm 1); camera ghi 11 phiên video về laptop trong hai ngày 01 và 02/11 | memory `iot-cv-nap-mission-khi-bay.md`; `logs/recordings/` (11 thư mục 20261101-* và 20261102-*) |
| Hoàn thiện | 15/11 | Kiểm toàn bộ phần cứng đạt (FC, IMU, baro, la bàn, 4 ESC/motor, tay cầm, TFmini, DroneBridge, camera 150/150 khung); web làm lại giao diện, thêm trang Lịch sử bay ghép log FC + tlog + video theo giờ GPS; 34 commit đẩy theo từng tính năng | `plans/reports/261115-kiem-phan-cung-that.md`; `plans/reports/261115-lich-su-bay-va-phan-tich-01-02-11.md`; `git log` IOT-CV ngày 15/11 (34 commit) |
| AI | 18/11 đến 19/11 | Repo XLA dựng pipeline AI xử lý ảnh chất lượng thấp trên khung bay thật (18 phase, 86 commit trong ngày 18/11); model ONNX phát hành trên GitHub Release 18/11; IOT-CV chạy model thật, trang Lịch sử bay so khung gốc với ảnh rõ, zoom chung; web triển khai lên AWS EC2 qua CI/CD | `git log` XLA (86 commit 18/11); `gh release list` XLA; PR IOT-CV #56, #57, #59, #60; XLA PR #2, #3 |
| AI | 25/11 đến 26/11 | Hoàn thiện AI: detector + bộ xác minh vùng cắt + lọc track + làm rõ ảnh classic ONNX chạy trong backend, "Ảnh rõ" bật sẵn; A/B mù chọn bản làm rõ thắng 25/25 so với ảnh gốc | PR IOT-CV #61, #62; XLA PR #7, #8; `AGENTS.md` hàng "Phần AI"; `D:\XLA\results\ab-v2\decision.json` |
| Hoàn thiện | 26/11 | Chuẩn bị báo cáo và slide thuyết trình toàn dự án | `plans/reports/261126-brainstorm-slide-iot-toan-du-an.md`; `docs/thuyet-trinh/BRIEF.md` |

Gợi ý gom cho một slide timeline (8 điểm): 21/09 thiết kế + công cụ · 22 đến 25/09 SITL, backend, web · 12/10 chốt linh kiện ·
13/10 nạp firmware FC · 17 đến 24/10 lắp ráp + bay đầu · 25/10 đến 01/11 hiệu chỉnh + cấu hình ngoài trời · 01 đến 02/11 bay ngoài
trời, nạp mission khi bay · 15 đến 26/11 hoàn thiện web, kiểm phần cứng, AI.

Ngày đặt mua linh kiện và ngày hàng về: `CHƯA CÓ NGUỒN` chính xác. Mốc gần nhất có nguồn: danh sách linh kiện người dùng
xác nhận 12/10 (`docs/phan-cung-thuc-te.md` dòng 9), ảnh FC thật soi ngày 12/10 (`plans/PROGRESS.md` Ghi chú Phase 14).
Ngày lắp xong khung: `CHƯA CÓ NGUỒN`; chắc chắn trước 24/10 vì có log bay ngày đó.

## (b) Con số

| Đại lượng | Giá trị | Nguồn / cách đếm |
|---|---|---|
| Phase kế hoạch UAV | 25 (Phase 00 đến 24) | `plans/_phase-index.md` |
| Phase UAV đã đóng có ngày xong | 12: Phase 00, 01, 02, 04, 05, 06, 07, 08, 10, 11, 12 có `Ngày xong`; Phase 09 merge qua PR #35 ngày 25/09 | `plans/PROGRESS.md` (grep `Ngày bắt đầu`); `git log` |
| Phase phần cứng đã bắt đầu và làm thật | 14 đến 21 có ngày bắt đầu 13/10 đến 25/10 (14, 15, 16, 17, 19, 20); bay thật Stabilize, AltHold, Loiter, Auto, RTL | `plans/PROGRESS.md` dòng 776 đến 1040 |
| Cổng pass luồng chính đã tick có bằng chứng | 161 / 320 | đếm `- [x]` và `- [ ]` dưới các mục `## Phase 00` đến `## Phase 24` của `plans/PROGRESS.md`. Lưu ý: nhiều cổng bay F1 tới F8 chưa tick dù đã bay, vì PROGRESS chỉ tick khi đủ hồ sơ log/notes theo mẫu. Không nên đưa tỉ lệ này lên slide |
| Phase AI (repo XLA) | 36 phase trong 2 đợt kế hoạch (18 + 18), đều xong | `D:\XLA\plans\261118-ai-anh-chat-luong-thap\` (18 phase); `D:\XLA\plans\261125-ai-v2\phase-01..18`; memory `iot-cv-ai-xla-quyet-dinh.md`, `iot-cv-ai-v2-20261125.md`. Trên slide nên ghi "36 phase AI" hoặc chỉ "18 phase", không nêu tên đợt |
| Commit IOT-CV | 89 | `git log --oneline \| wc -l` trên `main` |
| Commit XLA | 149 (`main`), 151 (mọi nhánh) | `git log` trong `D:\XLA` |
| PR đã merge IOT-CV | 54 (43 PR của người, 11 PR cập nhật thư viện do bot); số PR lớn nhất #63 | `gh pr list --state merged --limit 200` |
| PR đã merge XLA | 9 | `gh pr list --state merged` trong `D:\XLA` |
| Release model | 2 lần (18/11 và 25/11) | `gh release list` trong `D:\XLA` |
| Thời gian | 67 ngày lịch từ 21/09 (chốt thiết kế) đến 26/11; 102 ngày nếu tính từ tạo repo 17/08 | tính từ ngày commit |
| Ngày có commit | 15 ngày (IOT-CV 11 ngày, XLA 7 ngày, trùng 3) | `git log --pretty=%ad \| sort \| uniq -c` ở hai repo |
| Ngày làm phần cứng/bay không có commit | 24/10, 26/10, 27/10, 01/11, 02/11, 14/11 | memory + log FC (`logs/fc-dataflash-2026*`) |
| Phiên Claude Code còn file | 36 file `.jsonl` (31 IOT-CV + 5 XLA), trải 16 ngày từ 08/10 đến 26/11; bỏ 6 phiên dò cấu hình tự động và 3 phiên bài tập/hồ sơ ngoài dự án thì còn 27 phiên dự án | script lọc `type=user` trên 36 file |
| Test backend | 431 hàm `test_` | `rg -c "def test_" backend/tests` |
| Test frontend | 313 ca `it(`/`test(` | `rg` trên `frontend/src`, `frontend/tests` file `*.test.ts*`, `*.spec.ts*` |
| Runner SITL tự động | 13 file `run_*.py` + `harness.py` + `run-all.sh` | `ls scripts/sitl` |
| Script tự động hoá | 51 file `.py/.ps1/.sh/.bat` trong `scripts/` | `find scripts` |
| Dữ liệu bay | 97 file tlog, 7 thư mục log dataflash FC, 11 phiên video camera, khoảng 41 nghìn khung ảnh | `ls logs/tlog`, `ls logs`, `ls logs/recordings`; memory `iot-cv-ai-xla-quyet-dinh.md` mục 4 |

## (c) Cách làm việc

- **Drone ảo trước, drone thật sau.** Backend, web, mission, dead-man và tránh vật cản được nghiệm thu trên SITL
  ArduCopter 4.7.1 (WSL2) từ 21/09 đến 25/09, ba tuần trước khi FC thật được nạp firmware ngày 13/10. 13 runner SITL
  (`scripts/sitl/run_*.py`, `run-all.sh`) chạy lại được mỗi khi sửa code, kể cả bài nạp mission khi đang bay (`run_nap_khi_bay.py`).
  Nguồn: `plans/PROGRESS.md`, `scripts/sitl/`.
- **Mọi việc trên laptop chạy bằng script.** Nạp firmware DFU, đọc/ghi tham số và đọc lại để xác nhận, kiểm toàn bộ phần
  cứng, tải và phân tích log FC, chỉnh TFmini qua FC, bật hotspot, chế độ bay cho laptop: `scripts/fc/` (11 script),
  `scripts/esp32/`, `scripts/laptop/`. Ví dụ: nạp ArduPilot 13/10 không cần bấm BOOT hay rút cáp. Nguồn: memory
  `iot-cv-phase14-nap-fc.md`, `AGENTS.md` mục "Lắp ráp phần cứng".
- **Điều khiển phần mềm có giao diện bằng `cua-driver`.** Mission Planner, STM32CubeProgrammer được mở, bấm, đọc trạng thái
  qua cây UIA, có bước `verify_state` sau thao tác; ví dụ Mission Planner CONNECT COM6 ngày 13/10. Nguồn:
  `.claude/rules/computer-use-cua-driver-first.md`, memory `iot-cv-phase14-nap-fc.md`.
- **Web kiểm bằng Playwright.** E2E dead-man (Phase 10), chụp 11 trang ở 6 cỡ màn hình để dò chữ bị cắt và cuộn ngang,
  đo tốc độ trang bằng Chrome headless. Nguồn: PR #36, memory `iot-cv-giao-dien-web-20261115.md`.
- **Sub-agent chạy song song theo lane.** Phần AI ở XLA chia lane (data, degrade, realism, detect, classic, restore, abeval),
  mỗi lane một `git worktree` riêng, phiên chính gộp lại; ngày 18/11 có 86 commit. Nguồn: `git log` XLA (các merge
  `lane/realism`, `lane/data`, `lane/degrade`), phiên `a8d75ae9` ngày 18/11.
- **Bằng chứng trước khi tick.** PROGRESS chỉ tick cổng pass khi đã chạy lệnh và đọc kết quả; mỗi lần đổi tham số FC đều chụp
  toàn bộ bảng tham số trước và đọc lại sau khi khởi động lại. Nguồn: `plans/PROGRESS.md` mục "Cách dùng" dòng 13;
  `plans/reports/261025-hieu-chinh-bay-trong-nha.md` mục 2.
- **Motor quay thì người vận hành tự bấm.** ARM, Motor Test, bay thật: người vận hành bấm, tay giữ tay cầm RC; không công
  cụ tự động nào được bấm các nút này. Motor Test có số đo: Mission Planner (người bấm) và script ghi (chỉ đọc) chia cổng
  qua MAVProxy. Hiệu chỉnh accel, level, la bàn, tay cầm do người dùng làm trong Mission Planner theo hướng dẫn, agent đọc
  tham số kiểm lại. Nguồn: `SAFETY.md`, `AGENTS.md` luật 6, memory `iot-cv-kiem-phan-cung-20261115.md`.
- **Một nguồn sự thật cho mỗi loại thông tin.** Linh kiện ở `docs/phan-cung-thuc-te.md`, tham số ở
  `firmware/ardupilot/params/*.param`, tiến độ ở `plans/PROGRESS.md`, hợp đồng WebSocket sinh ra schema và kiểu TypeScript.
  Nguồn: `AGENTS.md` bảng "Nguồn sự thật"; commit 15/11 `chore(contract): sinh lại ws-contract.schema.json và protocol.generated.ts`.

## (d) Phần mềm và công cụ đã dùng

| Nhóm | Công cụ (phiên bản khi có nguồn) | Nguồn |
|---|---|---|
| Trạm mặt đất, firmware | Mission Planner 1.3.83, MAVProxy 1.8.74, ArduPilot ArduCopter 4.7.1 (custom build từ custom.ardupilot.org), STM32CubeProgrammer 2.23.0 | `plans/PROGRESS.md` dòng 54; `_phase-index.md` Phase 11 |
| ESP32 | PlatformIO Core 6.2.0 (VS Code), esptool 5.4.0, DroneBridge v2.4.1 | `plans/PROGRESS.md` dòng 54; `docs/phan-cung-thuc-te.md` dòng 20 |
| Mô phỏng | WSL2 Ubuntu 24.04, ArduPilot SITL (`sim_vehicle`) | `plans/PROGRESS.md` dòng 54, Phase 02 |
| Backend | Python 3.13, uv, FastAPI, uvicorn, pymavlink 2.4.49, pydantic, OpenCV, ONNX Runtime GPU 1.24.4 | `pyproject.toml`; `plans/PROGRESS.md` dòng 54 |
| Web | Node 24, pnpm 11, Vite 8, React 19, TypeScript, Tailwind CSS 4, Zustand, Leaflet + react-leaflet, three.js | `frontend/package.json` |
| Kiểm thử, CI | pytest, Vitest 5, Playwright 1.64, ruff, oxlint, GitHub Actions (`ci.yml`, `iotcv-ci.yml`, `iotcv-deploy.yml`) | `frontend/package.json`; `.github/workflows/`; commit 15/11 "ci: sửa lint" |
| Triển khai | Docker, AWS EC2 | PR #56; `plans/PROGRESS.md` dòng 54 |
| AI (repo XLA) | PyTorch 2.6.0 (CUDA 12.4), ONNX Runtime GPU 1.24.4, YOLO11, RT-DETR-x (gán nhãn trước), Label Studio, GitHub Release cho file ONNX | `git log` XLA ngày 18/11 (`build(xla): ... torch 2.6.0 cu124 ... onnxruntime-gpu 1.24.4`, `feat(labels): ... RT-DETR-x + YOLO11x ... Label Studio`) |
| Tự động hoá máy | Claude Code (sub-agent, worktree), `cua-driver` (MCP điều khiển GUI Windows), Playwright MCP | `.mcp.json`; `.claude/rules/computer-use-cua-driver-first.md`; memory `cong-cu-may-cai-o-d.md` |
| Phụ trợ | Charge Master (sạc B6AC), Git + GitHub CLI | memory `iot-cv-charge-master-b6ac.md` |

## Ghi chú cho người làm slide

- Theo BRIEF: không đưa lên slide tên đợt kế hoạch AI, số phiên bản bundle, tên release có số, các lần làm lại.
- Không dùng tỉ lệ cổng 161/320 trên slide (dễ bị hiểu là còn nửa việc); dùng số phase đã chạy và số chuyến đã bay.
- Mọi ngày trong bảng (a) là ngày có commit, có log, hoặc có báo cáo; ngày đặt mua linh kiện chưa có nguồn.
