import { handleSearchRequest } from "./api";
import { createLocalSearchBackend, createVectorizeSearchBackend, type VectorizeIndex } from "./backends";
import { sampleGallery } from "./generated/sample-gallery";

type Env = {
  VECTORIZE?: VectorizeIndex;
  VECTORIZE_SAMPLE?: VectorizeIndex;
  VECTORIZE_DINOV2?: VectorizeIndex;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
