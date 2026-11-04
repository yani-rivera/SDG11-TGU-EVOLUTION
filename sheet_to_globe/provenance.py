"""Provenance record written beside the outputs."""
import datetime
import hashlib
import platform
from . import __version__


def sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def record(source_path, source_size, config):
    return {
        "script": "sheet_to_globe",
        "version": __version__,
        "python": platform.python_version(),
        "source_file": str(source_path),
        "source_sha256": sha256(source_path),
        "source_size_px": list(source_size),
        "config": config,
        "created_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }
