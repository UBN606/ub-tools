"""Unit tests for audio/align.py internals. Run: pytest audio/tests/test_align.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from align import align_tokens, enforce_monotonic, normalize_word, strip_markup, tokenize_surface


def test_normalize_word():
    assert normalize_word("Father,") == "father"
    assert normalize_word("“Father”") == "father"
    assert normalize_word("first—hand") == "first hand"
    assert normalize_word("well-known") == "well known"
    assert normalize_word("606") == "606"
    assert normalize_word("...") == ""
    assert normalize_word("don't") in ("dont", "don t")


def test_tokenize_surface_compounds():
    # em-dash compounds expand to multiple tokens (token-level alignment)
    assert tokenize_surface("God—God-seeking.") == ["god", "god", "seeking"]
    assert tokenize_surface("first-hand") == ["first", "hand"]


def test_strip_markup():
    assert strip_markup("the <sup>th</sup> day*") == "the th day"
    assert strip_markup("  a   b  ") == "a b"


def _w(norms, t0=0.0, step=0.4):
    return [(n, round(t0 + i * step, 3), round(t0 + (i + 1) * step, 3)) for i, n in enumerate(norms)]


def test_exact_alignment():
    timed = align_tokens(["the", "universal", "father"], _w(["the", "universal", "father"]))
    assert [(s, e, x) for s, e, x in timed] == [
        (0.0, 0.4, True), (0.4, 0.8, True), (0.8, 1.2, True)]


def test_compound_split_across_transcription_tokens():
    # book token stream for "God—God-seeking." vs whisper's "god, god seeking"
    timed = align_tokens(["god", "god", "seeking"],
                         _w(["god", "god", "seeking"], t0=5.0))
    assert all(x for _, _, x in timed)
    assert timed[0][0] == 5.0 and timed[2][1] == 6.2


def test_replace_interpolates_proportionally():
    timed = align_tokens(["the", "deity"], _w(["the", "diety"]))
    assert timed[0][2] is True
    assert timed[1][2] is False
    assert timed[1][0] >= timed[0][1]  # monotonic


def test_delete_interpolates_between_neighbors():
    timed = align_tokens(["a", "b", "c"], _w(["a", "c"]))
    s, e, x = timed[1]
    assert x is False
    assert timed[0][1] <= s <= e <= timed[2][0]


def test_insert_ignored():
    # whisper-only words (spoken section titles) don't shift book timings
    timed = align_tokens(["alpha", "beta"], _w(["alpha", "spoken", "title", "beta"]))
    assert timed[0][:2] == (0.0, 0.4)
    assert timed[1][0] >= 0.4


def test_monotonic_non_overlap_enforced():
    w = [("a", 5.0, 5.4), ("b", 1.0, 1.4), ("c", 1.4, 1.8), ("d", 1.8, 2.2)]
    timed = enforce_monotonic(align_tokens(["a", "b", "c", "d"], w))
    for (s1, e1, _), (s2, e2, _) in zip(timed, timed[1:]):
        assert s2 >= e1 and e2 >= s2


def test_all_tokens_get_times():
    timed = align_tokens(["x", "y", "z"], [])  # empty transcript: degenerate but total
    assert len(timed) == 3
    assert all(isinstance(s, float) and isinstance(e, float) for s, e, _ in timed)
