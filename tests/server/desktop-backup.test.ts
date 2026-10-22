import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../../server/db";
import { createWorkspaceBackup } from "../../desktop/backup";
describe("desktop backup destinations", () => {
  it("rejects the live data directory and its symlink aliases, and creates a readable external snapshot", () => {
    const root = mkdtempSync(join(tmpdir(), "op-desktop-backup-")),
      data = join(root, "data");
    mkdirSync(data);
    const store = new Store(join(data, "open-project.sqlite"));
    try {
      expect(() =>
        createWorkspaceBackup(store, join(data, "open-project.sqlite"), data),
      ).toThrow(/outside/);
      symlinkSync(data, join(root, "alias"), "dir");
      expect(() =>
        createWorkspaceBackup(
          store,
          join(root, "alias", "ai-settings.json"),
          data,
        ),
      ).toThrow(/outside/);
      createWorkspaceBackup(store, join(root, "safe.sqlite"), data);
      const copy = new DatabaseSync(join(root, "safe.sqlite"), {
        readOnly: true,
      });
      try {
        expect(copy.prepare("PRAGMA integrity_check").get()).toEqual({
          integrity_check: "ok",
        });
      } finally {
        copy.close();
      }
      expect(store.row("PRAGMA integrity_check")).toEqual({
        integrity_check: "ok",
      });
    } finally {
      store.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
