import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), process.argv[2] ?? "out");
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const basePath = !rawBasePath || rawBasePath === "/" ? "" : `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`;
const requiredRoutes = ["", "learn", "assessments", "sandbox", "glossary", "real-terminal", "stats"];
const expectedLessonCount = 29;

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

const lessonEntries = await readdir(path.join(root, "learn"), { withFileTypes: true });
const lessonDirectories = lessonEntries.filter(entry => entry.isDirectory() && !entry.name.startsWith("__next.")).map(entry => entry.name).sort();
const prerenderManifest = JSON.parse(await readFile(path.resolve(process.cwd(), ".next", "prerender-manifest.json"), "utf8"));
const expectedLessonDirectories = Object.keys(prerenderManifest.routes).filter(route => /^\/learn\/[^/]+$/.test(route)).map(route => route.slice("/learn/".length)).sort();
if (lessonDirectories.length !== expectedLessonCount) {
  throw new Error(`Statik ders rotası sayısı ${lessonDirectories.length}; beklenen ${expectedLessonCount}.`);
}
if (JSON.stringify(lessonDirectories) !== JSON.stringify(expectedLessonDirectories)) {
  throw new Error("Statik ders dosyaları prerender edilen ders rotalarıyla birebir eşleşmiyor.");
}
for (const slug of lessonDirectories) {
  if (/%2f|%|[\\/]/i.test(slug)) throw new Error(`Güvensiz statik ders slug'ı: ${slug}`);
  await assertFile(path.join("learn", slug, "index.html"));
}

const lessonHtmlFiles = lessonDirectories.map(slug => path.join("learn", slug, "index.html"));

for (const relativePath of ["index.html", path.join("learn", "index.html"), ...lessonHtmlFiles]) {
  const html = await readFile(path.join(root, relativePath), "utf8");
  const localUrls = [...html.matchAll(/(?:href|src)=["'](\/[^"']*)["']/g)].map(match => match[1]);
  const encodedSlash = localUrls.find(url => /%2f/i.test(url));
  if (encodedSlash) throw new Error(`${relativePath} encoded slash içeren URL üretiyor: ${encodedSlash}`);
  if (basePath) {
    const invalid = localUrls.find(url => url !== basePath && !url.startsWith(`${basePath}/`));
    if (invalid) throw new Error(`${relativePath} basePath dışında yerel URL içeriyor: ${invalid}`);
  }
  const expectedAssetRoot = `${basePath}/_next/`;
  if (!localUrls.some(url => url.startsWith(expectedAssetRoot))) {
    throw new Error(`${relativePath} beklenen Next.js asset kökünü içermiyor: ${expectedAssetRoot}`);
  }
}

console.log(`Statik export doğrulandı: ${root} (${lessonDirectories.length} ders, basePath: ${basePath || "/"})`);
