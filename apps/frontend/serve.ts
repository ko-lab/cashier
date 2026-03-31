import { existsSync } from "node:fs";
import { join, normalize } from "node:path";

const distDir = join(import.meta.dir, "dist");
const port = Number(process.env.PORT ?? 4173);

if (!existsSync(distDir)) {
  console.error("Frontend build output not found at apps/frontend/dist. Run `bun run build` first.");
  process.exit(1);
}

const server = Bun.serve({
  port,
  development: false,
  fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const candidate = normalize(join(distDir, pathname));

    if (!candidate.startsWith(distDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(candidate);
    if (file.size > 0 || existsSync(candidate)) {
      return new Response(file);
    }

    return new Response(Bun.file(join(distDir, "index.html")));
  }
});

console.log(`Frontend server listening on http://localhost:${server.port}`);
