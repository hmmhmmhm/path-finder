# 소형 이미지 임베딩 모델 후보

## 목적

코엑스 내부 위치추정의 1차 후보 검색 모델을 DINOv2-small 하나로 고정하지 않고, 더 빠르거나 모바일에 적합한 모델을 비교합니다.

## 실제 샘플 벤치마크

다음 명령으로 후보 모델을 같은 샘플 갤러리와 query 이미지에 대해 비교했습니다.

```bash
/tmp/path-finder-ml-venv/bin/python scripts/benchmark_candidate_models.py \
  --models dinov2-small mobileclip-s0 mobileclip2-s0-onnx siglip-base
```

입력 데이터는 `public/gallery` 8장과 `public/samples/query-starfield-north.jpg`입니다.

| 모델 | 크기 | 차원 | 네이티브 CPU median | query top-1 | 브라우저 판단 |
|---|---:|---:|---:|---|---|
| DINOv2-small int8 ONNX | 24.02 MiB | 384 | 35.17ms | coex-sample-06 | 사용 가능 |
| MobileCLIP-S0 PyTorch | 205.93 MiB | 512 | 112.87ms | coex-sample-01 | ONNX 변환 전 |
| MobileCLIP2-S0 ONNX | 43.45 MiB | 512 | 37.03ms | coex-sample-01 | 브라우저 WASM 130초 이상 미완료 |
| SigLIP base patch16 224 | 775.02 MiB | 768 | 127.44ms | coex-sample-06 | 너무 큼 |

샘플 query는 `coex-sample-01` 계열이 기대 후보입니다. 이 작은 샘플셋에서는 MobileCLIP-S0와 MobileCLIP2-S0가 top-1을 맞췄고, DINOv2-small과 SigLIP base는 top-2에 `coex-sample-01`을 반환했습니다.

이 결과는 실제 코엑스 데이터셋 정확도가 아니라 “현재 후보가 파이프라인에 들어갈 수 있는지”와 “샘플 query에서 어떤 순위를 내는지”를 확인한 것입니다.

핵심 후보만 같은 경로로 다시 비교하는 명령:

```bash
npm run benchmark:core-models
```

현재 core-models 결과:

| 모델 | 크기 | 차원 | CPU median | query top-1 | 판단 |
|---|---:|---:|---:|---|---|
| DINOv2-small | 24.02 MiB | 384 | 37.79ms | coex-sample-06 | 기준선 유지 |
| MobileCLIP2-S0 ONNX | 43.45 MiB | 512 | 32.04ms | coex-sample-01 | 서버/네이티브 후보 우선 |

이 샘플에서는 MobileCLIP2-S0가 더 빠르고 기대 top-1을 맞췄습니다. 다만 브라우저 WASM에서는 완료 시간이 길었으므로 서버/네이티브 후보로 둡니다.

## 현재 기준선

```text
모델: DINOv2-small int8 ONNX
파일 크기: 24.02 MiB
출력 차원: 384
입력 크기: 224x224
브라우저 WASM 첫 실행: 3512.5ms
브라우저 WASM 세션 재사용 추론: 369.8ms
네이티브 CPU 후보 벤치 median: 35.17ms
```

## 후보 1: MobileCLIP-S0

Apple의 MobileCLIP-S0는 MobileCLIP 계열의 가장 작은 모델입니다. Hugging Face 모델 카드 기준 이미지 인코더 파라미터는 11.4M이고, 이미지+텍스트 지연시간은 `1.5ms + 1.6ms`로 표시됩니다. 같은 표에서 S0는 OpenAI ViT-B/16과 비슷한 zero-shot 성능을 더 빠르고 작게 달성하는 후보로 설명됩니다.

장점:

- 모바일/온디바이스 지연시간을 목표로 설계됐습니다.
- 이미지 임베딩 모델로 직접 사용할 수 있습니다.
- 코엑스 앱이 iOS 네이티브로 갈 경우 Core ML 후보가 됩니다.

주의점:

- Apple 라이선스 조건을 확인해야 합니다.
- 공식 체크포인트는 PyTorch이며, 우리 파이프라인에 맞는 ONNX export 검증이 필요합니다.
- 공식 PyTorch 체크포인트는 205.93 MiB로 브라우저 직접 배포에는 부적합합니다.

출처:

- https://huggingface.co/apple/MobileCLIP-S0
- https://arxiv.org/abs/2311.17049

## 후보 2: MobileCLIP2-S0 ONNX

`plhery/mobileclip2-onnx`는 Transformers.js용 ONNX 변환본을 제공합니다. 모델 카드 기준 S0 vision 모델은 43MB, embedding 차원은 512, 입력 크기는 256x256입니다. WebGPU 또는 WASM 사용 예시도 같이 제공합니다.

장점:

- 이미 ONNX와 Transformers.js 사용 예시가 있습니다.
- WebGPU/WASM 비교 실험을 빠르게 시작할 수 있습니다.
- embedding이 L2 정규화 전 출력으로 제공되어 현재 cosine 검색 구조와 맞습니다.
- 네이티브 ONNX Runtime CPU에서는 median 37.03ms로 빠르게 동작했습니다.
- 샘플 query top-1은 `coex-sample-01`로 기대 후보를 맞췄습니다.

주의점:

- S0도 43MB라 R2 배포가 필요합니다.
- 현재 코드의 raw ONNX Runtime 경로와 Transformers.js 경로 중 어느 쪽으로 통합할지 결정해야 합니다.
- Apple 라이선스와 변환본 신뢰성을 별도로 확인해야 합니다.
- 브라우저 WASM에서는 agent-browser 검증 기준 130초 이상 완료되지 않았습니다. 그래서 UI에는 실험 모델로 남기되 자동 실행은 껐습니다.

출처:

- https://huggingface.co/plhery/mobileclip2-onnx

## 후보 3: SigLIP base/small 계열

SigLIP은 CLIP과 비슷한 이미지-텍스트 모델이며, Hugging Face Transformers에서 `google/siglip-base-patch16-224` 예시가 제공됩니다. 문서에 따르면 SigLIP은 pairwise sigmoid loss를 사용하고, 이미지와 텍스트 인코더로 representation을 생성합니다.

장점:

- 장소/간판/텍스트 분위기 같은 semantic 검색에 강할 가능성이 있습니다.
- Hugging Face Transformers 지원이 좋습니다.

주의점:

- base급 모델은 DINOv2-small보다 작다고 보기 어렵습니다.
- 이미지 위치추정에서는 semantic 유사도만 높고 기하적으로 헷갈릴 수 있습니다.
- 소형 ONNX 변환본을 별도 검증해야 합니다.
- 현재 base 체크포인트는 775.02 MiB로 R2/브라우저 실험 대상에서 제외합니다.

출처:

- https://huggingface.co/docs/transformers/model_doc/siglip

## 우선순위

1. 현재 DINOv2-small WASM 경로를 브라우저 기준선으로 유지합니다.
2. MobileCLIP2-S0 ONNX는 서버/네이티브 후보로 유지합니다. 브라우저 WASM은 현재 제외합니다.
3. MobileCLIP-S0는 ONNX/Core ML 변환 후보로 남깁니다.
4. SigLIP base는 너무 커서 제외하고, 더 작은 SigLIP 변형이 확인될 때만 재검토합니다.

## 다음 실험

다음 실험은 MobileCLIP-S0의 Core ML 또는 경량 ONNX 변환입니다.

```text
파일 크기
출력 차원
입력 크기
브라우저 WASM 시간
브라우저 WebGPU 시간
네이티브 CPU 시간
샘플 top-1/top-5 결과
Vectorize 인덱스 차원
```
