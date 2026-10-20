import re

import splitune_ml_core


def test_exposes_semver_version() -> None:
    assert re.fullmatch(r"\d+\.\d+\.\d+", splitune_ml_core.__version__)
