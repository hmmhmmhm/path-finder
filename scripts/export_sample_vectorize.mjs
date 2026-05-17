import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "public", "gallery", "index.json");
const targetPath = join(root, "data", "vectorize", "sample-gallery.ndjson");

const gallery = JSON.parse(await readFile(sourcePath, "utf8"));
const lines = gallery.map((item) =>
  JSON.stringify({
    id: item.id,
    values: item.vector,
    metadata: {
      label: item.label,
      floor: item.floor,
      zone: item.zone,
      x: item.x,
      y: item.y,
      imagePath: item.imagePath,
    },
  }),
);

await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Vectorize 샘플 NDJSON 생성: ${targetPath}`);
