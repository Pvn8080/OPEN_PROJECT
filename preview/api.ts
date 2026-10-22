import { z } from "zod";
import type { Envelope, User, ProjectListItem } from "../client/api";
export type { Envelope, User, ProjectListItem } from "../client/api";
import {
  blankProject,
  id,
  type Command,
  type ProjectDocument,
} from "../shared/model";
import {
  previewCommands,
  validateProject,
  materializeSchedule,
} from "../shared/commands";
import {
  starterTemplates,
  instantiateTemplate,
  toTemplate,
  type Template,
} from "../shared/templates";
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type History = {
  id: string;
  projectId: string;
  revision: number;
  requestId: string;
  fingerprint: string;
  before: ProjectDocument;
  after: ProjectDocument;
  label: string;
  created_at: string;
  actor: string;
};
type Workspace = {
  version: 1;
  projects: Envelope[];
  history: History[];
  templates: Template[];
};
type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
const key = "open-project-portable-v1";
const user: User = {
  id: "portable-user",
  name: "Alex Morgan",
  email: "",
  guest: 1,
};
const empty = (): Workspace => ({
  version: 1,
  projects: [],
  history: [],
  templates: [],
});
export function createPreviewAPI(storage: Storage) {
  const read = (): Workspace => {
    const saved = storage.getItem(key);
    return saved ? JSON.parse(saved) : empty();
  };
  const write = (workspace: Workspace) => {
    try {
      storage.setItem(key, JSON.stringify(workspace));
    } catch {
      throw new APIError(
        507,
        "Browser storage is unavailable or full. Export a backup and keep this window open.",
      );
    }
  };
  return async function request<T = any>(
    path: string,
    method = "GET",
    body?: any,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const run = () => {
      if (path === "/auth/session" || path === "/auth/demo") return user;
      if (path === "/auth/logout") return null;
      if (path.startsWith("/auth/"))
        throw new APIError(
          501,
          "Accounts and team sharing require the server version. This portable preview stays on your device.",
        );
      const db = read();
      if (path === "/templates") return [...starterTemplates, ...db.templates];
      if (path === "/projects" && method === "GET")
        return db.projects.map((p) => ({
          id: p.document.id,
          name: p.document.name,
          description: p.document.description,
          taskCount: p.document.tasks.length,
          revision: p.revision,
          role: p.role,
          updatedAt: p.updatedAt,
        }));
      if (path === "/projects" && method === "POST") {
        const data = z
          .object({
            name: z.string().trim().min(1).max(200),
            start: z.string().datetime({ offset: true }),
            templateId: z.string().optional(),
          })
          .parse(body);
        const template = [...starterTemplates, ...db.templates].find(
          (t) => t.id === data.templateId,
        );
        if (data.templateId && !template)
          throw new APIError(404, "Template not found");
        const document = template
          ? instantiateTemplate(template, data)
          : blankProject(id(), data.name, data.start);
        materializeSchedule(document, validateProject(document));
        const p: Envelope = {
          document,
          revision: 0,
          role: "owner",
          updatedAt: new Date().toISOString(),
        };
        db.projects.push(p);
        write(db);
        return p;
      }
      const parts = path.split("/").filter(Boolean);
      const p = db.projects.find((p) => p.document.id === parts[1]);
      if (!p || parts[0] !== "projects")
        throw new APIError(404, "Project not found");
      if (parts.length === 2 && method === "GET") return p;
      if (parts[2] === "ai")
        throw new APIError(
          501,
          "Live AI requires the server version and your provider key. Manual planning works in this portable preview.",
        );
      if (parts[2] === "members" && method === "GET")
        return { members: [{ ...user, role: "owner" }], invitations: [] };
      if (parts[2] === "history" && method === "GET")
        return db.history
          .filter((h) => h.projectId === p.document.id)
          .sort((a, b) => b.revision - a.revision)
          .map(({ before, after, fingerprint, requestId, ...h }) => h);
      if (parts[2] === "template" && method === "POST") {
        const template = toTemplate(p.document);
        db.templates.push(template);
        write(db);
        return template;
      }
      if (
        parts[2] === "changes" ||
        parts[2] === "preview" ||
        parts[4] === "undo"
      ) {
        const revision = z.number().int().nonnegative().parse(body?.revision);
        const requestId =
          parts[2] === "preview"
            ? ""
            : z.string().min(1).max(150).parse(body?.requestId);
        const fingerprint = JSON.stringify(
          parts[4] === "undo" ? { undo: parts[3] } : body.commands,
        );
        const existing = db.history.find(
          (h) => h.projectId === p.document.id && h.requestId === requestId,
        );
        if (existing && requestId) {
          if (existing.fingerprint !== fingerprint)
            throw new APIError(
              409,
              "Request ID already used for a different edit",
            );
          return p;
        }
        if (revision !== p.revision)
          throw new APIError(
            409,
            "This project changed. Reload and review your draft.",
          );
        const before = structuredClone(p.document);
        let label = "Edited project";
        if (parts[4] === "undo") {
          const h = db.history.find(
            (h) => h.projectId === p.document.id && h.id === parts[3],
          );
          if (!h) throw new APIError(404, "History entry not found");
          if (JSON.stringify(p.document) !== JSON.stringify(h.after))
            throw new APIError(409, "Later edits conflict with this undo.");
          p.document = structuredClone(h.before);
          validateProject(p.document);
          label = "Undo: " + h.label;
        } else {
          const preview = previewCommands(
            p.document,
            z.array(z.unknown()).min(1).max(2000).parse(body.commands),
          );
          if (parts[2] === "preview") return preview;
          p.document = preview.document;
        }
        p.revision++;
        p.updatedAt = new Date().toISOString();
        db.history.push({
          id: id(),
          projectId: p.document.id,
          revision: p.revision,
          requestId,
          fingerprint,
          before,
          after: structuredClone(p.document),
          label,
          created_at: p.updatedAt,
          actor: user.name,
        });
        write(db);
        return p;
      }
      throw new APIError(501, "This action requires the server version.");
    };
    return structuredClone(run()) as T;
  };
}
let localAPI: ReturnType<typeof createPreviewAPI> | undefined;
export function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  localAPI ??= createPreviewAPI(localStorage);
  return localAPI<T>(path, method, body, signal);
}
export const apply = (
  p: Envelope,
  commands: Command[],
  requestId: string = crypto.randomUUID(),
) =>
  api<Envelope>("/projects/" + p.document.id + "/changes", "POST", {
    revision: p.revision,
    requestId,
    commands,
  });
export function exportWorkspace() {
  return localStorage.getItem(key) ?? JSON.stringify(empty());
}
