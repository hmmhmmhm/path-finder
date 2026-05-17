# DINO 모델 변형 검토

## 현재 사용 모델

```text
facebook/dinov2-small
입력: 224x224
출력: 384D CLS embedding
ONNX int8: 24.02 MiB
브라우저 WASM 추론: 약 0.36-0.38초
네이티브 CPU 추론: 약 35-55ms
```

## fp32 vs int8

로컬 ONNX Runtime 기준:

```text
fp32 크기: 85.56 MiB
int8 크기: 24.02 MiB
fp32 median: 63.08ms
int8 median: 54.62ms
```

int8은 크기와 속도 모두 유리합니다. 현재 브라우저/R2 기본 모델은 int8을 유지합니다.

## DINOv2-base

장점:

- 더 큰 표현력
- 실제 장소 구분 정확도가 좋아질 가능성

단점:

- 모델 크기와 브라우저 추론 비용이 크게 증가
- Vectorize 차원도 증가
- 스캔 전 샘플 단계에서는 과합니다.

## DINOv3 계열

DINOv3는 후보로 남기되, 현재 구현 기준선에서는 제외합니다. 모델 크기, 라이선스, ONNX/WebGPU 호환성, Core ML 변환 가능성을 별도 확인해야 합니다.

## 현재 결정

스캔 전 단계에서는 DINOv2-small int8을 유지합니다. 모델 변경보다 먼저 할 일은 평가셋, threshold, rerank, 메타데이터 구조를 안정화하는 것입니다.
