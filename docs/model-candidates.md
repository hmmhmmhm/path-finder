# 소형 이미지 임베딩 모델 후보

## 목적

코엑스 내부 위치추정의 1차 후보 검색 모델을 DINOv2-small 하나로 고정하지 않고, 더 빠르거나 모바일에 적합한 모델을 비교합니다.

## 현재 기준선

```text
모델: DINOv2-small int8 ONNX
파일 크기: 24.02 MiB
출력 차원: 384
입력 크기: 224x224
브라우저 WASM 첫 실행: 4351.5ms
브라우저 WASM 세션 재사용 추론: 361.4ms
네이티브 CPU ONNX 추론: 54.6ms
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
- MobileCLIP2 ONNX S0 공개 변환본은 vision 크기가 43MB로, 현재 DINO int8 24MB보다 파일 자체는 큽니다.

출처:

- https://huggingface.co/apple/MobileCLIP-S0
- https://arxiv.org/abs/2311.17049

## 후보 2: MobileCLIP2-S0 ONNX

`plhery/mobileclip2-onnx`는 Transformers.js용 ONNX 변환본을 제공합니다. 모델 카드 기준 S0 vision 모델은 43MB, embedding 차원은 512, 입력 크기는 256x256입니다. WebGPU 또는 WASM 사용 예시도 같이 제공합니다.

장점:

- 이미 ONNX와 Transformers.js 사용 예시가 있습니다.
- WebGPU/WASM 비교 실험을 빠르게 시작할 수 있습니다.
- embedding이 L2 정규화 전 출력으로 제공되어 현재 cosine 검색 구조와 맞습니다.

주의점:

- S0도 43MB라 R2 배포가 필요합니다.
- 현재 코드의 raw ONNX Runtime 경로와 Transformers.js 경로 중 어느 쪽으로 통합할지 결정해야 합니다.
- Apple 라이선스와 변환본 신뢰성을 별도로 확인해야 합니다.

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

출처:

- https://huggingface.co/docs/transformers/model_doc/siglip

## 우선순위

1. 현재 DINOv2-small WASM 경로를 기준선으로 유지합니다.
2. MobileCLIP-S0를 1순위 소형 후보로 둡니다.
3. MobileCLIP2-S0 ONNX는 빠른 브라우저 실험 후보로 둡니다.
4. SigLIP은 semantic 검색 비교 후보로 두되, 파일 크기와 추론 비용을 확인한 뒤 진행합니다.

## 다음 실험

MobileCLIP-S0 또는 MobileCLIP2-S0 중 하나를 골라 다음 항목을 DINO와 같은 표로 비교합니다.

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
