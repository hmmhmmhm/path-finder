import io
import unittest

from fastapi.testclient import TestClient
from PIL import Image

from services.embed_api.main import create_app


class FakeEmbedder:
    model_id = "fake-model"
    dimensions = 3

    def embed(self, image):
        self.size = image.size
        return [1.0, 0.0, 0.0]


def png_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (2, 3), color=(255, 0, 0)).save(output, format="PNG")
    return output.getvalue()


class EmbedApiTest(unittest.TestCase):
    def test_embed_endpoint_returns_embedding_contract(self):
        fake = FakeEmbedder()
        app = create_app({"fake-model": fake})
        client = TestClient(app)

        response = client.post(
            "/embed",
            data={"modelId": "fake-model"},
            files={"image": ("query.png", png_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(fake.size, (2, 3))
        body = response.json()
        self.assertEqual(body["modelId"], "fake-model")
        self.assertEqual(body["dimensions"], 3)
        self.assertEqual(body["embedding"], [1.0, 0.0, 0.0])
        self.assertIsInstance(body["timings"]["preprocessMs"], float)
        self.assertIsInstance(body["timings"]["inferenceMs"], float)

    def test_embed_endpoint_rejects_unknown_model(self):
        app = create_app({})
        client = TestClient(app)

        response = client.post(
            "/embed",
            data={"modelId": "missing"},
            files={"image": ("query.png", png_bytes(), "image/png")},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "지원하지 않는 modelId입니다.")


if __name__ == "__main__":
    unittest.main()
