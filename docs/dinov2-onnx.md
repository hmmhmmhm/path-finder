# DINOv2-small ONNX 실험

## 목적

DINOv2-small을 실제 검색 베이스라인으로 쓸 수 있는지 확인하기 위해 ONNX 변환, int8 동적 양자화, CPU 추론, Workers Assets 배포 가능성을 확인했습니다.

## 변환 명령

```bash
python3 scripts/export_dinov2_onnx.py --runs 3
```

스크립트는 `facebook/dinov2-small` 모델의 CLS 토큰을 384차원 임베딩으로 내보냅니다.

## 결과

```text
입력 크기: 224x224 RGB
출력 차원: 384
fp32 ONNX: 85.56 MiB
int8 ONNX: 24.02 MiB
Workers Assets 단일 파일 기준: 25 MiB
```

CPU ONNX Runtime 기준 측정값은 다음과 같습니다.

```text
fp32 median: 63.08ms
int8 median: 54.62ms
```

이 값은 로컬 네이티브 ONNX Runtime에서 더미 입력 1장을 넣었을 때의 순수 모델 실행 시간입니다. 브라우저 WASM, 이미지 디코딩, 전처리, 네트워크 시간을 포함하지 않습니다.

## 배포 판단

- fp32 모델은 Workers Assets에 올리기에는 큽니다.
- int8 모델은 24.02 MiB로 Workers Assets 제한 안에 들어가며 실제 배포 빌드에 포함할 수 있습니다.
- 다만 현재 브라우저 ONNX Runtime Web WASM에서는 DINOv2-small int8 추론이 30초 안에 안정적으로 끝나지 않았습니다.
- 그래서 프론트엔드에서는 DINOv2-small 선택지를 보여주되, 브라우저 추론은 비활성화했습니다.

## 권장 사용 경로

DINOv2-small은 현재 구조에서 다음 위치에 두는 것이 적절합니다.

- 오프라인 지도 이미지 임베딩 생성
- 서버 또는 네이티브 앱에서 query 이미지 1장 임베딩 생성
- iPhone 앱으로 확장할 경우 Core ML 변환 후 Neural Engine 사용 검토

브라우저 CPU/WASM만으로 사용자가 업로드한 이미지마다 DINOv2-small을 직접 실행하는 방식은 현재 단계에서는 권장하지 않습니다.
