"""Golden fixtures from packages/contracts validated against the generated Pydantic models.

fixtures/index.json is shared with the Vitest suite, so both languages check the same documents.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError
from splitune_ml_core import contracts

FIXTURES = Path(__file__).resolve().parents[5] / "packages/contracts/fixtures"
INDEX: dict[str, list[dict[str, Any]]] = json.loads((FIXTURES / "index.json").read_text())


def adapter(entry: dict[str, Any]) -> TypeAdapter[Any]:
    return TypeAdapter[Any](getattr(contracts, entry["type"]))


def load(entry: dict[str, Any]) -> Any:
    return json.loads((FIXTURES / entry["file"]).read_text())


def documents(entry: dict[str, Any]) -> list[Any]:
    """List fixtures (e.g. corrections.json) hold one document per item."""
    data = load(entry)
    return data if entry.get("list") else [data]


def ids(entries: list[dict[str, Any]]) -> list[str]:
    return [entry["file"] for entry in entries]


@pytest.mark.parametrize("entry", INDEX["valid"], ids=ids(INDEX["valid"]))
def test_valid_fixture_validates(entry: dict[str, Any]) -> None:
    for document in documents(entry):
        adapter(entry).validate_python(document)


@pytest.mark.parametrize("entry", INDEX["valid"], ids=ids(INDEX["valid"]))
def test_valid_fixture_round_trips(entry: dict[str, Any]) -> None:
    # What a Python writer emits must be what the TypeScript readers accept: the same document.
    type_adapter = adapter(entry)
    for document in documents(entry):
        parsed = type_adapter.validate_python(document)
        assert json.loads(type_adapter.dump_json(parsed, exclude_none=True)) == document


@pytest.mark.parametrize("entry", INDEX["invalid"], ids=ids(INDEX["invalid"]))
def test_invalid_fixture_is_rejected(entry: dict[str, Any]) -> None:
    type_adapter = adapter(entry)
    with pytest.raises(ValidationError):  # noqa: PT012 (one bad item fails the whole list)
        for document in documents(entry):
            type_adapter.validate_python(document)


def test_dump_json_omits_unset_optionals() -> None:
    beats = contracts.Beats.model_validate(load({"file": "beats.json"}))
    assert "bpm_curve" not in json.loads(contracts.dump_json(beats))


def test_unknown_fields_are_ignored() -> None:
    document = load({"file": "beats.json"}) | {"added_in_1_1": True}
    beats = contracts.Beats.model_validate(document)
    assert "added_in_1_1" not in json.loads(contracts.dump_json(beats))


def test_schema_version_matches_typescript() -> None:
    bundle = json.loads((FIXTURES.parent / "schema/contracts.json").read_text())
    assert contracts.SCHEMA_VERSION == bundle["x-schema-version"] == "1.4.0"


@pytest.mark.parametrize("version", ["1.0.0", "1.4.2", "1.10.0"])
def test_assert_compatible_accepts_same_major(version: str) -> None:
    contracts.assert_compatible(version)


@pytest.mark.parametrize("version", ["2.0.0", "0.9.0", "1.0", "v1.0.0", "1.0.0-beta", ""])
def test_assert_compatible_rejects_other_versions(version: str) -> None:
    with pytest.raises(contracts.IncompatibleSchemaVersionError):
        contracts.assert_compatible(version)
