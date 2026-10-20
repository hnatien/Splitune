"""Structured JSON logs on stderr.

Never log user content: analysis ids, stages, timings and machine error codes only. URLs are
redacted wherever they appear, because presigned URLs are credentials (06 §3).
"""

from __future__ import annotations

import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any, cast

_URL = re.compile(r"\b[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
_RESERVED = set(logging.makeLogRecord({}).__dict__) | {"message", "asctime"}


def redact(text: str) -> str:
    return _URL.sub("[url]", text)


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, dict):
        return {str(k): _clean(v) for k, v in cast(dict[Any, Any], value).items()}
    if isinstance(value, list | tuple):
        return [_clean(v) for v in cast(list[Any], value)]
    if isinstance(value, int | float | bool) or value is None:
        return value
    return redact(str(value))


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": redact(record.getMessage()),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                entry[key] = _clean(value)
        if record.exc_info and record.exc_info[0] is not None:
            # Type and location only: exception messages can carry paths or URLs.
            entry["exc_type"] = record.exc_info[0].__name__
            entry["exc"] = redact(self.formatException(record.exc_info))
        return json.dumps(entry, separators=(",", ":"))


def configure_logging(level: str = "info") -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    # botocore logs request URLs at debug level.
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
