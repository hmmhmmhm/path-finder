import { handleSearchRequest } from "./api";
import { sampleGallery } from "./generated/sample-gallery";

type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/search") {
      return handleSearchRequest(request, sampleGallery);
    }

    return env.ASSETS.fetch(request);
  },
};
