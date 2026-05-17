#!/usr/bin/env python3
"""Manifest self-query로 threshold grid를 sweep한다."""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "manifests" / "dinov2-gallery-manifest.json"
DEFAULT_OUTPUT = ROOT / "artifacts" / "reports" / "dinov2-threshold-sweep.json"


def parse_values(value: str) -> list[float]:
    return [float(item.strip()) for item in value.split(",") if item.strip()]


def normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(item * item for item in vector))
    if norm == 0:
        return vector
    return [item / norm for item in vector]


def dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def classify(top_score: float, margin: float, min_score: float, min_margin: float) -> str:
    if top_score < min_score:
        return "uncertain"
    if margin < min_margin:
        return "ambiguous"
    return "confident"


def build_rows(items: list[dict]) -> list[dict]:
    vectors = [(item, normalize(item["vector"])) for item in items]
    rows = []

    for query, query_vector in vectors:
        candidates = []
        for candidate, candidate_vector in vectors:
            candidates.append({"id": candidate["id"], "score": dot(query_vector, candidate_vector)})
        candidates.sort(key=lambda item: item["score"], reverse=True)
        top = candidates[0]
        second_score = candidates[1]["score"] if len(candidates) > 1 else 0.0
        rows.append(
            {
                "query": query["id"],
                "top1": top["id"],
                "top1MatchesSelf": top["id"] == query["id"],
                "topScore": round(top["score"], 6),
                "margin": round(top["score"] - second_score, 6),
            }
        )

    return rows


def summarize(rows: list[dict], min_score: float, min_margin: float) -> dict:
    levels = [classify(row["topScore"], row["margin"], min_score, min_margin) for row in rows]
    return {
        "minScore": min_score,
        "minMargin": min_margin,
        "top1SelfRecall": round(sum(row["top1MatchesSelf"] for row in rows) / len(rows), 4),
        "confident": levels.count("confident"),
        "ambiguous": levels.count("ambiguous"),
        "uncertain": levels.count("uncertain"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--score-values", default="0.68,0.72,0.76,0.8,0.84")
    parser.add_argument("--margin-values", default="0.02,0.04,0.05,0.08,0.1")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows = build_rows(manifest["items"])
    sweeps = [
        summarize(rows, min_score, min_margin)
        for min_score in parse_values(args.score_values)
        for min_margin in parse_values(args.margin_values)
    ]
    best = sorted(
        sweeps,
        key=lambda item: (
            -item["top1SelfRecall"],
            -item["confident"],
            item["ambiguous"],
            item["uncertain"],
            item["minScore"],
            item["minMargin"],
        ),
    )[0]

    report = {
        "manifest": str(args.manifest),
        "model": manifest["model"],
        "generatedAt": int(time.time()),
        "rows": rows,
        "sweeps": sweeps,
        "best": best,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
