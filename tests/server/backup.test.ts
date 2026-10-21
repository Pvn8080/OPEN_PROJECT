import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { backupDatabase } from "../../scripts/backup";
it("creates a consistent restorable snapshot and refuses to overwrite files", () => {
  const dir = mkdtempSync(join(tmpdir(), "open-project-backup-")),
    source = join(dir, "source.sqlite"),
    target = join(dir, "backup.sqlite");
  try {
    const db = new DatabaseSync(source);
    db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE evidence(value TEXT); INSERT INTO evidence VALUES('preserved')",
    );
    backupDatabase(source, target);
    db.exec("INSERT INTO evidence VALUES('later')");
    const restored = new DatabaseSync(target);
    expect(restored.prepare("SELECT * FROM evidence").all()).toEqual([
      { value: "preserved" },
    ]);
    expect(restored.prepare("PRAGMA integrity_check").get()).toEqual({
      integrity_check: "ok",
    });
    restored.close();
    expect(() => backupDatabase(source, target)).toThrow(/exists/);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
