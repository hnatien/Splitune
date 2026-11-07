from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from splitune_eval import msst, scoring

RATE = 44100


def fixture() -> tuple[np.ndarray, np.ndarray]:
    """The fixture the expected MSST values were computed on (upstream utils/metrics.py @84b1eac,
    torch 2.14.1 + librosa 0.11.0 + torchaudio 2.11.0)."""
    rng = np.random.default_rng(28)
    n = RATE * 3
    t = np.arange(n) / RATE
    ref = np.stack([0.3 * np.sin(2 * np.pi * 220 * t), 0.25 * np.sin(2 * np.pi * 330 * t)])
    ref = ref * (1 + 0.5 * np.sin(2 * np.pi * 0.5 * t))
    est = 0.8 * ref + 0.05 * rng.normal(size=(2, n))
    est[:, : RATE // 2] *= 0.2
    return ref.T, est.T


def test_msst_port_matches_upstream_on_the_shared_fixture() -> None:
    ref, est = fixture()
    assert msst.sdr(ref, est) == pytest.approx(6.435094443940291, abs=1e-9)
    assert msst.si_sdr(ref, est) == pytest.approx(5.9211246903213794, abs=1e-9)
    bleedless, fullness = msst.bleed_full(ref, est)
    assert bleedless == pytest.approx(3.5677053928375244, rel=1e-5)
    assert fullness == pytest.approx(14.662025451660156, rel=1e-5)


def test_bleedless_and_fullness_separate_bleed_from_missing_energy() -> None:
    ref, _ = fixture()
    rng = np.random.default_rng(1)
    bled = ref + 0.05 * rng.normal(size=ref.shape)
    thinned = ref.copy()
    thinned[RATE : 2 * RATE] *= 0.01
    bleedy = msst.bleed_full(ref, bled)
    thin = msst.bleed_full(ref, thinned)
    assert bleedy[0] < thin[0]  # added energy costs bleedless
    assert thin[1] < bleedy[1]  # missing energy costs fullness
    assert msst.bleed_full(ref, ref) == (100.0, 100.0)


def test_si_sdr_ignores_the_estimate_gain_and_usdr_does_not() -> None:
    ref, est = fixture()
    assert msst.si_sdr(ref, 0.5 * est) == pytest.approx(msst.si_sdr(ref, est), abs=0.01)
    assert scoring.usdr(ref, 0.5 * est) < scoring.usdr(ref, est) - 1.0


def test_framewise_sdr_takes_the_median_and_skips_silent_reference_frames() -> None:
    rng = np.random.default_rng(2)
    ref = rng.normal(0, 0.1, (RATE * 5, 2))
    est = ref + rng.normal(0, 0.01, ref.shape)  # 20 dB everywhere
    est[:RATE] = ref[:RATE] + rng.normal(0, 0.1, (RATE, 2))  # one bad second: 0 dB
    ref[4 * RATE :] = 0.0
    est[4 * RATE :] = rng.normal(0, 0.1, (RATE, 2))  # output over a silent reference: skipped
    assert scoring.csdr(ref, est, RATE) == pytest.approx(20.0, abs=0.3)
    assert np.isnan(scoring.csdr(np.zeros((RATE, 2)), est[:RATE], RATE))


def test_a_silent_reference_is_scored_as_leakage_not_sdr() -> None:
    rng = np.random.default_rng(3)
    mixture = rng.normal(0, 0.1, (RATE * 2, 2))
    quiet = mixture * 10 ** (-45 / 20)  # -45 dB vs the mixture
    audible = mixture * 10 ** (-25 / 20)
    assert scoring.silent_reference(np.zeros_like(mixture), mixture)
    assert scoring.silent_reference(quiet, mixture)
    assert not scoring.silent_reference(audible, mixture)
    assert scoring.silent_reference(mixture * 1e-4, mixture * 1e-4)  # absolute floor
    bleed = mixture * 10 ** (-30 / 20)
    out = scoring.separation(np.zeros_like(mixture), bleed, mixture)
    assert out == {"silent": 1.0, "leakage_db": pytest.approx(-30.0, abs=0.01)}
    scored = scoring.separation(audible, audible, mixture)
    assert scored["silent"] == 0.0
    assert {"usdr", "si_sdr", "csdr", "bleedless", "fullness"} <= scored.keys()


def test_si_sar_charges_artifacts_but_not_interference() -> None:
    rng = np.random.default_rng(4)
    target = rng.normal(0, 0.1, (RATE, 2))
    other = rng.normal(0, 0.1, (RATE, 2))
    interference = target + 0.3 * other
    artifacts = target + 0.3 * rng.normal(0, 0.1, (RATE, 2))
    assert scoring.si_sar(target, interference, [other]) > 60.0
    assert scoring.si_sar(target, artifacts, [other]) == pytest.approx(10.46, abs=0.2)


def test_distribution_reports_spread_and_the_worst_items() -> None:
    values = [(f"c{i}", float(i)) for i in range(10)] + [("nan", float("nan"))]
    out = scoring.distribution(values)
    assert out["n"] == 10
    assert out["median"] == pytest.approx(4.5)
    assert out["mean"] == pytest.approx(4.5)
    assert out["p10"] == pytest.approx(0.9)
    assert out["worst"] == [("c0", 0.0), ("c1", 1.0), ("c2", 2.0)]
    assert scoring.distribution([])["n"] == 0


def test_p1_selection_uses_references_and_the_loudest_candidate_whatever_the_order() -> None:
    import p1  # pyright: ignore[reportMissingImports]

    clips = [f"c{i}" for i in range(6)]
    refs = {c: {"vocals": -20.0, "drums": -20.0, "bass": -20.0} for c in clips}
    refs["c0"]["vocals"] = -3.0  # loudest vocal reference
    refs["c1"]["vocals"] = -3.0  # tie with c0: clip id decides
    tags = {c: {"guitar": 0.5, "piano": 0.0} for c in clips}
    tags["c5"]["guitar"] = 0.01  # below the tagger floor
    energy = {
        "model_a": {c: {"guitar": -30.0} for c in clips},
        "model_b": {c: {"guitar": -30.0} for c in clips},
    }
    energy["model_a"]["c2"]["guitar"] = -5.0  # only model_a hears guitar here
    energy["model_b"]["c3"]["guitar"] = -6.0  # only model_b hears guitar here
    energy["model_b"]["c5"]["guitar"] = 0.0  # loudest, but the tagger doesn't hear it
    quota = {"guitar": 2, "vocals": 1}
    chosen = p1.select_clips(energy, refs, tags, quota)
    assert chosen == {"c2": "guitar", "c3": "guitar", "c0": "vocals"}
    flipped = {k: energy[k] for k in reversed(list(energy))}
    shuffled = {c: refs[c] for c in reversed(clips)}
    assert p1.select_clips(flipped, shuffled, tags, quota) == chosen


def test_window_boundaries_follow_the_roformer_demix() -> None:
    from splitune_eval import seams

    # step = chunk: windows abut; the last one is pulled back to end at the song's end
    assert seams.boundaries(100, 30, 30) == [30, 60, 70, 90]
    # step < chunk: every start and end inside the song
    assert seams.boundaries(50, 20, 15) == [15, 20, 30, 35]  # last start 45 -> pulled to 30


def test_a_click_at_every_boundary_raises_the_seam_ratio() -> None:
    from splitune_eval import seams

    rng = np.random.default_rng(5)
    ref = rng.normal(0, 0.1, (RATE * 20, 2))
    est = ref + rng.normal(0, 0.001, ref.shape)
    edges = list(range(2 * RATE, 19 * RATE, 2 * RATE))
    assert abs(seams.seam_ratio_db(ref, est, edges)) < 0.5
    clicked = est.copy()
    for e in edges:
        clicked[e - 20 : e + 20] += 0.05
    assert seams.seam_ratio_db(ref, clicked, edges) > 3.0


def test_moisesdb_windows_pick_the_loudest_target_from_references(tmp_path: Path) -> None:
    import json

    import p1_moisesdb  # pyright: ignore[reportMissingImports]
    import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]

    rng = np.random.default_rng(6)
    track = tmp_path / "src" / "moisesdb_v0.1" / "0123456789abcdef"
    frames = RATE * 40
    stems = {
        "drums": rng.normal(0, 0.05, (frames, 2)),
        "guitar": np.zeros((frames, 2)),
        "other_keys": rng.normal(0, 0.05, (frames - RATE * 3, 1)),  # mono, shorter, joins piano
    }
    stems["guitar"][RATE * 10 :] = rng.normal(0, 0.2, (frames - RATE * 10, 2))
    listed: list[dict[str, object]] = []
    for name, audio in stems.items():
        (track / name).mkdir(parents=True)
        sf.write(str(track / name / f"{name}1.wav"), audio, RATE)  # pyright: ignore[reportUnknownMemberType]
        track_entry = {"id": f"{name}1", "extension": "wav", "trackType": "x"}
        listed.append({"stemName": name, "tracks": [track_entry]})
    meta = {"artist": "A", "song": "S", "genre": "rock", "stems": listed}
    (track / "data.json").write_text(json.dumps(meta))
    out = tmp_path / "out"
    assert p1_moisesdb.main(["windows", "--source", str(tmp_path / "src"), "--out", str(out)]) == 0
    index = json.loads((out / "windows.json").read_text())["items"]
    assert set(index) == {"01234567-guitar", "01234567-piano"}
    assert index["01234567-guitar"]["start_s"] == 10.0  # loudest guitar window
    clip = out / "01234567-guitar"
    assert {p.stem for p in clip.glob("*.wav")} == {
        "mixture",
        "vocals",
        "drums",
        "bass",
        "guitar",
        "piano",
        "other",
    }
    parts = sum(
        sf.read(str(clip / f"{s}.wav"))[0]
        for s in ("vocals", "drums", "bass", "guitar", "piano", "other")
    )
    assert np.allclose(parts, sf.read(str(clip / "mixture.wav"))[0], atol=1e-6)
    assert (out / "clips" / "01234567-guitar.json").is_file()


