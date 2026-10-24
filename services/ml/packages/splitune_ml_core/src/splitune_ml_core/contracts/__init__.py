"""Pydantic models generated from packages/contracts (docs/specs/05-analysis-schema.md).

Writers serialise with `dump_json`: optional fields are omitted rather than written as null,
because the Zod readers treat a missing field and null differently.
"""

import re

from pydantic import BaseModel

from ._generated import *  # noqa: F403
from ._generated import SCHEMA_VERSION as SCHEMA_VERSION

_SEMVER = re.compile(r"(\d+)\.(\d+)\.(\d+)")
_SCHEMA_MAJOR = int(SCHEMA_VERSION.split(".")[0])


class IncompatibleSchemaVersionError(ValueError):
    def __init__(self, version: str) -> None:
        super().__init__(f"schema_version {version!r} is not compatible with {SCHEMA_VERSION}")


def assert_compatible(version: str) -> None:
    """S8: readers ignore unknown fields but must refuse a different major version."""
    match = _SEMVER.fullmatch(version)
    if match is None or int(match.group(1)) != _SCHEMA_MAJOR:
        raise IncompatibleSchemaVersionError(version)


def dump_json(model: BaseModel) -> str:
    return model.model_dump_json(exclude_none=True)
