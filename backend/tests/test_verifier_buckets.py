"""Verifier đệm N lên bậc, mỗi bậc một session, chạy thử mọi bậc lúc nạp (`verifier.py`).

Session ORT CUDA trả ~60 ms mỗi lần shape `boxes` khác lần gọi trước (phase 09 plan XLA
261125-ai-v2, đo lại 26/11/2026). Đệm N lên bậc (1, 2, 4, 8, 16, chia lượt khi > 16),
mỗi bậc giữ session riêng và chạy thử một lần lúc nạp thì không session nào gặp shape thứ hai.
Test chạy bundle giả trên CPU.
"""

from __future__ import annotations

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("onnx")
pytest.importorskip("onnxruntime")

from backend.tests.test_vision_v2 import CPU, ZERO, make_bundle, verifier_graph  # noqa: E402
from backend.vision.model_bundle import BundleRejected, load_bundle  # noqa: E402
from backend.vision.verifier import N_BUCKETS, BoxVerifier, bucket_for  # noqa: E402


class _Counting:
    def __init__(self, real, log: list[tuple[int, int]], bucket: int):
        self.real, self.log, self.bucket = real, log, bucket

    def run(self, names, feeds):
        self.log.append((self.bucket, feeds["boxes"].shape[0]))
        return self.real.run(names, feeds)


def _count(ver: BoxVerifier) -> list[tuple[int, int]]:
    """Bọc mọi session của `ver`; trả nhật ký (bậc của session, N session nhận)."""
    log: list[tuple[int, int]] = []
    first = ver.buckets[0]
    ver.bundle.session = _Counting(ver.bundle.session, log, first)
    for b, sess in list(ver.sessions.items()):
        ver.sessions[b] = _Counting(sess, log, b)
    return log


def _bundle(tmp_path):
    return load_bundle(*make_bundle(tmp_path, "verifier"), "verifier", CPU)


def _boxes(n: int, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    x1 = rng.uniform(16, 560, n)
    y1 = rng.uniform(0, 400, n)
    return np.stack([x1, y1, x1 + 40, y1 + 70], axis=1).astype(np.float32)


def test_bucket_for():
    got = [bucket_for(n) for n in (1, 2, 3, 4, 5, 8, 9, 16, 17, 100)]
    assert got == [1, 2, 4, 4, 8, 8, 16, 16, 16, 16]
    assert N_BUCKETS == (1, 2, 4, 8, 16)


def test_moi_bac_mot_session_rieng_va_warmup_moi_bac_mot_lan(tmp_path):
    ver = BoxVerifier(_bundle(tmp_path), warmup=False)
    assert sorted(ver.sessions) == list(N_BUCKETS[1:])
    assert ver.session_for(1) is ver.bundle.session
    assert len({id(ver.session_for(b)) for b in N_BUCKETS}) == len(N_BUCKETS)
    log = _count(ver)
    ver.warmup()
    assert log == [(b, b) for b in N_BUCKETS]


@pytest.mark.parametrize("n", [1, 2, 3, 5, 7, 8, 13, 16, 17, 33, 40])
def test_dem_khong_doi_diem_hop_that(tmp_path, n):
    bundle = _bundle(tmp_path)
    real = bundle.session
    ver = BoxVerifier(bundle, warmup=False)
    log = _count(ver)
    boxes = _boxes(n, seed=n)
    got = ver.verify(ZERO, boxes)
    # Không đệm: chạy thẳng session với đúng N hộp.
    (want,) = real.run(["scores"], {"frame": ZERO, "boxes": boxes})
    assert got.dtype == np.float32 and got.shape == (n,)
    np.testing.assert_array_equal(got, np.asarray(want, np.float32))
    assert np.allclose(got, 1.0 - boxes[:, 0] / 640.0, atol=1e-6)  # graph giả: 1 − x1/640
    # Mỗi session chỉ nhận đúng N của bậc nó; > 16 hộp chia lượt 16 + phần dư đệm lên bậc.
    assert all(bucket == seen for bucket, seen in log)
    full, rest = divmod(n, 16)
    assert [seen for _, seen in log] == [16] * full + ([bucket_for(rest)] if rest else [])


def test_n0_van_khong_goi_session(tmp_path):
    ver = BoxVerifier(_bundle(tmp_path), warmup=False)
    log = _count(ver)
    assert ver.verify(ZERO, np.zeros((0, 4), np.float32)).shape == (0,)
    assert log == []


def test_warmup_loi_la_bundle_rejected(tmp_path):
    # Graph ra hằng 1 điểm: qua được chạy thử N = 1 lúc nạp nhưng hỏng ở bậc N = 2.
    path, sha = make_bundle(tmp_path, "verifier", data=verifier_graph(fixed_scores=[0.5]))
    bundle = load_bundle(path, sha, "verifier", CPU)
    with pytest.raises(BundleRejected, match="N = 2"):
        BoxVerifier(bundle)


def test_buckets_sai(tmp_path):
    bundle = _bundle(tmp_path)
    for bad in [(), (2, 1), (0, 4), (1, 1, 2)]:
        with pytest.raises(ValueError, match="buckets"):
            BoxVerifier(bundle, buckets=bad, warmup=False)
