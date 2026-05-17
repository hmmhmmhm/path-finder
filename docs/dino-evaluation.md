# DINO 평가와 판정 정책

## 현재 구성

DINOv2-small은 현재 브라우저/Worker/R2/Vectorize까지 연결된 기준선 모델입니다.

```text
모델: DINOv2-small int8 ONNX
차원: 384
모델 위치: R2 path-finder-models/models/dinov2-small-embed-int8.onnx
검색 인덱스: Vectorize path-finder-dinov2-small
브라우저 백엔드: WASM
```

## 신뢰도 정책

API는 top-K 검색 결과에 `confidence`를 포함합니다.

```text
uncertain: top-1 score < 0.72
ambiguous: top-1 score >= 0.72 이지만 top-1/top-2 margin < 0.05
confident: top-1 score >= 0.72 이고 margin >= 0.05
```

이 정책은 위치를 무리하게 확정하지 않기 위한 초기 정책입니다. 실제 코엑스 데이터에서는 threshold sweep으로 다시 보정해야 합니다.

## 샘플 threshold 리포트

명령:

```bash
python3 scripts/evaluate_thresholds.py \
  --manifest data/manifests/dinov2-gallery-manifest.json \
  --output artifacts/reports/dinov2-threshold-report.json
```

현재 샘플 self-query 결과:

```text
count: 8
top1SelfRecall: 1.0
confident: 0
ambiguous: 8
uncertain: 0
```

top-1은 모두 자기 자신을 찾지만, top-1/top-2 margin이 모두 0.05보다 작습니다. 샘플 이미지들이 서로 너무 비슷하다는 뜻이며, 실제 사용자에게는 단일 위치 확정보다 다중 후보를 반환하는 쪽이 맞습니다.

## Threshold sweep

여러 threshold 조합은 다음 명령으로 비교합니다.

```bash
npm run sweep:thresholds
```

현재 샘플 sweep 결과의 best 후보:

```text
minScore: 0.68
minMargin: 0.02
top1SelfRecall: 1.0
confident: 1
ambiguous: 7
uncertain: 0
```

기본 정책인 `minScore 0.72`, `minMargin 0.05`보다 낮춰도 대부분 ambiguous입니다. 샘플셋에서는 DINO 전역 임베딩의 margin이 낮다는 결론이 유지됩니다.

## Query/Gallery 분리 평가

사용자 이미지 1장을 따로 두고, 미리 임베딩한 갤러리와 비교하는 경로도 확인했습니다.

명령:

```bash
python3 scripts/benchmark_candidate_models.py \
  --models dinov2-small \
  --output artifacts/benchmarks/dinov2-query-gallery.json
```

현재 결과:

```text
query: public/samples/query-starfield-north.jpg
expectedTop1: coex-sample-01
top1: coex-sample-06
top2: coex-sample-01
top1Score: 0.935385
top2Score: 0.932913
margin: 0.002472
medianEmbedMs: 37.52
```

기대 샘플은 2위까지 올라오지만, top-1과 top-2 점수 차가 매우 작습니다. 따라서 DINO 전역 임베딩만으로는 후보 검색 단계까지 맡기고, 최종 위치 확정은 로컬 매칭 또는 2D-3D 검증을 붙이는 쪽이 맞습니다.

## Rerank 준비

스캔 전 단계에서는 2D-3D PnP까지 가지 않고 이미지-이미지 로컬 매칭만 확인합니다.

명령:

```bash
python3 scripts/rerank_orb.py \
  --query public/samples/query-starfield-north.jpg \
  --gallery public/gallery \
  --output artifacts/reports/orb-rerank-report.json
```

현재 ORB/RANSAC top-K:

```text
1. coex-sample-04
2. coex-sample-01
3. coex-sample-06
4. coex-sample-03
5. coex-sample-02
```

`coex-sample-01`은 2위입니다. ORB만으로 최종 판정을 내리기에는 부족하지만, DINO top-K 후보를 로컬 매칭 점수로 다시 보는 구조는 유효합니다.

SIFT/RANSAC도 CPU-only rerank 후보로 추가했습니다.

```bash
npm run rerank:sift
```

현재 SIFT/RANSAC top-K:

```text
1. coex-sample-03
2. coex-sample-01
3. coex-sample-05
4. coex-sample-07
5. coex-sample-08
```

SIFT도 기대 후보를 2위에 올리지만 단독 최종 판정에는 부족합니다. 다음 단계는 DINO 또는 MobileCLIP2 top-K 안에서만 SIFT/LightGlue 계열을 적용해 오탐을 줄이는 것입니다.

## 다음 기준

스캔 전에는 다음 자동 리포트를 유지합니다.

- top-1/top-5 recall
- confidence 분포
- top-1/top-2 margin 분포
- ORB/RANSAC inlier 분포
- SIFT/RANSAC inlier 분포
- 모델별 CPU/브라우저 추론 시간
