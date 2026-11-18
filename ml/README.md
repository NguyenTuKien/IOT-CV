# ml/ — khung sườn AI cũ, KHÔNG DÙNG

Thư mục này là khung sườn của luồng AI cũ (`plans/ai/`, 21/09/2026): mọi script trong `ml/scripts/`
chỉ ném `NotImplementedError`. Từ 18/11/2026 toàn bộ phần AI (dữ liệu, làm xấu ảnh, huấn luyện, đánh
giá, báo cáo môn Xử lý ảnh) nằm ở **repo XLA** (`D:\XLA`, GitHub Localhost218/XLA), plan
`plans/261118-ai-anh-chat-luong-thap/`.

IOT-CV chỉ nhận model đã xuất theo hợp đồng `docs/hop-dong-model.md` của XLA:

```
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/detector-v1.0.0
uv run python scripts/vision/kiem_bundle.py models/vision/detector-v1.0.0 --json
```

Bundle vào `models/vision/<bundle>/` (file `.onnx` bị `.gitignore` chặn); backend nạp ở
`backend/vision/model_bundle.py`. Thư mục `ml/` chưa xoá vì xoá cần chủ dự án duyệt
(plan XLA, Human steps "Duyệt xoá").
