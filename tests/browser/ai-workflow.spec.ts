import { test, expect } from "@playwright/test";
import { createApp } from "../../server/app";
import { newTask } from "../../shared/model";
import type { AddressInfo } from "node:net";
test("previews, applies and undoes AI commands using a controlled provider and real APIs", async ({
  page,
}) => {
  const app = createApp({
    database: ":memory:",
    provider: {
      async respond(context) {
        return {
          kind: "proposal",
          message:
            "I suggest adding a launch-readiness review and clarifying the project title.",
          assumptions: ["One working day for the review."],
          references: [],
          commands: [
            {
              type: "task.add",
              task: newTask(
                "ai-review",
                "AI readiness review",
                context.project.start,
                100,
              ),
            },
            { type: "project.update", patch: { name: "AI-supported launch" } },
          ],
        };
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: "http://127.0.0.1:" + port + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore demo workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Website redesign" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "AI analyst", exact: true }).click();
    await page
      .getByLabel("Ask your AI analyst")
      .fill("Add a review and improve the project title");
    await page.getByRole("button", { name: "Send to analyst" }).click();
    await expect(
      page.getByRole("button", { name: "Apply proposed changes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Website redesign" }),
    ).toBeVisible();
    await expect(
      page.getByText("One working day for the review."),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Apply proposed changes" }).click();
    await expect(
      page.getByRole("heading", { name: "AI-supported launch" }),
    ).toBeVisible();
    await expect(
      page.getByText("Applied to the plan · undo in history"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close AI analyst" }).click();
    await page.getByRole("button", { name: "Undo last change" }).click();
    await expect(
      page.getByRole("heading", { name: "Website redesign" }),
    ).toBeVisible();
  } finally {
    await page.unroute("**/api/**");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    app.locals.store.close();
  }
});
