import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function demo(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Website redesign" }),
  ).toBeVisible();
}
test("reschedules with a preview, cancels safely, applies, and undoes", async ({
  page,
}) => {
  await demo(page);
  const bar = page.getByRole("button", { name: /Move Research & discovery,/ });
  const before = await bar.getAttribute("aria-label");
  await bar.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("dialog", { name: "Review schedule change" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(bar).toHaveAttribute("aria-label", before!);
  await bar.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(bar).not.toHaveAttribute("aria-label", before!);
  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect(bar).toHaveAttribute("aria-label", before!);
});
test("pointer drag previews and Escape cancels without mutation", async ({
  page,
}) => {
  await demo(page);
  const bar = page.getByRole("button", { name: /Move Research & discovery,/ });
  const label = await bar.getAttribute("aria-label"),
    box = await bar.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 10, box!.y + 10);
  await page.mouse.down();
  await page.mouse.move(box!.x + 86, box!.y + 10, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bar).toHaveAttribute("aria-label", label!);
});
test("keeps an unsaved draft when a teammate updates the same revision", async ({
  page,
}) => {
  await demo(page);
  const list = await (await page.request.get("/api/projects")).json(),
    project = await (
      await page.request.get("/api/projects/" + list[0].id)
    ).json();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name", { exact: true }).fill("Retained work");
  await page.request.post("/api/projects/" + project.document.id + "/changes", {
    data: {
      revision: project.revision,
      requestId: "other-" + Date.now(),
      commands: [
        { type: "project.update", patch: { description: "Teammate update" } },
      ],
    },
  });
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "draft is preserved",
  );
  await expect(page.getByLabel("Task name", { exact: true })).toHaveValue(
    "Retained work",
  );
});
test("supports narrow-screen task editing and accessible primary controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name", { exact: true }).fill("Mobile task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
});
test("primary planner has no serious or critical accessibility violations", async ({
  page,
}) => {
  await demo(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});
test("filters task rows after typing without losing the input", async ({
  page,
}) => {
  await demo(page);
  await page.getByLabel("Search tasks").fill("Research & discovery");
  await expect(
    page.getByRole("button", { name: "Research & discovery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Define project scope", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Search tasks")).toHaveValue(
    "Research & discovery",
  );
  await page.getByLabel("Search tasks").fill("");
  await expect(
    page.getByRole("button", { name: "Define project scope", exact: true }),
  ).toBeVisible();
});
test("shows total planned cost impact before changing resource rates", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await page.getByRole("button", { name: /Mia Chen/ }).click();
  await page.getByLabel("Hourly rate (USD)").fill("100");
  let confirmation = "";
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Save resource", exact: true })
    .click();
  expect(confirmation).toContain("Current planned cost:");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("indents and outdents a new top-level task using sibling phases", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task name", { exact: true })
    .fill("Outline acceptance");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const row = page.locator(".grid-cells").filter({
    has: page.getByRole("button", {
      name: "Outline acceptance",
      exact: true,
    }),
  });
  await row.click();
  await page.getByRole("button", { name: "Indent task", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Review schedule change" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  const projects = await (await page.request.get("/api/projects")).json();
  let current = await (
    await page.request.get("/api/projects/" + projects[0].id)
  ).json();
  const task = current.document.tasks.find(
    (t: any) => t.title === "Outline acceptance",
  );
  expect(
    current.document.tasks.find((t: any) => t.id === task.parentId).title,
  ).toBe("Launch & learn");
  await row.click();
  await page.getByRole("button", { name: "Outdent task", exact: true }).click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  current = await (
    await page.request.get("/api/projects/" + projects[0].id)
  ).json();
  expect(
    current.document.tasks.find((t: any) => t.id === task.id).parentId,
  ).toBeNull();
});
test("resizes a task and creates a dependency through the planner controls", async ({
  page,
}) => {
  await demo(page);
  const bar = page.getByRole("button", { name: /Move Research & discovery,/ });
  await bar.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  const projects = await (await page.request.get("/api/projects")).json(),
    url = "/api/projects/" + projects[0].id;
  let current = await (await page.request.get(url)).json();
  const source = current.document.tasks.find(
    (t: any) => t.title === "Research & discovery",
  );
  expect(source.duration).toBe(24);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task name", { exact: true })
    .fill("Acceptance linked task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Link dependency from Research & discovery",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: /Move Acceptance linked task,/ })
    .click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  current = await (await page.request.get(url)).json();
  const target = current.document.tasks.find(
    (t: any) => t.title === "Acceptance linked task",
  );
  expect(
    current.document.dependencies.some(
      (d: any) => d.from === source.id && d.to === target.id && d.type === "FS",
    ),
  ).toBe(true);
});
test("edits calendar exceptions through date and hours controls", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Project settings" }).click();
  await page.getByLabel("Exception date", { exact: true }).fill("2026-10-26");
  await page.getByLabel("Exception working hours", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Add exception", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  const list = await (await page.request.get("/api/projects")).json(),
    p = await (await page.request.get("/api/projects/" + list[0].id)).json();
  expect(p.document.calendar.exceptions["2026-10-26"]).toBe(0);
});
test("reorders tasks with the row drag handle", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name", { exact: true }).fill("Reorder first");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name", { exact: true }).fill("Reorder second");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const first = page.locator(".grid-cells").filter({
      has: page.getByRole("button", { name: "Reorder first", exact: true }),
    }),
    second = page.locator(".grid-cells").filter({
      has: page.getByRole("button", { name: "Reorder second", exact: true }),
    });
  await second.locator(".row-number").hover();
  await page
    .getByRole("button", { name: "Reorder Reorder second", exact: true })
    .dragTo(first, { targetPosition: { x: 15, y: 23 } });
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  const list = await (await page.request.get("/api/projects")).json(),
    p = await (await page.request.get("/api/projects/" + list[0].id)).json();
  const a = p.document.tasks.find((t: any) => t.title === "Reorder first"),
    b = p.document.tasks.find((t: any) => t.title === "Reorder second");
  expect(b.order).toBeLessThan(a.order);
});
test("keeps a conflicting draft through navigation and rejects replacing it with another edit", async ({
  page,
}) => {
  await demo(page);
  const list = await (await page.request.get("/api/projects")).json(),
    url = "/api/projects/" + list[0].id,
    p = await (await page.request.get(url)).json();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name", { exact: true }).fill("Protected draft");
  await page.request.post(url + "/changes", {
    data: {
      revision: p.revision,
      requestId: "conflict-" + Date.now(),
      commands: [
        {
          type: "project.update",
          patch: { description: "Teammate changed this plan" },
        },
      ],
    },
  });
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "draft is preserved",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Website redesign", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("unsaved draft");
  await expect(
    page.getByRole("button", { name: "View retained changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name", { exact: true }).fill("Unrelated edit");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "unsaved draft",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "View retained changes" }).click();
  await expect(page.getByRole("dialog")).toContainText("Protected draft");
  await expect(page.getByRole("dialog")).not.toContainText("Unrelated edit");
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
});
test("reuses an uncertain baseline request after its successful response is lost", async ({
  page,
}) => {
  await demo(page);
  await page.route(
    "**/api/projects/*/changes",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Set baseline", exact: true }).click();
  await page.getByLabel("Baseline name").fill("Lost response baseline");
  await page
    .getByRole("button", { name: "Save baseline", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(/fetch|network|failed/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Reload & review draft", exact: true })
    .click();
  await page.getByRole("button", { name: "View retained changes" }).click();
  await page.getByRole("button", { name: "Apply to current revision" }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  const list = await (await page.request.get("/api/projects")).json(),
    p = await (await page.request.get("/api/projects/" + list[0].id)).json();
  expect(
    p.document.baselines.filter(
      (b: any) => b.name === "Lost response baseline",
    ),
  ).toHaveLength(1);
});
