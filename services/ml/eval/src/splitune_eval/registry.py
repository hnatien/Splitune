"""Test-set registry: `eval/sets/<id>.yaml` (08-evaluation-harness-and-prototypes.md §1).

Every set names its licence and provenance; loading fails without them. Audio and annotations
stay outside the repo, under `root` (default base `~/datasets`, overridable with
SPLITUNE_DATASETS_DIR). Items are listed explicitly or generated from a glob template:

    item_template:
      glob: annotation/*.jams        # relative to root
      match: "^0[0-5]_[A-Za-z]+1-"   # optional regex on the file stem
      id: "{stem}"
      audio: "audio_mono-mic/{stem}_mic.wav"
      annotations: {beats: "annotation/{stem}.jams"}
      tags: {style: "{suffix}"}       # {suffix} = text after the last "_"
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, cast

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

SETS_DIR = Path(__file__).resolve().parents[2] / "sets"
TASKS = ("beats", "notes", "chords", "sep", "melody", "tab")


class Item(BaseModel):
    id: str = Field(min_length=1)
    audio: str | None = None
    annotations: dict[str, str] = Field(default_factory=dict[str, str])
    tags: dict[str, str] = Field(default_factory=dict[str, str])


class ItemTemplate(BaseModel):
    glob: str
    match: str | None = None
    id: str = "{stem}"
    audio: str | None = None
    annotations: dict[str, str] = Field(default_factory=dict[str, str])
    tags: dict[str, str] = Field(default_factory=dict[str, str])


class TestSet(BaseModel):
    __test__ = False  # not a pytest class

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    description: str
    licence: str = Field(min_length=1)
    provenance: str = Field(min_length=1)
    root: str
    split: str = "test"
    tasks: list[str]
    tags: dict[str, str] = Field(default_factory=dict[str, str])
    items: list[Item] = Field(default_factory=list[Item])
    item_template: ItemTemplate | None = None

    @field_validator("tasks")
    @classmethod
    def _known_tasks(cls, tasks: list[str]) -> list[str]:
        unknown = sorted(set(tasks) - set(TASKS))
        if unknown:
            raise ValueError(f"unknown tasks {unknown}")
        return tasks

    @model_validator(mode="after")
    def _items_or_template(self) -> TestSet:
        if not self.items and self.item_template is None:
            raise ValueError("a set needs `items` or `item_template`")
        return self

    @property
    def root_path(self) -> Path:
        base = os.environ.get("SPLITUNE_DATASETS_DIR")
        root = self.root
        if base and root.startswith("~/datasets"):
            root = base + root.removeprefix("~/datasets")
        return Path(root).expanduser()

    def path(self, relative: str) -> Path:
        return self.root_path / relative

    def resolved_items(self) -> list[Item]:
        items = list(self.items)
        template = self.item_template
        if template is not None:
            pattern = re.compile(template.match) if template.match else None
            for file in sorted(self.root_path.glob(template.glob)):
                stem = file.stem
                if pattern is not None and not pattern.search(stem):
                    continue
                fields = {"stem": stem, "suffix": stem.rsplit("_", 1)[-1]}
                items.append(
                    Item(
                        id=template.id.format(**fields),
                        audio=template.audio.format(**fields) if template.audio else None,
                        annotations={
                            k: v.format(**fields) for k, v in template.annotations.items()
                        },
                        tags={k: v.format(**fields) for k, v in template.tags.items()},
                    )
                )
        ids = [i.id for i in items]
        if len(ids) != len(set(ids)):
            raise ValueError(f"set {self.id}: duplicate item ids")
        return items


def load_set(name: str) -> TestSet:
    """By id (eval/sets/<id>.yaml) or by path to a YAML file."""
    path = Path(name)
    if not path.suffix:
        path = SETS_DIR / f"{name}.yaml"
    data = cast(dict[str, Any], yaml.safe_load(path.read_text(encoding="utf-8")))
    return TestSet.model_validate(data)


def all_sets() -> list[TestSet]:
    return [load_set(str(p)) for p in sorted(SETS_DIR.glob("*.yaml"))]
