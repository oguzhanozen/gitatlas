import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), process.argv[2] ?? "out");
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const basePath = !rawBasePath || rawBasePath === "/" ? "" : `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`;
const requiredRoutes = ["", "learn", "assessments", "sandbox", "glossary", "real-terminal", "stats"];

async function assertFile(relativePath) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    throw new Error(`Statik export dosyası eksik: ${relativePath}`);
  }
}

for (const route of requiredRoutes) {
  await assertFile(route ? path.join(route, "index.html") : "index.html");
}
await assertFile("404.html");

async function findLessonHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = await findLessonHtml(absolute);
      if (found) return found;
    } else if (entry.name === "index.html" && path.dirname(absolute) !== path.join(root, "learn")) {
      return absolute;
    }
  }
}

const lessonHtml = await findLessonHtml(path.join(root, "learn"));
if (!lessonHtml) throw new Error("Doğrudan açılabilir statik ders rotası üretilmedi.");

for (const relativePath of ["index.html", path.join("learn", "index.html"), path.relative(root, lessonHtml)]) {
  const html = await readFile(path.join(root, relativePath), "utf8");
  const localUrls = [...html.matchAll(/(?:href|src)=["'](\/[^"']*)["']/g)].map(match => match[1]);
  if (basePath) {
    const invalid = localUrls.find(url => url !== basePath && !url.startsWith(`${basePath}/`));
    if (invalid) throw new Error(`${relativePath} basePath dışında yerel URL içeriyor: ${invalid}`);
  }
  const expectedAssetRoot = `${basePath}/_next/`;
  if (!localUrls.some(url => url.startsWith(expectedAssetRoot))) {
    throw new Error(`${relativePath} beklenen Next.js asset kökünü içermiyor: ${expectedAssetRoot}`);
  }
}

console.log(`Statik export doğrulandı: ${root} (basePath: ${basePath || "/"})`);
