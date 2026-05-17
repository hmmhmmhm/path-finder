import type { SearchBackend } from "./backends";

type SearchRequestBody = {
  embedding?: unknown;
  topK?: unknown;
};

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

function parseEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const embedding = value.map(Number);
  if (embedding.some((item) => !Number.isFinite(item))) {
    return null;
  }
  return embedding;
}

export async function handleSearchRequest(
  request: Request,
  backend: SearchBackend,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "POST 요청만 지원합니다." }, { status: 405 });
  }

  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return json({ error: "JSON 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const embedding = parseEmbedding(body.embedding);
  if (!embedding) {
    return json({ error: "embedding 배열이 필요합니다." }, { status: 400 });
  }

  const requestedTopK = typeof body.topK === "number" ? body.topK : 5;
  const topK = Math.min(Math.max(Math.trunc(requestedTopK), 1), 20);

  try {
    return json({
      topK,
      backend: backend.name,
      results: await backend.search(embedding, topK),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다." },
      { status: 400 },
    );
  }
}
