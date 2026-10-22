import { dirname, basename, join, relative, isAbsolute } from "node:path";
import { realpathSync, renameSync, existsSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Store } from "../server/db";
export function createWorkspaceBackup(
  store: Store,
  destination: string,
  dataDirectory: string,
) {
  const target = join(
    realpathSync(dirname(destination)),
    basename(destination),
  );
  const within = relative(realpathSync(dataDirectory), target);
  if (
    !within ||
    (!within.startsWith(".." + requireSeparator()) &&
      within !== ".." &&
      !isAbsolute(within))
  )
    throw Error(
      "Choose a backup location outside the Open Project application data directory.",
    );
  const temp = target + ".tmp-" + randomBytes(6).toString("hex");
  try {
    store.db.prepare("VACUUM INTO ?").run(temp);
    const check = new DatabaseSync(temp, { readOnly: true });
    try {
      const result = check.prepare("PRAGMA integrity_check").get() as Record<
        string,
        string
      >;
      if (result.integrity_check !== "ok")
        throw Error("Backup integrity check failed");
    } finally {
      check.close();
    }
    renameSync(temp, target);
    return destination;
  } catch (error) {
    if (existsSync(temp)) unlinkSync(temp);
    throw error;
  }
}
function requireSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}
