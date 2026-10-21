import { test, expect } from "@playwright/test";
test("opens a shared project as a viewer and disables editing", async ({
  page,
  browser,
  baseURL,
}) => {
  const stamp = Date.now();
  await page.request.post("/api/auth/register", {
    data: {
      name: "Project Owner",
      email: `owner-${stamp}@example.com`,
      password: "browser-password-123",
    },
  });
  const created = await page.request.post("/api/projects", {
      data: {
        name: "Shared acceptance project",
        templateId: "launch",
        start: "2026-10-26T09:00:00-07:00",
      },
    }),
    p = (await created.json()).document;
  const invite = await page.request.post(
      "/api/projects/" + p.id + "/invitations",
      { data: { email: `viewer-${stamp}@example.com`, role: "viewer" } },
    ),
    token = (await invite.json()).token;
  const other = await browser.newContext({ baseURL });
  try {
    await other.request.post("/api/auth/register", {
      data: {
        name: "Viewer",
        email: `viewer-${stamp}@example.com`,
        password: "browser-password-123",
      },
    });
    await other.request.post("/api/invitations/" + token + "/accept", {
      data: {},
    });
    const view = await other.newPage();
    await view.goto("/");
    await expect(
      view.getByRole("heading", { name: "Shared acceptance project" }),
    ).toBeVisible();
    await expect(
      view.getByRole("button", { name: "Add task", exact: true }),
    ).toBeDisabled();
    await expect(
      view.getByRole("button", { name: "Set baseline", exact: true }),
    ).toBeDisabled();
    await view
      .getByRole("button", { name: "Research & discovery", exact: true })
      .click();
    await expect(view.getByLabel("Task name", { exact: true })).toBeDisabled();
    await expect(
      view.getByRole("button", { name: "Save changes", exact: true }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});
