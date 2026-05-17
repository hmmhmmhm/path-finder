import { handleSearchRequest } from "./api";
import { createLocalSearchBackend, createVectorizeSearchBackend, type VectorizeIndex } from "./backends";
import { sampleGallery } from "./generated/sample-gallery";

type Env = {
  VECTORIZE?: VectorizeIndex;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/search") {
      const backend = env.VECTORIZE
        ? createVectorizeSearchBackend(env.VECTORIZE)
        : createLocalSearchBackend(sampleGallery);
      return handleSearchRequest(request, backend);
    }

    return env.ASSETS.fetch(request);
  },
};
