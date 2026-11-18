"""Security-boundary tests for deployment input and release ownership."""

import json
import tempfile
import unittest
from pathlib import Path

from deploy import current_release, image_ref, release_sha


class DeploymentBoundaryTests(unittest.TestCase):
    def test_image_must_be_in_approved_repository_and_digest_pinned(self):
        repo = "ghcr.io/ngtukien/iot-cv"
        valid = repo + "@sha256:" + "a" * 64
        self.assertEqual(image_ref(valid, repo), valid)
        for value in (repo + ":latest", "ghcr.io/attacker/image@sha256:" + "a" * 64,
                      valid + "; touch /tmp/injected", repo + "@sha256:" + "0" * 64):
            with self.assertRaises(ValueError):
                image_ref(value, repo)

    def test_rollback_cannot_use_a_path_or_shell_expression(self):
        for value in ("../../etc", "/srv/iotcv", "main", "a" * 40 + ";id", "A" * 40):
            with self.assertRaises(ValueError):
                release_sha(value)

    def test_symlink_to_external_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "managed"
            (root / "releases").mkdir(parents=True)
            other = Path(folder) / ("a" * 40)
            other.mkdir()
            link = root / "current"
            link.symlink_to(other)
            with self.assertRaises(RuntimeError):
                current_release(link, root)

    def test_release_requires_matching_ownership_marker(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "releases" / ("a" * 40)
            target.mkdir(parents=True)
            (target / ".iotcv-release.json").write_text(json.dumps({"sha": "b" * 40}))
            link = root / "current"
            link.symlink_to(target)
            with self.assertRaises(RuntimeError):
                current_release(link, root)


if __name__ == "__main__":
    unittest.main()
