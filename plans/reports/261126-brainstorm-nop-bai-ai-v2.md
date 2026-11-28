# Brainstorm 26/11/2026: README hai repo + slide + transcript + báo cáo cho phần AI v2

## Bài toán
AI v2 xong 26/11 (XLA #8, IOT-CV #61 #62). Drive nhóm 10 vẫn là bản 19/11 (AI v1, 25 slide). Cần: README cả hai repo,
slide ≤ 30 kiểu paper, transcript đọc nguyên văn, báo cáo ~10 trang, đưa lên Drive.

## Quyết định (người dùng duyệt)
- Kết quả: chỉ nêu phần đạt; số vẫn đúng nguồn t7–t9. Phương án không chọn trình bày dạng so sánh phương pháp.
- Báo cáo: LaTeX → PDF.
- Drive: chuyển thùng rác 3 file cũ (pptx, pdf slide, pdf báo cáo), upload bộ mới gồm cả transcript docx; giữ github_repo.xlsx.
- README: mỗi repo một nhánh + PR, người dùng tự merge.
- Slide: dùng lại bộ công cụ v3 (`D:\XLA\docs\nop-bai-src\slide-v3\deck\`: stage.py, kit.py, 63 công thức, TikZ 3D), viết lại nội dung quanh v2.

## Cách làm
1. Song song: README IOT-CV, README XLA, báo cáo LaTeX, slide (mỗi agent Opus, file riêng).
2. Transcript sau khi slide chốt.
3. Drive cuối cùng qua Playwright MCP (bẫy: bringToFront, upload qua http.server 127.0.0.1 + DataTransfer).
Brief chung (nguồn số, luật viết, phân công): `D:\XLA\docs\nop-bai-src\BRIEF-20261126.md`.

## Rủi ro
owner-guard có thể chặn ghi Drive → báo, không lách. Playwright gắn Chrome thật: tab nền ngừng vẽ.

## Đo thành công
≤ 30 slide, render tự soát từng slide; grep từ cấm sạch; báo cáo 9–11 trang; sha256 file Drive khớp file cục bộ; PR mở ở hai repo.
