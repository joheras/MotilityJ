#!/usr/bin/env python3
"""Regenerates web/sw.js from tools/sw.template.js: the precache list of every app file and a version
hash of their names and contents. There is no bundler, so run this after adding or changing any file
under web/ (the GitHub Pages workflow runs it too before deploying).

    python3 web/tools/build_sw.py
"""
import hashlib
import json
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {"tools", ".well-known"}
EXCLUDE_FILES = {"sw.js", ".DS_Store", "Thumbs.db"}
# .onnx: SAM model files, downloaded on demand by js/sam/ and kept in their own cache.
EXCLUDE_SUFFIXES = {".map", ".py", ".md", ".onnx"}


def app_files():
    files = []
    for p in WEB.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(WEB)
        if rel.parts[0] in EXCLUDE_DIRS or p.name in EXCLUDE_FILES or p.suffix in EXCLUDE_SUFFIXES:
            continue
        if any(part.startswith(".") for part in rel.parts):
            continue
        files.append(rel.as_posix())
    return sorted(files)


def main():
    files = app_files()
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode())
        h.update((WEB / f).read_bytes())
    template = (WEB / "tools" / "sw.template.js").read_text(encoding="utf-8")
    h.update(template.encode())
    version = h.hexdigest()[:12]
    sw = template.replace('"__VERSION__"', json.dumps(version)).replace("__FILES__", json.dumps(files, indent=1))
    (WEB / "sw.js").write_text(sw, encoding="utf-8")
    size = sum((WEB / f).stat().st_size for f in files) / 1024
    print(f"sw.js: {len(files)} files precached ({size:.0f} KB), version {version}")


if __name__ == "__main__":
    main()
