from typing import get_args

from splitune_ml_core.contracts._generated import StageName
from splitune_ml_core.devtools import OUTPUT_FILES
from splitune_ml_core.stages import STAGES, notes_stages


def test_notes_stages_follow_the_contracts_manifest() -> None:
    stages = notes_stages()
    assert set(stages) == {"guitar", "bass", "piano", "vocals", "drums"}
    # Drums also read the downbeats for the crash/ride default (stage_notes.drum_kit).
    assert stages["drums"] == ("separation", "stems", "beats")
    for instrument, reads in stages.items():
        name = f"notes.{instrument}"
        assert name in get_args(StageName.__value__)
        assert STAGES[name].optional_downloads == reads
        assert OUTPUT_FILES[name] == {"notes": f"{name}.json"}
