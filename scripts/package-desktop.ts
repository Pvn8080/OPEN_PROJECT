import { packager } from "@electron/packager";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
const arch = process.argv[2] ?? "arm64";
if (arch !== "arm64" && arch !== "x64") throw Error("Choose arm64 or x64");
const paths = await packager({
  dir: "desktop-build",
  out: "mac-release",
  name: "Open Project",
  platform: "darwin",
  arch,
  electronVersion: "45.0.0",
  appBundleId: "com.openproject.desktop",
  icon: "desktop/icon.icns",
  appVersion: "0.2.0",
  buildVersion: "0.2.0",
  overwrite: true,
  prune: false,
  asar: true,
  asarIntegrityDigest: false,
  download: { cacheRoot: process.env.ELECTRON_CACHE },
  osxSign:
    process.platform === "darwin"
      ? {
          identity: "-",
          optionsForFile: () => ({
            entitlements: resolve("desktop/entitlements.plist"),
          }),
        }
      : undefined,
});
for (const path of paths) {
  if (process.env.OP_RCODESIGN_PATH) {
    execFileSync(
      process.env.OP_RCODESIGN_PATH,
      [
        "sign",
        "--timestamp-url",
        "none",
        "--entitlements-xml-file",
        resolve("desktop/entitlements.plist"),
        join(path, "Open Project.app"),
      ],
      { stdio: "inherit" },
    );
  }
  console.log(path);
}
