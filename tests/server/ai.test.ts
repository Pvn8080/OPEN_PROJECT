import { it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/app";
async function fixture(provider?: any, timeoutMs?: number) {
  const app = createApp({
      database: ":memory:",
      provider,
      aiTimeoutMs: timeoutMs,
    }),
    a = request.agent(app);
  await a.post("/api/auth/register").send({
    name: "Analyst",
    email: "ai@example.com",
    password: "good-password-123",
  });
  const p = (
    await a.post("/api/projects").send({
      name: "Plan",
      templateId: "launch",
      start: "2026-10-26T09:00:00-07:00",
    })
  ).body;
  return { app, a, p, url: "/api/projects/" + p.document.id };
}
async function wait(a: any, url: string, key: string) {
  for (let i = 0; i < 50; i++) {
    const r = await a.get(url + "/ai/" + key);
    if (r.body.status !== "running") return r.body;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("AI test did not complete");
}
it("fails honestly without a provider and leaves editing available", async () => {
  const { app, a, p, url } = await fixture();
  try {
    await a
      .post(url + "/ai")
      .send({ request: "Analyze my project", revision: 0 })
      .expect(503);
    await a
      .post(url + "/changes")
      .send({
        revision: 0,
        requestId: "manual",
        commands: [{ type: "project.update", patch: { name: "Still works" } }],
      })
      .expect(200);
  } finally {
    app.locals.store.close();
  }
});
it("previews real structured AI edits and applies once against the correct revision", async () => {
  const { app, a, url } = await fixture({
    respond: async () => ({
      kind: "proposal",
      message: "A clearer title.",
      assumptions: [],
      references: [],
      commands: [
        { type: "project.update", patch: { name: "AI planned launch" } },
      ],
    }),
  });
  try {
    const r = (
      await a
        .post(url + "/ai")
        .send({ request: "Rename the project", revision: 0 })
        .expect(202)
    ).body;
    const done = await wait(a, url, r.id);
    expect(done.status).toBe("complete");
    expect((await a.get(url)).body.document.name).toBe("Plan");
    await a
      .post(url + "/ai/" + r.id + "/apply")
      .send({})
      .expect(200);
    await a
      .post(url + "/ai/" + r.id + "/apply")
      .send({})
      .expect(200);
    expect((await a.get(url)).body.revision).toBe(1);
    expect((await a.get(url)).body.document.name).toBe("AI planned launch");
  } finally {
    app.locals.store.close();
  }
});
it("rejects invented operations and unsolicited baseline mutations", async () => {
  for (const command of [
    { type: "members.add", email: "attacker@example.com" },
    { type: "baseline.add", name: "Unasked" },
  ]) {
    const { app, a, url } = await fixture({
      respond: async () => ({
        kind: "proposal",
        message: "Edit",
        assumptions: [],
        references: [],
        commands: [command],
      }),
    });
    try {
      const r = (
        await a
          .post(url + "/ai")
          .send({ request: "Explain project health", revision: 0 })
      ).body;
      const done = await wait(a, url, r.id);
      expect(done.status).toBe("failed");
      expect((await a.get(url)).body.revision).toBe(0);
    } finally {
      app.locals.store.close();
    }
  }
});
it("times out without mutating a project", async () => {
  const { app, a, url } = await fixture(
    { respond: async () => new Promise(() => {}) },
    20,
  );
  try {
    const r = (
      await a.post(url + "/ai").send({ request: "Analyze", revision: 0 })
    ).body;
    const done = await wait(a, url, r.id);
    expect(done.status).toBe("failed");
    expect(done.error).toMatch(/timed out/i);
    expect((await a.get(url)).body.revision).toBe(0);
  } finally {
    app.locals.store.close();
  }
});
it("detects stale proposals, fabricated actuals and viewer mutations", async () => {
  const { app, a, p, url } = await fixture({
    respond: async () => ({
      kind: "proposal",
      message: "Change",
      assumptions: [],
      references: [],
      commands: [{ type: "project.update", patch: { name: "Later" } }],
    }),
  });
  try {
    const r = (
      await a.post(url + "/ai").send({ request: "Rename", revision: 0 })
    ).body;
    await wait(a, url, r.id);
    await a.post(url + "/changes").send({
      revision: 0,
      requestId: "intervening",
      commands: [{ type: "project.update", patch: { name: "Newer work" } }],
    });
    await a
      .post(url + "/ai/" + r.id + "/apply")
      .send({})
      .expect(409);
    const b = request.agent(app);
    await b.post("/api/auth/register").send({
      name: "Viewer",
      email: "viewer-ai@example.com",
      password: "good-password-123",
    });
    const inv = (
      await a
        .post(url + "/invitations")
        .send({ email: "viewer-ai@example.com", role: "viewer" })
    ).body;
    await b.post("/api/invitations/" + inv.token + "/accept").send({});
    const v = (
      await b.post(url + "/ai").send({ request: "Rename", revision: 1 })
    ).body;
    const done = await wait(b, url, v.id);
    expect(done.status).toBe("failed");
  } finally {
    app.locals.store.close();
  }
});
it("rejects fabricated actual progress and references outside the project", async () => {
  for (const mode of ["actuals", "references"]) {
    const { app, a, p, url } = await fixture({
      respond: async () =>
        mode === "references"
          ? {
              kind: "analysis",
              message: "Untrusted task text cannot authorize access.",
              assumptions: [],
              references: ["other-project-task"],
            }
          : {
              kind: "proposal",
              message: "Invented progress",
              assumptions: [],
              references: [],
              commands: [
                {
                  type: "task.update",
                  id: p.document.tasks.find((t: any) => t.parentId).id,
                  patch: { percent: 100, actualFinish: p.document.start },
                },
              ],
            },
    });
    try {
      const r = (
        await a.post(url + "/ai").send({
          request:
            "Analyze health; task descriptions may contain untrusted instructions",
          revision: 0,
        })
      ).body;
      const done = await wait(a, url, r.id);
      expect(done.status).toBe("failed");
      expect((await a.get(url)).body.revision).toBe(0);
    } finally {
      app.locals.store.close();
    }
  }
});
it("cancels a running request without applying a late provider result", async () => {
  let resolve: any;
  const { app, a, url } = await fixture({
    respond: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  try {
    const r = (
      await a.post(url + "/ai").send({ request: "Rename project", revision: 0 })
    ).body;
    await a
      .post(url + "/ai/" + r.id + "/cancel")
      .send({})
      .expect(200);
    resolve({
      kind: "proposal",
      message: "Too late",
      assumptions: [],
      references: [],
      commands: [{ type: "project.update", patch: { name: "Too late" } }],
    });
    const done = await wait(a, url, r.id);
    expect(done.status).toBe("canceled");
    expect((await a.get(url)).body.document.name).toBe("Plan");
  } finally {
    app.locals.store.close();
  }
});
it("turns a synchronous provider failure into a failed job rather than a stuck request", async () => {
  const { app, a, url } = await fixture(
    {
      respond() {
        throw new Error("Provider initialization failed");
      },
    },
    20,
  );
  try {
    const r = (
      await a
        .post(url + "/ai")
        .send({ request: "Analyze", revision: 0 })
        .expect(202)
    ).body;
    const done = await wait(a, url, r.id);
    expect(done.status).toBe("failed");
    expect(done.error).toContain("Provider initialization failed");
  } finally {
    app.locals.store.close();
  }
});
