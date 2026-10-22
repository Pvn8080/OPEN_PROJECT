import { test, expect } from "@playwright/test";
test("plans, tracks resources and baselines, and preserves a saved project", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Website redesign" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task name", { exact: true })
    .fill("Browser acceptance task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Browser acceptance task", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Browser acceptance task", exact: true })
    .click();
  await page.getByLabel("Duration (hours)").fill("16");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Set baseline", exact: true }).click();
  await page.getByLabel("Baseline name").fill("Approved plan");
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
  await page.getByRole("button", { name: "Add resource", exact: true }).click();
  await page.getByLabel("Resource name").fill("Acceptance engineer");
  await page
    .getByRole("button", { name: "Create resource", exact: true })
    .click();
  await expect(
    page.getByText("Acceptance engineer", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project overview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Browser acceptance task", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "AI analyst", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What needs attention?" }),
  ).toBeVisible();
  await page.getByLabel("Ask your AI analyst").fill("Analyze delivery risks");
  await page.getByRole("button", { name: "Send to analyst" }).click();
  await expect(page.getByText(/AI is not configured/)).toBeVisible();
});
test("registers an owner and creates a project from a template", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Browser Owner");
  await page
    .getByLabel("Email address")
    .fill(`browser-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Software delivery/ }).click();
  await page.getByLabel("Project name").fill("Browser delivery");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser delivery" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share project" }).click();
  await page.getByLabel("Invite email").fill("teammate@example.com");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByLabel("Invitation link")).toHaveValue(/invite=/);
  await expect(page.getByText(/Email was not sent/)).toBeVisible();
});
