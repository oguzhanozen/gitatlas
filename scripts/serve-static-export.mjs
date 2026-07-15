import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "out");
const basePath = "/gitatlas";
const port = Number(process.env.PORT ?? 4173);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"], [".txt", "text/plain; charset=utf-8"], [".woff2", "font/woff2"],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (url.pathname === basePath) {
      response.writeHead(308, { location: `${basePath}/` }); response.end(); return;
    }
    if (!url.pathname.startsWith(`${basePath}/`)) {
      response.writeHead(404); response.end("Not found"); return;
    }
    const relative = decodeURIComponent(url.pathname.slice(basePath.length)).replace(/^\/+/, "");
    let file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(400); response.end("Invalid path"); return;
    }
    let details = await stat(file).catch(() => null);
    if (details?.isDirectory()) { file = path.join(file, "index.html"); details = await stat(file).catch(() => null); }
    if (!details?.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, { "content-type": contentTypes.get(path.extname(file)) ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(400); response.end("Bad request");
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Static export: http://127.0.0.1:${port}${basePath}/`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
