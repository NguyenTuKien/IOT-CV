# ml/ — khung sườn AI cũ, KHÔNG DÙNG

Thư mục này là phần còn lại của luồng AI cũ (`plans/ai/`, 21/09/2026). Sáu khung sườn trong
`ml/scripts/` (chỉ ném `NotImplementedError`) **đã chuyển sang XLA, xoá 25/11/2026** (plan XLA
`plans/261125-ai-v2/`, phase 16); lịch sử còn trong git. Từ 18/11/2026 toàn bộ phần AI (dữ liệu, làm
xấu ảnh, huấn luyện, đánh giá, báo cáo môn Xử lý ảnh) nằm ở **repo XLA** (`D:\XLA`, GitHub
Localhost218/XLA). `backend/tests/test_repo_hygiene.py` giữ cho `ml/scripts/` không quay lại.

IOT-CV chỉ nhận model đã xuất theo hợp đồng `docs/hop-dong-model.md` của XLA:

```
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/detector-v1.0.0
uv run python scripts/vision/kiem_bundle.py models/vision/detector-v1.0.0 --json
```

Bundle vào `models/vision/<bundle>/` (file `.onnx` bị `.gitignore` chặn); backend nạp ở
`backend/vision/model_bundle.py`. `ml/configs/` và `ml/pyproject.toml` còn giữ (ngoài phạm vi lần xoá
25/11/2026).
