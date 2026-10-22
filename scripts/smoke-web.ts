import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import type { ProjectDocument } from "../shared/model";

// Serve the exact single-file release under the same subpath as GitHub Pages.
const html = readFileSync("portable/Open-Project.html");
const server = createServer((request, response) => {
  if (request.url !== "/OPEN_PROJECT/") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw Error("No preview port");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1512, height: 982 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // This release must work without an API server or external assets.
  await page.route("**/*", (route) =>
    route.request().url() === `${origin}/OPEN_PROJECT/`
      ? route.continue()
      : route.abort(),
  );
  await page.goto(`${origin}/OPEN_PROJECT/`);
  await expect(
    page.getByRole("heading", { name: "Website redesign" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task name", { exact: true })
    .fill("Browser release task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Browser release task", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Set baseline", exact: true }).click();
  await page.getByLabel("Baseline name").fill("Browser release baseline");
  await page
    .getByRole("button", { name: "Save baseline", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Compare baseline" }),
  ).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resource planning" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Browser release task", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw Error("Backup was not downloaded");
  const backup = JSON.parse(readFileSync(path, "utf8")) as {
    projects: { document: ProjectDocument }[];
  };
  expect(
    backup.projects[0].document.tasks.some(
      (task) => task.title === "Browser release task",
    ),
  ).toBe(true);
  expect(
    backup.projects[0].document.baselines.some(
      (baseline) =>
        baseline.name === "Browser release baseline",
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "PASS: browser release opens, saves tasks and baselines, shows resources, persists after reload, and exports a valid backup without a backend.",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
