import { handleSearchRequest } from "./api";
import { createLocalSearchBackend, createVectorizeSearchBackend, type VectorizeIndex } from "./backends";
import { sampleGallery } from "./generated/sample-gallery";

const R2_MODEL_PATHS = new Set([
  "/models/dinov2-small-embed-int8.onnx",
  "/models/mobileclip2-s0-vision.onnx",
]);

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
  VECTORIZE_MOBILECLIP2?: VectorizeIndex;
  MODEL_BUCKET?: R2Bucket;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

async function serveModelFromR2(pathname: string, env: Env): Promise<Response> {
  const object = await env.MODEL_BUCKET?.get(pathname.slice(1));
  if (!object) {
    return new Response("모델을 R2에서 찾을 수 없습니다.", { status: 404 });
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

    if (R2_MODEL_PATHS.has(url.pathname)) {
      return serveModelFromR2(url.pathname, env);
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
        ...(env.VECTORIZE_MOBILECLIP2
          ? { "mobileclip2-s0-onnx-v1": createVectorizeSearchBackend(env.VECTORIZE_MOBILECLIP2) }
          : {}),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
