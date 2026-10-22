import { _electron as electron, type ElectronApplication } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const arch = process.argv[2] ?? process.arch;
if (process.platform !== "darwin")
  throw Error("Run this launch test on macOS.");
if (arch !== process.arch)
  throw Error("The Mac launch test requires a matching runner architecture.");
const executablePath = resolve(
  `mac-release/Open Project-darwin-${arch}/Open Project.app/Contents/MacOS/Open Project`,
);
const directory = mkdtempSync(join(tmpdir(), "open-project-mac-launch-"));
const options = {
  executablePath,
  args: ["--desktop-smoke"],
  env: { ...process.env, OP_DESKTOP_DATA_DIR: directory },
  timeout: 30000,
};
let application: ElectronApplication | undefined;
try {
  application = await electron.launch(options);
  const page = await application.firstWindow();
  await page
    .getByRole("heading", { name: "Website redesign" })
    .waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task name", { exact: true })
    .fill("Mac launch verification task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page
    .getByRole("button", { name: "Mac launch verification task", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "App settings" }).click();
  await page.getByRole("heading", { name: "Open Project Settings" }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await application.close();
  application = undefined;
  application = await electron.launch(options);
  const reopened = await application.firstWindow();
  await reopened
    .getByRole("button", { name: "Mac launch verification task", exact: true })
    .waitFor({ timeout: 20000 });
  console.log(
    `PASS: packaged ${arch} Mac application launched, edited a task, opened settings, and retained the task after relaunch.`,
  );
} catch (error) {
  const message = (
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  ).slice(0, 12000);
  console.error(message);
  if (process.env.GITHUB_ACTIONS)
    console.log(
      "::error::" +
        message
          .replaceAll("%", "%25")
          .replaceAll("\r", "%0D")
          .replaceAll("\n", "%0A"),
    );
  process.exitCode = 1;
} finally {
  if (application) await application.close().catch(() => {});
  rmSync(directory, { recursive: true, force: true });
}
