import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const root = process.cwd();
const result = await build({
  entryPoints: ["preview/main.ts"],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  target: "es2022",
  outdir: "portable",
  plugins: [
    {
      name: "portable-api",
      setup(b) {
        b.onResolve({ filter: /api$/ }, (args) => {
          if (args.importer.includes("/client/"))
            return { path: resolve(root, "preview/api.ts") };
        });
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
});
const js = result.outputFiles!.find((f) => f.path.endsWith(".js"))!.text;
const css = result.outputFiles!.find((f) => f.path.endsWith(".css"))!.text;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Project — Interactive Preview</title><style>${css}</style><style>html,body{height:100%;overflow:hidden}#portable-bar{height:40px;padding:0 16px;background:#eaf1fb;border-bottom:1px solid #c6d8f2;display:flex;align-items:center;gap:12px;font:12px 'Segoe UI',sans-serif;color:#172b4d}#portable-bar span{flex:1}#backup{background:white;border:1px solid #a7bfdf;border-radius:4px;padding:5px 10px;color:#172b4d}#root .app-shell{height:calc(100dvh - 40px)}.topbar .live-status{display:none}@media(max-width:600px){#portable-bar{height:56px;font-size:10px}#root .app-shell{height:calc(100dvh - 56px)}}</style></head><body><div id="portable-bar"><b>Local preview</b><span>Saved in this browser. AI and team sharing require the server version.</span><button id="backup">Export backup</button></div><div id="root"></div><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`;
mkdirSync("portable", { recursive: true });
writeFileSync("portable/Open-Project.html", html);
console.log(
  "Built portable/Open-Project.html (" +
    Math.round(Buffer.byteLength(html) / 1024) +
    " KiB). Open directly in a browser.",
);
