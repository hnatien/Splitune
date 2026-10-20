"""Stage errors carry a machine code (contracts `MachineCode`), never raw exception text."""

from __future__ import annotations

import re

_MACHINE_CODE = re.compile(r"^[a-z][a-z0-9_.]*$")


class StageError(Exception):
    """A failure with a stable code. `retry=False` marks permanent failures (bad input)."""

    def __init__(self, code: str, *, retry: bool = True) -> None:
        if not _MACHINE_CODE.fullmatch(code) or len(code) > 64:
            raise ValueError(f"not a machine code: {code!r}")
        super().__init__(code)
        self.code = code
        self.retry = retry
