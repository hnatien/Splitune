"""Confidence calibration tables (`CalibrationTable`, 05 step-05 notes).

`services/ml/config/calibration/<record>@<version>.<instrument>.json`, falling back to
`<record>@<version>.json` (record = the model's register id). Same lookup as music-core
`calibration/lookup.ts`: linear interpolation between the isotonic knots, clamped outside them.
A model without a table is calibrated with the identity and the default bands.
"""

from __future__ import annotations

import bisect
import hashlib
from pathlib import Path

from . import contracts
from .paths import ML_ROOT

CALIBRATION_DIR = ML_ROOT / "config" / "calibration"
# music-core DEFAULT_BANDS, used until P2 fits a table.
DEFAULT_BANDS = contracts.Bands(high=0.7, medium=0.4)


def table_path(record: str, version: str, instrument: str | None, root: Path) -> Path | None:
    names = [f"{record}@{version}.{instrument}.json"] if instrument else []
    names.append(f"{record}@{version}.json")
    return next((root / n for n in names if (root / n).is_file()), None)


def load(
    record: str, version: str, instrument: str | None = None, root: Path = CALIBRATION_DIR
) -> contracts.CalibrationTable:
    path = table_path(record, version, instrument, root)
    if path is None:
        return contracts.CalibrationTable(
            model_id=record, version=version, method="identity", knots=[], bands=DEFAULT_BANDS
        )
    return contracts.CalibrationTable.model_validate_json(path.read_text(encoding="utf-8"))


def calibrate(raw: float, table: contracts.CalibrationTable) -> float:
    knots = table.knots
    if table.method == "identity" or not knots:
        return min(1.0, max(0.0, raw))
    xs = [k[0] for k in knots]
    if raw <= xs[0]:
        return knots[0][1]
    if raw >= xs[-1]:
        return knots[-1][1]
    hi = bisect.bisect_right(xs, raw)
    (x0, y0), (x1, y1) = knots[hi - 1], knots[hi]
    value = y1 if x1 == x0 else y0 + (raw - x0) / (x1 - x0) * (y1 - y0)
    return min(1.0, max(0.0, value))


def describe(table: contracts.CalibrationTable) -> dict[str, object]:
    """What a stage records in its params (and so in its cache key): the table, a hash of its
    content (a refit invalidates cached results) and its bands (read by finalize)."""
    return {
        "table": f"{table.model_id}@{table.version}",
        "method": table.method,
        "fitted_on": table.fitted_on,
        "sha256": hashlib.sha256(contracts.dump_json(table).encode()).hexdigest(),
        "bands": table.bands.model_dump(),
    }
