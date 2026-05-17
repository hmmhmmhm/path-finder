import { handleSearchRequest } from "./api";
import { createLocalSearchBackend, createVectorizeSearchBackend, type VectorizeIndex } from "./backends";
import { sampleGallery } from "./generated/sample-gallery";

const DINO_MODEL_PATH = "/models/dinov2-small-embed-int8.onnx";
const DINO_MODEL_R2_KEY = "models/dinov2-small-embed-int8.onnx";

type R2ObjectBody = {
  body: ReadableStream;
  writeHttpMetadata(headers: Headers): void;
};

type R2Bucket = {
  get(key: string): Promise<R2ObjectBody | null>;
};

type Env = {
  VECTORIZE?: VectorizeIndex;
  VECTORIZE_SAMPLE?: VectorizeIndex;
  VECTORIZE_DINOV2?: VectorizeIndex;
  MODEL_BUCKET?: R2Bucket;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

async function serveDinoModelFromR2(env: Env): Promise<Response> {
  const object = await env.MODEL_BUCKET?.get(DINO_MODEL_R2_KEY);
  if (!object) {
    return new Response("DINOv2 모델을 R2에서 찾을 수 없습니다.", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-type", headers.get("content-type") ?? "application/octet-stream");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === DINO_MODEL_PATH) {
      return serveDinoModelFromR2(env);
    }

    if (url.pathname === "/api/search") {
      const sampleIndex = env.VECTORIZE_SAMPLE ?? env.VECTORIZE;
      return handleSearchRequest(request, {
        "tiny-sample-v1": sampleIndex
          ? createVectorizeSearchBackend(sampleIndex)
          : createLocalSearchBackend(sampleGallery),
        ...(env.VECTORIZE_DINOV2
          ? { "dinov2-small-v1": createVectorizeSearchBackend(env.VECTORIZE_DINOV2) }
          : {}),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
