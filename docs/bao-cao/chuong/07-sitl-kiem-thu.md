# Drone ảo SITL và kiểm thử

Nhiều bài kiểm quan trọng nhất của dự án không thể làm an toàn trên drone thật: cố tình bay ra rào ảo, vượt trần độ cao, tắt tay cầm giữa chừng, để pin cạn. Chương này trình bày drone ảo SITL mà nhóm em dùng cho các bài đó, thư viện harness và các runner nghiệm thu tự động, bài tránh vật cản trên SITL, cùng hai bộ test đơn vị của backend và web.

## Drone ảo trên WSL2

SITL (Software In The Loop) chạy đúng mã nguồn ArduCopter 4.7.1 như trên bo bay, chỉ thay cảm biến và động cơ bằng mô hình vật lý. Nhóm em chạy nó trong WSL2 (bản phân phối Ubuntu) trên chính laptop trạm mặt đất, bằng `scripts/run_sitl.sh`. Script gọi `sim_vehicle.py` và chọn kiểu mạng của WSL qua biến `WSL_MIRRORED` (mặc định mạng mirrored, để cổng TCP của SITL hiện ra ở `127.0.0.1` phía Windows).

Mô hình khung phải khớp tham số `FRAME_TYPE 12` của drone thật, tức thứ tự motor kiểu Betaflight của ESC OX32, nên SITL chạy với khung `-f bfx`. Mô hình sai khung thì motor ảo quay sai vị trí và mọi bài bay ảo vô nghĩa. Cảm biến dòng ảo của SITL cố định 17 A/V, và ESC ảo báo 0 vòng/phút, nên runner nào nạp bộ tham số bay thật (có `TKOFF_RPM_MIN 1000`) phải bù tham số đó trước khi cất cánh.

Backend nối vào drone ảo đúng như nối drone thật, chỉ đổi `MAVLINK_ENDPOINT` sang `tcp:127.0.0.1:5760`. Cùng một backend, cùng một web, cùng một bộ tham số, nên một bài đạt trên SITL kiểm được cả chuỗi phần mềm từ trình duyệt tới firmware (@fig:c7-vong-sitl).