def test_moisesdb_zip_members_are_read_from_their_compressed_bytes() -> None:
    import io
    import zipfile

    import p1_moisesdb  # pyright: ignore[reportMissingImports]
    import pytest

    blob = io.BytesIO()
    payload = bytes(range(256)) * 400
    with zipfile.ZipFile(blob, "w") as archive:
        archive.writestr("moisesdb/moisesdb_v0.1/t1/data.json", b'{"stems": []}')
        archive.writestr(
            "moisesdb/moisesdb_v0.1/t1/guitar/a.wav", payload, compress_type=zipfile.ZIP_DEFLATED
        )
    data = blob.getvalue()
    source = object.__new__(p1_moisesdb.ZipSource)
    source.members = {i.filename: i for i in zipfile.ZipFile(io.BytesIO(data)).infolist()}
    source.prefix = {"t1": "moisesdb/moisesdb_v0.1/t1"}
    source.fetch = lambda first, count: data[first : first + count]  # pyright: ignore[reportAttributeAccessIssue]
    assert source.read("t1", "guitar/a.wav") == payload
    assert source.meta("t1") == {"stems": []}
    corrupt = bytearray(data)
    start = data.index(b"guitar/a.wav") + len(b"guitar/a.wav") + 5
    corrupt[start] ^= 0xFF
    source.fetch = lambda first, count: bytes(corrupt[first : first + count])  # pyright: ignore[reportAttributeAccessIssue]
    with pytest.raises(Exception, match=r"CRC|invalid|incorrect"):
        source.read("t1", "guitar/a.wav")


