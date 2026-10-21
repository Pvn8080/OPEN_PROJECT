import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../../server/app";
it("restores authenticated projects, actuals and baselines after database reopening", async () => {
  const dir = mkdtempSync(join(tmpdir(), "open-project-")),
    database = join(dir, "test.sqlite");
  let app = createApp({ database });
  try {
    let a = request.agent(app);
    await a.post("/api/auth/register").send({
      name: "Persistent Owner",
      email: "persist@example.com",
      password: "persistent-password",
    });
    let p = (
      await a.post("/api/projects").send({
        name: "Persistent project",
        templateId: "event",
        start: "2026-10-26T09:00:00-07:00",
      })
    ).body;
    const t = p.document.tasks.find((t: any) => t.parentId);
    await a
      .post("/api/projects/" + p.document.id + "/changes")
      .send({
        revision: 0,
        requestId: "persist",
        commands: [
          {
            type: "task.update",
            id: t.id,
            patch: {
              percent: 100,
              actualStart: p.document.start,
              actualFinish: "2026-10-28T17:00:00-07:00",
            },
          },
          { type: "baseline.add", name: "Signed off" },
        ],
      })
      .expect(200);
    app.locals.store.close();
    app = createApp({ database });
    a = request.agent(app);
    await a
      .post("/api/auth/login")
      .send({ email: "persist@example.com", password: "persistent-password" })
      .expect(200);
    p = (await a.get("/api/projects/" + p.document.id).expect(200)).body;
    expect(p.revision).toBe(1);
    expect(p.document.tasks.find((x: any) => x.id === t.id).percent).toBe(100);
    expect(p.document.baselines[0].name).toBe("Signed off");
    expect(
      (await a.get("/api/projects/" + p.document.id + "/history")).body,
    ).toHaveLength(1);
  } finally {
    app.locals.store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
