#!/usr/bin/env python3
"""샘플 manifest로 top-K와 threshold 정책을 평가한다."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "manifests" / "dinov2-gallery-manifest.json"
DEFAULT_OUTPUT = ROOT / "artifacts" / "reports" / "dinov2-threshold-report.json"


def normalize(vector: list[float]) -> np.ndarray:
    array = np.asarray(vector, dtype=np.float32)
    norm = float(np.linalg.norm(array))
    if norm == 0:
        return array
    return array / norm


def confidence(top_score: float, second_score: float, min_score: float, min_margin: float) -> str:
    if top_score < min_score:
        return "uncertain"
    if top_score - second_score < min_margin:
        return "ambiguous"
    return "confident"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--min-score", type=float, default=0.72)
    parser.add_argument("--min-margin", type=float, default=0.05)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    items = manifest["items"]
    vectors = [(item, normalize(item["vector"])) for item in items]
    rows = []

    for query, query_vector in vectors:
        candidates = []
        for candidate, candidate_vector in vectors:
            score = float(np.dot(query_vector, candidate_vector))
            candidates.append({"id": candidate["id"], "label": candidate["label"], "score": score})
        candidates.sort(key=lambda item: item["score"], reverse=True)
        top = candidates[0]
        second = candidates[1] if len(candidates) > 1 else {"score": 0}
        rows.append(
            {
                "query": query["id"],
                "top1": top["id"],
                "top1MatchesSelf": top["id"] == query["id"],
                "topScore": round(top["score"], 6),
                "margin": round(top["score"] - second["score"], 6),
                "confidence": confidence(top["score"], second["score"], args.min_score, args.min_margin),
                "top5": [candidate["id"] for candidate in candidates[:5]],
            }
        )

    report = {
        "manifest": str(args.manifest.resolve().relative_to(ROOT)),
        "model": manifest["model"],
        "generatedAt": int(time.time()),
        "thresholds": {"minScore": args.min_score, "minMargin": args.min_margin},
        "count": len(rows),
        "top1SelfRecall": round(sum(row["top1MatchesSelf"] for row in rows) / len(rows), 4),
        "confidenceCounts": {
            level: sum(row["confidence"] == level for row in rows)
            for level in ["confident", "ambiguous", "uncertain"]
        },
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
