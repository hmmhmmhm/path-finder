# 브라우저 성능 벤치마크

## 목적

브라우저에서 query 이미지 1장을 임베딩하고 Vectorize 검색까지 끝나는 시간을 단계별로 분리합니다. 총 시간만 보면 모델 다운로드, ONNX 세션 생성, 실제 추론, API 지연이 섞이므로 병목을 판단하기 어렵습니다.

## 계측 항목

프론트엔드는 다음 값을 화면에 표시합니다.

```text
백엔드: wasm 또는 webgpu
모델 캐시: miss, hit, session reused
전처리: 이미지 디코딩/리사이즈/정규화
모델 로드: R2/HTTP/Cache API에서 ONNX bytes 확보
세션 생성: ONNX Runtime InferenceSession 생성
추론: session.run
API: /api/search Vectorize 검색
fallback: WebGPU 실패 시 WASM fallback 사유
```

## DINOv2-small WASM 결과

배포 URL에서 agent-browser로 `DINOv2-small 384D`를 선택해 측정했습니다.

```text
URL: https://path-finder.hmmhmmhm.workers.dev
모델: DINOv2-small
백엔드: wasm
결과 수: 5
첫 후보: coex-sample-01
```

최신 배포에서 첫 실행:

```text
전체: 3512.5ms
모델 캐시: miss
전처리: 3.0ms
모델 로드: 2223.4ms
세션 생성: 515.0ms
추론: 369.8ms
API: 223.1ms
```

같은 페이지에서 두 번째 실행:

```text
전체: 1545.4ms
모델 캐시: session reused
전처리: 5.4ms
모델 로드: 0.0ms
세션 생성: 0.0ms
추론: 361.4ms
API: 1174.9ms
```

두 번째 실행의 API 시간은 일시적인 네트워크 또는 Vectorize 지연으로 보입니다. 모델 측 병목은 세션 재사용 후 `추론 361.4ms` 수준으로 내려갔습니다.

페이지 새로고침 후 Cache API hit:

```text
전체: 1952.1ms
모델 캐시: hit
전처리: 2.1ms
모델 로드: 12.5ms
세션 생성: 476.7ms
추론: 381.4ms
API: 916.3ms
```

새 Worker에서는 ONNX 세션을 다시 만들어야 하지만, 모델 bytes는 Cache API에서 12.5ms에 읽혔습니다.

## WebGPU 실험 결과

WebGPU는 별도 프로필 `DINOv2-small WebGPU 실험`으로 분리했습니다.

초기 측정에서는 WebGPU 백엔드가 선택되고 추론까지 완료됐습니다.

```text
전체: 5131.6ms
모델 캐시: miss
모델 로드: 2625.5ms
세션 생성: 876.2ms
추론: 1237.4ms
API: 230.4ms
fallback: 없음
```

하지만 같은 브라우저 세션에서 반복 실행 시 agent-browser/Chrome이 응답하지 않는 현상이 재현됐습니다. 그래서 운영 기본 DINO 프로필은 WASM으로 되돌리고, WebGPU는 별도 Worker를 쓰는 실험 옵션으로만 유지합니다. WebGPU 옵션은 선택 즉시 자동 실행하지 않고, 사용자가 샘플 실행 버튼을 눌렀을 때만 실행합니다.

## 캐시 판단

현재 R2 모델 응답은 다음 헤더를 반환합니다.

```text
cache-control: public, max-age=31536000, immutable
content-type: application/octet-stream
```

브라우저 Worker는 Cache API의 `path-finder-models-v1` 캐시에 모델 응답을 저장합니다. 같은 Worker 세션에서는 ONNX 세션을 재사용하고, 새 Worker에서는 Cache API 또는 HTTP 캐시를 통해 모델 다운로드 시간을 줄이는 구조입니다.

## 현재 결론

- DINOv2-small 브라우저 WASM은 첫 실행이 약 4.3초, 세션 재사용 후 모델 추론은 약 0.36초까지 내려갑니다.
- WebGPU는 지원 경로를 붙였지만 현재 Chrome headless 검증에서 반복 안정성이 낮습니다.
- 코엑스 파일럿에서는 브라우저 DINO를 실험 경로로 두고, 운영 후보는 서버/네이티브/Core ML 추론을 계속 우선합니다.

## MobileCLIP2-S0 ONNX 브라우저 결과

MobileCLIP2-S0 ONNX는 네이티브 ONNX Runtime CPU에서는 median 37.03ms로 빨랐습니다. 하지만 같은 모델을 브라우저 WASM 경로에 연결해 agent-browser로 실행했을 때 130초 이상 검색 완료가 반환되지 않았습니다.

따라서 MobileCLIP2-S0 ONNX는 다음처럼 분류합니다.

```text
서버/네이티브 CPU 후보: 유지
브라우저 WASM 후보: 제외
UI 자동 실행: 비활성화
```

브라우저에서 다시 검토하려면 raw ONNX Runtime Web이 아니라 Transformers.js WebGPU 경로를 별도로 테스트해야 합니다.
