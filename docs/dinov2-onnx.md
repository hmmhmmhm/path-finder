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
- int8 모델은 24.02 MiB로 Workers Assets 제한 안에 들어가지만, 공개 Git 저장소와 정적 자산 배포에 넣기에는 무겁습니다.
- 따라서 int8 모델은 Cloudflare R2 버킷 `path-finder-models`에 저장하고, Worker가 `/models/dinov2-small-embed-int8.onnx` 경로로 프록시합니다.
- 브라우저 ONNX Runtime Web WASM 추론은 복구 실험을 위해 다시 열어두었습니다. 타임아웃은 DINOv2-small만 180초로 둡니다.

## 브라우저 복구 검증

배포 URL에서 agent-browser로 실제 DINOv2-small 브라우저 추론을 검증했습니다.

```text
URL: https://path-finder.hmmhmmhm.workers.dev
모델: DINOv2-small 384D
모델 파일 위치: R2 프록시 /models/dinov2-small-embed-int8.onnx
결과 수: 5
첫 후보: coex-sample-01
측정 지연: 3863.0ms
```

이 값은 샘플 이미지 1장 기준이며, 모델 다운로드와 브라우저 캐시 상태에 따라 달라질 수 있습니다.

## R2 업로드

```bash
npm run models:dinov2 -- --runs 3
npm run models:r2:put
```

수동 명령은 다음과 같습니다.

```bash
npx wrangler r2 object put path-finder-models/models/dinov2-small-embed-int8.onnx \
  --file artifacts/models/dinov2-small-embed-int8.onnx \
  --content-type application/octet-stream \
  --remote
```

## 권장 사용 경로

DINOv2-small은 현재 구조에서 다음 위치에 두는 것이 적절합니다.

- 오프라인 지도 이미지 임베딩 생성
- 서버 또는 네이티브 앱에서 query 이미지 1장 임베딩 생성
- iPhone 앱으로 확장할 경우 Core ML 변환 후 Neural Engine 사용 검토

브라우저 CPU/WASM 직접 실행은 실험 경로로 유지합니다. 실제 코엑스 파일럿에서 안정적인 사용자 경험이 필요하면 서버 또는 네이티브 추론을 우선합니다.