![Vòng kiểm thử SITL: ArduCopter SITL khung bfx trong WSL2, harness nói chuyện bằng MAVLink thật, backend nối qua TCP 5760, web nối backend qua WebSocket.](docs/thuyet-trinh/img/tikz/F30.png){#fig:c7-vong-sitl w=12}

## Harness và runner

`scripts/sitl/harness.py` là thư viện điều khiển drone ảo bằng pymavlink. Lớp `SitlInstance` có các bước một bài bay cần: `wait_ready`, `set_mode`, `arm`, `takeoff`, `wait_altitude`, `upload_mission`, `download_mission`, `rc_override` (giả lập gạt tay cầm), `set_param`. Trên harness là các runner, mỗi runner trả lời một câu hỏi cụ thể và in khối `## KET QUA` dạng bảng, kết thúc bằng `KET QUA: PASS` hoặc `KET QUA: FAIL` với mã thoát khác 0 khi hỏng. Thư mục `scripts/sitl/` có 13 file Python, 4 093 dòng.

Lệnh `bash scripts/sitl/run-all.sh` chạy tuần tự 8 runner trong khoảng 17 phút, in bảng tổng và trả mã thoát khác 0 nếu có runner hỏng hoặc còn sót tiến trình SITL. Runner nạp mission khi đang bay cần backend chạy kèm (`MAVLINK_ENDPOINT=tcp:127.0.0.1:5763`) nên chạy riêng. @tab:c7-runner là kết quả của cả mười runner.

Bảng: Mười runner SITL và kết quả {#tab:c7-runner}
| Runner | Kiểm gì | Số đo | Kết quả |
|---|---|---|---|
| `run_mode_chain` | 7 chế độ bay đổi được, có tác dụng | 7/7; RTL về home 0,0 m | PASS |
| `run_rtl_alt` | độ cao RTL theo `RTL_ALT_M` | đỉnh 20,0 m (15) và 50,0 m (50) | PASS |
| `run_mission_auto` | nạp, đọc lại, bay AUTO 5 waypoint | 6 item khớp từng trường; tới đủ WP 1 đến 5 | PASS |
| `run_mission_low_alt` | bo bay có chặn waypoint 3 m | không chặn, xuống 3,2 m | PASS |
| `run_log_dump` | rút độ cao và lần đổi mode từ `.BIN` | 1 218 mẫu CTUN ra CSV | PASS |
| `run_param_load` | bộ tham số dự án trên SITL | 51/51 dòng kiểm | PASS |
| `run_avoid_brake` | TFmini ảo và AVOID phanh trước cột | gần cột nhất 1,07 m | PASS |
| `run_backend_avoid` | backend báo trạng thái tránh | OFF → NEAR → ACTIVE; gần nhất 1,05 m | PASS |
| `run_nap_khi_bay` | nạp mission khi đang AUTO | GUIDED < 0,1 s; lệch 0,42 m; về item 1 | PASS |
| `run_ngoai_troi` | cấu hình bay ngoài trời | 8/8 bài | PASS |

Hai runner có kết quả dẫn tới quyết định thiết kế. `run_mission_low_alt` cho thấy bo bay nhận waypoint 3 m mà không chặn, nên backend tự chặn mọi điểm dưới `MIN_ALT = 2` m (chương 6). `run_param_load` đọc lại bộ tham số sau khi nạp và khởi động lại, so với mốc theo tên theo cả hai chiều, để bắt tham số bị SITL từ chối hay bị bo bay tự đổi.

## Cấu hình bay ngoài trời trên SITL

Runner `run_ngoai_troi.py` gồm 8 bài cố tình làm sai như người lái có thể lỡ tay, với đúng cấu hình bay ngoài trời: rào ảo trụ bán kính 100 m, trần 20 m, lề 2 m (@tab:c7-ngoai-troi). Mỗi bài đạt nghĩa là bo bay tự giữ được drone mà không cần ai can thiệp.

Bảng: Tám bài của runner cấu hình ngoài trời {#tab:c7-ngoai-troi}
| Bài | Tình huống | Số đo |
|---|---|---|
| S1 | mission đi về 5 m ở AUTO | xa nhất 5,1 m, hạ đúng home |
| S1B | biến thể của S1 | xa nhất 4,3 m, RTL không leo |
| S2 | LOITER đẩy ga hết cỡ | dừng ở 18,1 m (trần 20, lề 2) |
| S3 | STABILIZE vượt trần | chạm trần lúc leo 7 m/s → RTL, cao nhất 23,2 m, hạ cách home 0,1 m |
| S4 | LOITER tiến hết cỡ | tự dừng ở 98,1 m, trước rào |
| S5 | ALT_HOLD bay ra rào | chạm rào ở 99,6 m lúc 4,1 m/s → RTL, xa nhất 103,4 m, hạ đúng home |
| S6 | mất sóng tay cầm | RTL sau khoảng 1 s, hạ đúng home |
| S7 | pin yếu | Battery Failsafe → RTL, hạ đúng home |

Ở S3 và S5, drone vượt trần hay vượt rào vài mét trước khi quay về vì ở STABILIZE và ALT_HOLD bo bay không chủ động hãm, chỉ phát hiện vi phạm rồi chuyển RTL. LOITER thì hãm trước giới hạn (S2, S4). Khoảng vượt này cần được tính khi chọn rào và trần so với kích thước bãi bay.

## Tránh vật cản trên SITL

Bài `run_avoid_brake.py` dựng một cột ảo trước mũi drone, bật TFmini Plus ảo với đúng các tham số `RNGFND1_*` và `AVOID_*` của dự án, rồi giữ cần tiến thẳng ở LOITER. Bài có đối chứng: chạy lại y hệt nhưng tắt AVOID. Hai lần chỉ khác nhau đúng một tính năng, nên chênh lệch kết quả là của tính năng đó (@fig:c7-avoid, @fig:c7-avoid-bieu-do).

![Bài phanh trước cột trên SITL: nhìn từ trên, khoảng cách tới mặt cột và tốc độ theo thời gian, so lần đối chứng (AVOID tắt) với lần bật TFmini và AVOID; vạch ngang là AVOID_MARGIN 2 m.](docs/thuyet-trinh/img/sitl-avoid-phanh.png){#fig:c7-avoid w=16}

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/tranh-vat-can-sitl.csv
x: lan_chay
y: be_mat_min_m
xlabel: Lần chạy
ylabel: Khoảng cách gần nhất tới mặt cột (m)
caption: Khoảng cách gần nhất tới mặt cột ảo: lần đối chứng đi xuyên cột (giá trị âm), lần bật TFmini và AVOID dừng cách cột 1,07 m.
id: fig:c7-avoid-bieu-do
w: 12
```

Khi tắt AVOID, drone đi xuyên cột (khoảng cách gần nhất −0,83 m) với tốc độ 3,99 m/s trong 5 s cuối. Khi bật, drone dừng cách cột 1,07 m, tốc độ 5 s cuối còn 0,78 m/s, và người lái giữ cần suốt 40 s mà drone không vượt cột. TFmini ảo có 133 mẫu nằm trong tâm chùm tia, lệch trung bình 0,36 m so với khoảng cách hình học. Runner `run_backend_avoid.py` chạy cùng kịch bản qua backend và kiểm trạng thái mà web hiển thị đi đúng chuỗi `OFF → NEAR → ACTIVE`, gần nhất 1,05 m. Hai runner đo dữ liệu thật của SITL còn cho biết `DISTANCE_SENSOR` tới từ đúng một nguồn id 10, hướng 0, dải 10 đến 600 cm, và AC_Avoid phanh mà không phát STATUSTEXT nào; `backend/mavlink/proximity.py` được viết theo đúng các số đo này thay vì theo tài liệu.

## Nghiệm thu web trên SITL

Chín bài nghiệm thu chạy cả chuỗi từ trình duyệt tới drone ảo, mỗi bài có số đo (@tab:c7-web). Bài "tay cầm lấy lại quyền từ web" không làm được trên SITL vì không có RC thật; bài đó thuộc danh sách kiểm của buổi bay.

Bảng: Chín bài nghiệm thu web trên SITL {#tab:c7-web}
| # | Bài | Số đo |
|---|---|---|
| 1 | cất cánh từ web | GUIDED → ARM → TAKEOFF; HUD 5,0 m |
| 2 | giữ W | 1,00 m/s; dịch 2,1 m hướng 352°, mũi 351° |
| 3 | thả W | < 0,2 m/s sau 1,31 s |
| 4 | đóng tab | backend gửi vận tốc 0 sau 6 ms và 7 ms (2 lần) |
| 5 | cửa sổ mất tiêu điểm | < 0,2 m/s sau 1,06 s, phím W tự nhả |
| 6 | mission từ web | 3 điểm trên bản đồ → nạp, đọc lại → AUTO → hết mission, DISARM |
| 7 | HOLD | LOITER, < 0,2 m/s sau 1,30 s, WEB CONTROL tự tắt |
| 8 | mất camera | OFFLINE sau 2,3 s; liên kết, HUD, bản đồ vẫn chạy |
| 9 | vật cản | LOITER: OFF → NEAR → ACTIVE; GUIDED: không lần nào ACTIVE, cảnh báo hiện suốt |

Bốn bài trong số đó được viết thành spec Playwright để chạy lại tự động: `deadman.spec.ts` (đóng tab khi đang giữ W), `acceptance.spec.ts` (cất cánh, lái, HOLD, mission AUTO), `camera-loss.spec.ts`, `avoid.spec.ts`. Thư mục `frontend/tests/e2e/` có 6 file spec.

## Test đơn vị của backend và web

Test đơn vị kiểm từng hàm, chạy trong vài giây, không cần drone ảo. Phần lớn logic của backend được viết thành hàm thuần (ví dụ `update_state()` trong telemetry, toàn bộ `safety.py`) chính để test được theo cách này. @tab:c7-test là hai bộ test chạy ngày 26/11/2026.

Bảng: Hai bộ test đơn vị chạy ngày 26/11/2026 {#tab:c7-test}
| Bộ | Công cụ | Quy mô | Kết quả |
|---|---|---|---|
| Backend | pytest | 27 file, 512 test, 8 107 dòng | mã thoát 0, không test nào hỏng |
| Web | Vitest + Testing Library | 26 file, 320 test, 3 897 dòng | 320 passed trong 6,29 s |

Các file nhiều test nhất của backend là các test của pipeline AI (56), `test_mission_upload.py` (45), `test_proximity.py` (38), `test_telemetry.py` (38) và `test_mission_validation.py` (27). Bốn module an toàn (`safety`, `mission`, `deadman`, `proximity`) có ngưỡng độ phủ tối thiểu 80 % đặt trong `pyproject.toml`. Một số test canh đúng thứ dễ vỡ nhất: test giữ mặt nạ `type_mask` của lệnh vận tốc, test bắt vòng dead-man phải đỏ nếu bị chuyển vào asyncio, test bỏ HEARTBEAT có `autopilot = INVALID`.

Ba tầng kiểm thử bắt ba kiểu lỗi khác nhau. Test đơn vị bắt lỗi logic trong vài giây và chạy sau mỗi lần sửa. Runner SITL bắt lỗi giao thức và lỗi hiểu sai firmware, vì firmware và MAVLink là thật, chỉ vật lý là giả. Nghiệm thu web bắt lỗi ở chỗ nối giữa các phần, như phím không tự nhả khi mất tiêu điểm. Không tầng nào thay được tầng khác, và không tầng nào thay được buổi bay thật ở chương 9.
