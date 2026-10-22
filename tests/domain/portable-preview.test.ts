import { describe, it, expect } from "vitest";
import { createPreviewAPI } from "../../preview/api";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
describe("portable browser workspace", () => {
  it("persists edits and rejects stale writes", async () => {
    const db = storage(),
      api = createPreviewAPI(db);
    const p = await api("/projects", "POST", {
      name: "Portable plan",
      start: "2026-10-26T09:00:00-07:00",
    });
    await api("/projects/" + p.document.id + "/changes", "POST", {
      revision: 0,
      requestId: "edit",
      commands: [{ type: "project.update", patch: { name: "Saved plan" } }],
    });
    const reopened = await createPreviewAPI(db)("/projects/" + p.document.id);
    expect(reopened.document.name).toBe("Saved plan");
    await expect(
      api("/projects/" + p.document.id + "/changes", "POST", {
        revision: 0,
        requestId: "stale",
        commands: [{ type: "project.update", patch: { name: "Lost" } }],
      }),
    ).rejects.toThrow(/changed/);
  });
  it("retries baseline creation once and supports undo", async () => {
    const api = createPreviewAPI(storage());
    const p = await api("/projects", "POST", {
      name: "Plan",
      start: "2026-10-26T09:00:00-07:00",
      templateId: "launch",
    });
    const request = {
      revision: 0,
      requestId: "baseline",
      commands: [{ type: "baseline.add", name: "Approved" }],
    };
    await api("/projects/" + p.document.id + "/changes", "POST", request);
    const next = await api(
      "/projects/" + p.document.id + "/changes",
      "POST",
      request,
    );
    expect(next.document.baselines).toHaveLength(1);
    const history = await api("/projects/" + p.document.id + "/history");
    const undone = await api(
      "/projects/" + p.document.id + "/history/" + history[0].id + "/undo",
      "POST",
      { revision: 1, requestId: "undo" },
    );
    expect(undone.document.baselines).toHaveLength(0);
  });
  it("does not pretend to provide live AI or account registration", async () => {
    const api = createPreviewAPI(storage());
    await expect(api("/auth/register", "POST", {})).rejects.toThrow(
      /server version/,
    );
    const p = await api("/projects", "POST", {
      name: "Plan",
      start: "2026-10-26T09:00:00-07:00",
    });
    await expect(
      api("/projects/" + p.document.id + "/ai", "POST", {}),
    ).rejects.toThrow(/server version/);
  });
});
