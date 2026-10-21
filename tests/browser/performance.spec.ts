import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { largeProject } from "../fixtures/large-project";
test("measures the representative project under four-times CPU throttling", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Website redesign" }),
  ).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const result = await page.evaluate(async () => {
    const path = "/shared/schedule.ts",
      fixture = "/tests/fixtures/large-project.ts";
    const { schedule } = await import(path),
      { largeProject } = await import(fixture);
    const p = largeProject();
    schedule(p);
    const times: number[] = [];
    for (let i = 0; i < 30; i++) {
      p.tasks[0].duration = 1 + (i % 2);
      const begin = performance.now();
      schedule(p);
      times.push(performance.now() - begin);
    }
    return {
      times,
      sorted: [...times].sort((a, b) => a - b),
      userAgent: navigator.userAgent,
    };
  });
  console.log("Schedule benchmark completed");
  const p = largeProject();
  const created = await page.request.post("/api/projects", {
    data: { name: "Performance fixture", start: p.start },
  });
  const key = (await created.json()).document.id;
  let revision = 0;
  const batches = [
    p.tasks.map((task) => ({ type: "task.add", task })),
    p.dependencies.map((dependency) => ({
      type: "dependency.add",
      dependency,
    })),
    p.resources.map((resource) => ({ type: "resource.add", resource })),
    p.assignments.map((assignment) => ({ type: "assignment.add", assignment })),
  ];
  for (const commands of batches) {
    const r = await page.request.post("/api/projects/" + key + "/changes", {
      data: { revision, requestId: "perf-" + revision, commands },
    });
    expect(r.ok()).toBe(true);
    revision++;
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.reload();
  await page
    .getByRole("button", { name: "Performance fixture", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Performance fixture" }),
  ).toBeVisible();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  console.log("Large-project UI loaded");
  const input = page.getByLabel("Search tasks");
  const feedback: number[] = [];

  for (let i = 0; i < 30; i++) {
    await input.focus();
    const elapsed = await page.evaluate(async (i) => {
      const input = document.querySelector(
        'input[aria-label="Search tasks"]',
      ) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      const start = performance.now();
      setter.call(input, i % 2 ? "Task" : "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      return performance.now() - start;
    }, i);
    feedback.push(elapsed);
  }

  const feedbackSorted = [...feedback].sort((a, b) => a - b);
  const report = {
    fixture: { tasks: 1000, dependencies: 1500, resources: 100 },
    cpuThrottle: 4,
    samples: 30,
    recalculationP95: result.sorted[28],
    feedbackP95: feedbackSorted[28],
    scheduleTimes: result.times,
    feedbackTimes: feedback,
    userAgent: result.userAgent,
    machine: process.platform + " " + process.arch,
  };
  writeFileSync(
    "test-results/performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      scheduleP95: report.recalculationP95,
      feedbackP95: report.feedbackP95,
    }),
  );
  expect(report.recalculationP95).toBeLessThan(1000);
  expect(report.feedbackP95).toBeLessThan(100);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
