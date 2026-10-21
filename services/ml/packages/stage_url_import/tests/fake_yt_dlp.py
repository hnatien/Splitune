"""Stands in for `python -m yt_dlp` in the url_import tests. The URL's last path segment picks the
scenario; every call appends its arguments to $FAKE_YT_DLP_LOG."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def main(argv: list[str]) -> None:
    with Path(os.environ["FAKE_YT_DLP_LOG"]).open("a", encoding="utf-8") as log:
        log.write(json.dumps(argv) + "\n")
    if "--dump-single-json" in argv:
        url = argv[argv.index("--") + 1]
        scenario = url.rstrip("/").rsplit("/", 1)[-1]
        if scenario == "unsupported":
            fail(f"Unsupported URL: {url}")
        if scenario == "private":
            fail("[youtube] abc: Private video. Sign in if you've been granted access")
        if scenario == "flaky":
            fail("[youtube] abc: Unable to download webpage: Connection reset by peer")
        if scenario == "slow":
            time.sleep(5)
        info = {
            "_type": "video",
            "id": "abc",
            "title": "  Song title  ",
            "artist": "Some Artist",
            "duration": 1300 if scenario == "long" else 241.5,
            "is_live": scenario == "live",
            "extractor_key": "Youtube",
            "webpage_url": url,
        }
        print(json.dumps(info))
        return
    info = json.loads(Path(argv[argv.index("--load-info-json") + 1]).read_text(encoding="utf-8"))
    scenario = info["webpage_url"].rsplit("/", 1)[-1]
    fmt = argv[argv.index("-f") + 1]
    template = argv[argv.index("-o") + 1]
    is_video = fmt.startswith("bv")
    if scenario == "big" and not is_video:
        print(f"[download] File is larger than max-filesize ({10**9} bytes > {500 * 2**20} bytes)")
        return
    if scenario == "novideo" and is_video:
        fail("[youtube] abc: Requested format is not available")
    ext = "mp4" if is_video else "m4a"
    Path(template.replace("%(ext)s", ext)).write_bytes(b"\x00" * 64)


if __name__ == "__main__":
    main(sys.argv[1:])
