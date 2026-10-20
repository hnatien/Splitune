"""`uv run splitune-eval <command>`

sets    [--check]                              list (and validate) the test-set registry
codec   IN OUT --codec {aac,opus} [--bitrate]  YouTube-style round-trip, loudness normalised
predict --task beats --set ID --out DIR        run the shipped stages on a set
score   --task T --set ID [--pred DIR]         score estimates; prints and writes a report
"""

from __future__ import annotations

import argparse
import shlex
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

from . import report
from .codec import CODECS, Codec, simulate
from .registry import TASKS, all_sets, load_set
from .tasks import score

HEADLINE = {
    "beats": "F-measure",
    "notes": "onset_f1",
    "chords": "majmin",
    "melody": "Raw Pitch Accuracy",
    "tab": "agreement",
}


def cmd_sets(args: argparse.Namespace) -> int:
    for tset in all_sets():
        present = tset.root_path.is_dir()
        count = len(tset.resolved_items()) if present else 0
        print(
            f"{tset.id:28} {','.join(tset.tasks):18} {tset.licence:14} "
            f"{count if present else 'root missing':>6}  {tset.description}"
        )
        if args.check and present and count == 0:
            print(f"error: {tset.id} resolves to no items", file=sys.stderr)
            return 1
    return 0


def cmd_codec(args: argparse.Namespace) -> int:
    simulate(Path(args.input), Path(args.output), cast(Codec, args.codec), args.bitrate)
    print(args.output)
    return 0


def cmd_predict(args: argparse.Namespace) -> int:
    from .predict import predict_beats  # loads torch; only needed here

    if args.task != "beats":
        print("predict: only the beats stage exists so far", file=sys.stderr)
        return 2
    run = predict_beats(
        load_set(args.set), Path(args.out), model=args.model, codec=args.codec, limit=args.limit
    )
    print(f"{len(run['items'])} items → {args.out} ({run['model']} on {run['device']})")
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    tset = load_set(args.set)
    result = score(
        args.task,
        tset,
        Path(args.pred) if args.pred else None,
        chunked_sdr=args.csdr,
        tab_mode=args.tab_mode,
    )
    extra: list[str] = []
    if args.pred and (Path(args.pred) / "predict.json").is_file():
        import json

        run = json.loads((Path(args.pred) / "predict.json").read_text(encoding="utf-8"))
        extra.append(
            f"Predictions: {run['model']} on {run['device']}, codec {run['codec'] or 'none'}"
        )
    extra += args.note or []
    command = "uv run splitune-eval " + shlex.join(sys.argv[1:])
    markdown = report.render(
        result, tset, command=command, headline=HEADLINE.get(args.task, ""), extra=extra
    )
    print(markdown)
    if not args.no_report:
        date = datetime.now(UTC).date().isoformat()
        path = (
            Path(args.report)
            if args.report
            else report.RESULTS_DIR / args.task / f"{date}-{tset.id}.md"
        )
        report.write(path, markdown, result)
        print(f"report: {path}")
    return 0


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="splitune-eval",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("sets", help="list the test-set registry")
    s.add_argument("--check", action="store_true", help="fail if a present set has no items")
    s.set_defaults(fn=cmd_sets)

    c = sub.add_parser("codec", help="codec round-trip")
    c.add_argument("input")
    c.add_argument("output")
    c.add_argument("--codec", choices=sorted(CODECS), required=True)
    c.add_argument("--bitrate", default="128k")
    c.set_defaults(fn=cmd_codec)

    pr = sub.add_parser("predict", help="run shipped stages on a set")
    pr.add_argument("--task", choices=["beats"], required=True)
    pr.add_argument("--set", required=True)
    pr.add_argument("--out", required=True)
    pr.add_argument("--model", choices=["final0", "small0"], default="final0")
    pr.add_argument("--codec", choices=sorted(CODECS))
    pr.add_argument("--limit", type=int)
    pr.set_defaults(fn=cmd_predict)

    sc = sub.add_parser("score", help="score estimates against references")
    sc.add_argument("--task", choices=TASKS, required=True)
    sc.add_argument("--set", required=True)
    sc.add_argument("--pred", help="directory of <item>.<suffix> estimates (not for tab)")
    sc.add_argument("--csdr", action="store_true", help="sep: also chunk-level SDR (slow)")
    sc.add_argument("--tab-mode", choices=["easiest", "as_played"], default="as_played")
    sc.add_argument("--report", help="Markdown path (default eval/results/<task>/<date>-<set>.md)")
    sc.add_argument("--no-report", action="store_true")
    sc.add_argument("--note", action="append", help="extra line for the report header")
    sc.set_defaults(fn=cmd_score)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main())