def band() -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """Ten seconds of a drum-like and a bass-like stem with independent channels."""
    rng = np.random.default_rng(7)
    t = np.arange(RATE * 10) / RATE
    kicks = np.exp(-((t % 0.5) * 30))[:, None] * rng.normal(0, 0.4, (len(t), 2))
    bass = 0.3 * np.sin(2 * np.pi * 55 * t)[:, None] * np.ones((1, 2))
    stems = {"drums": kicks, "bass": bass}
    return kicks + bass, stems


def test_limiter_reaches_the_target_under_the_ceiling_and_keeps_stems_consistent() -> None:
    from splitune_eval import variants

    mixture, stems = band()
    v = variants.apply("limit-XL", mixture, stems)
    assert v.info["lufs"] == pytest.approx(-6.0, abs=0.1)
    assert v.info["true_peak_dbtp"] <= -0.9
    assert np.allclose(sum(v.references.values()), v.mixture, atol=1e-9)
    louder = variants.apply("limit-L", mixture, stems)
    assert louder.info["lufs"] == pytest.approx(-8.0, abs=0.1)


def test_limiter_gain_never_exceeds_what_any_sample_needs() -> None:
    from splitune_eval import variants

    mixture, _ = band()
    boosted = mixture * 4.0
    gain = variants.limiter_gain(boosted)
    peaks = variants.true_peak_envelope(boosted * gain[:, None])
    assert float(peaks.max()) <= 10 ** (variants.CEILING_DBTP / 20) * 1.02
    assert float(gain.max()) <= 1.0


def test_mono_folds_mixture_and_references_alike() -> None:
    from splitune_eval import variants

    mixture, stems = band()
    v = variants.apply("mono", mixture, stems)
    assert np.allclose(v.mixture[:, 0], v.mixture[:, 1])
    assert np.allclose(sum(v.references.values()), v.mixture)


def test_alignment_undoes_a_codec_style_delay() -> None:
    from splitune_eval import variants

    mixture, _ = band()
    delayed = np.pad(mixture, ((1105, 0), (0, 0)))[: len(mixture)]
    aligned, lag = variants.align(mixture, delayed)
    assert lag == 1105
    assert np.allclose(aligned[:-1105], mixture[:-1105])


def test_official_musdb_xl_ratio_applies_to_stems_and_clips_only_the_mixture() -> None:
    from splitune_eval import variants

    mixture, stems = band()
    ratio = np.full_like(mixture, 3.0)
    v = variants.apply("musdb-xl", mixture, stems, xl_ratio=lambda: ratio)
    assert np.abs(v.mixture).max() <= 1.0
    assert np.allclose(v.references["bass"], 3.0 * stems["bass"])
    assert v.info["clipped_fraction"] > 0
