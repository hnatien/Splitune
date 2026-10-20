"""Locations inside the checkout (the ML packages are installed editable from the repo)."""

from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[4]
REPO_ROOT = ML_ROOT.parents[1]
ISLANDS_DIR = ML_ROOT / "islands"
CONTRACT_FIXTURES_DIR = REPO_ROOT / "packages" / "contracts" / "fixtures"
