import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDesktopService } from "../../desktop/service";
import { validateSettings, mergeSettings } from "../../desktop/settings";
describe("desktop service", () => {
  it("rejects unauthenticated requests, persists local projects, and blocks local invitations", async () => {
    const directory = mkdtempSync(join(tmpdir(), "op-desktop-"));
    let service = await startDesktopService({ dataDirectory: directory });
    try {
      expect((await fetch(service.origin + "/api/projects")).status).toBe(403);
      const headers = {
        "X-Open-Project-Desktop": service.token,
        "Content-Type": "application/json",
      };
      const session = await fetch(service.origin + "/api/auth/session", {
        headers,
      });
      expect(session.ok).toBe(true);
      const created = await fetch(service.origin + "/api/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Desktop plan",
          start: "2026-10-26T09:00:00-07:00",
        }),
      });
      expect(created.status).toBe(201);
      const project = await created.json();
      expect(
        (
          await fetch(
            service.origin +
              "/api/projects/" +
              project.document.id +
              "/invitations",
            { method: "POST", headers, body: "{}" },
          )
        ).status,
      ).toBe(409);
      await service.close();
      service = await startDesktopService({ dataDirectory: directory });
      const restored = await fetch(
        service.origin + "/api/projects/" + project.document.id,
        { headers: { "X-Open-Project-Desktop": service.token } },
      );
      expect(restored.ok).toBe(true);
      expect((await restored.json()).document.name).toBe("Desktop plan");
    } finally {
      await service.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("keeps the gated local workspace available after seven days", async () => {
    const directory = mkdtempSync(join(tmpdir(), "op-desktop-lifetime-"));
    const service = await startDesktopService({ dataDirectory: directory });
    const future = Date.now() + 8 * 86400000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(future);
    try {
      const result = await fetch(service.origin + "/api/projects", {
        headers: { "X-Open-Project-Desktop": service.token },
      });
      expect(result.status).toBe(200);
    } finally {
      clock.mockRestore();
      await service.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("requires HTTPS without credentials and preserves a key on blank edits", () => {
    expect(() =>
      validateSettings({
        baseURL: "http://example.com",
        model: "model",
        apiKey: "",
      }),
    ).toThrow();
    expect(() =>
      validateSettings({
        baseURL: "https://user:secret@example.com",
        model: "model",
        apiKey: "",
      }),
    ).toThrow();
    expect(
      mergeSettings(
        {
          baseURL: "https://api.groq.com/openai/v1",
          model: "old",
          encryptedKey: "cipher",
        },
        { baseURL: "https://api.groq.com/openai/v1", model: "new", apiKey: "" },
        () => {
          throw Error("must not encrypt");
        },
      ),
    ).toEqual({
      baseURL: "https://api.groq.com/openai/v1",
      model: "new",
      encryptedKey: "cipher",
    });
  });
});
