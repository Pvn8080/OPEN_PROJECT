import { build } from "esbuild";
import { mkdirSync, cpSync, writeFileSync } from "node:fs";
mkdirSync("desktop-build", { recursive: true });
await build({
  entryPoints: ["desktop/main.ts"],
  outfile: "desktop-build/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["electron"],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';const require=__createRequire(import.meta.url);",
  },
});
await build({
  entryPoints: ["desktop/preload.ts"],
  outfile: "desktop-build/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
});
cpSync("dist", "desktop-build/client", { recursive: true });
writeFileSync(
  "desktop-build/package.json",
  JSON.stringify({
    name: "open-project",
    productName: "Open Project",
    version: "0.2.0",
    description: "Open Project desktop planner",
    author: "Open Project",
    license: "UNLICENSED",
    type: "module",
    main: "main.js",
  }),
);
console.log("Built desktop backend, preload and client.");
