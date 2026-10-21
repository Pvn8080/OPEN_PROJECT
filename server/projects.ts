import { Router } from "express";
import { z } from "zod";
import { id, blankProject, type ProjectDocument } from "../shared/model";
import {
  starterTemplates,
  instantiateTemplate,
  toTemplate,
} from "../shared/templates";
import {
  validateProject,
  previewCommands,
  materializeSchedule,
} from "../shared/commands";
import { Store, HttpError } from "./db";
import { requireUser, hash } from "./auth";
const input = z.object({
  revision: z.number().int().nonnegative(),
  requestId: z.string().min(1).max(150),
  commands: z.array(z.unknown()).min(1).max(2000),
});
export function envelope(store: Store, user: string, project: string) {
  const role = store.authorize(user, project);
  return { ...store.getProject(project), role };
}
export function commit(
  store: Store,
  user: string,
  project: string,
  body: unknown,
  label = "Edited project",
) {
  store.authorize(user, project, "edit");
  const data = input.parse(body);
  const fingerprint = hash(
    JSON.stringify({ ...data, revision: undefined, requestId: undefined }),
  );
  return store.transaction(() => {
    const existing = store.row(
      "SELECT * FROM history WHERE project_id=? AND request_id=?",
      project,
      data.requestId,
    );
    if (existing) {
      if (existing.user_id !== user || existing.request_hash !== fingerprint)
        throw new HttpError(
          409,
          "Request ID already used for a different edit",
        );
      return envelope(store, user, project);
    }
    const p = store.getProject(project);
    if (p.revision !== data.revision)
      throw new HttpError(
        409,
        "This project changed. Your draft is preserved; reload and review before saving.",
      );
    const preview = previewCommands(p.document, data.commands);
    const revision = p.revision + 1;
    store.saveDocument(preview.document, revision);
    store.run(
      "INSERT INTO history VALUES(?,?,?,?,?,?,?,?,?,?)",
      id(),
      project,
      user,
      revision,
      data.requestId,
      fingerprint,
      JSON.stringify(p.document),
      JSON.stringify(preview.document),
      label,
      new Date().toISOString(),
    );
    return { ...envelope(store, user, project), preview };
  });
}
export function projectsRouter(store: Store) {
  const r = Router();
  r.use((req, res, next) => {
    requireUser(store, req);
    next();
  });
  r.get("/templates", (req, res) => {
    const user = requireUser(store, req);
    res.json([
      ...starterTemplates,
      ...store
        .rows("SELECT document FROM templates WHERE user_id=?", user.id)
        .map((r) => JSON.parse(r.document)),
    ]);
  });
  r.get("/projects", (req, res) => {
    const u = requireUser(store, req);
    res.json(
      store
        .rows(
          "SELECT p.*,m.role FROM projects p JOIN memberships m ON p.id=m.project_id WHERE m.user_id=? ORDER BY p.updated_at DESC",
          u.id,
        )
        .map((r) => {
          const d = JSON.parse(r.document);
          return {
            id: d.id,
            name: d.name,
            description: d.description,
            taskCount: d.tasks.length,
            revision: r.revision,
            role: r.role,
            updatedAt: r.updated_at,
          };
        }),
    );
  });
  r.post("/projects", (req, res) => {
    const u = requireUser(store, req);
    const data = z
      .object({
        name: z.string().trim().min(1).max(200),
        start: z.string().refine((s) => Number.isFinite(Date.parse(s))),
        templateId: z.string().optional(),
      })
      .parse(req.body);
    const template = [
      ...starterTemplates,
      ...store
        .rows("SELECT document FROM templates WHERE user_id=?", u.id)
        .map((r) => JSON.parse(r.document)),
    ].find((t) => t.id === data.templateId);
    if (data.templateId && !template)
      throw new HttpError(404, "Template not found");
    const p = template
      ? instantiateTemplate(template, { name: data.name, start: data.start })
      : blankProject(id(), data.name, data.start);
    materializeSchedule(p, validateProject(p));
    res.status(201).json({ ...store.createProject(u.id, p), role: "owner" });
  });
  r.get("/projects/:pid", (req, res) =>
    res.json(envelope(store, requireUser(store, req).id, req.params.pid)),
  );
  r.post("/projects/:pid/preview", (req, res) => {
    const u = requireUser(store, req);
    store.authorize(u.id, req.params.pid, "edit");
    const data = z
      .object({
        revision: z.number().int().nonnegative(),
        commands: z.array(z.unknown()).min(1).max(2000),
      })
      .parse(req.body);
    const p = store.getProject(req.params.pid);
    if (p.revision !== data.revision)
      throw new HttpError(409, "Project changed; reload before previewing");
    res.json(previewCommands(p.document, data.commands));
  });
  r.post("/projects/:pid/changes", (req, res) =>
    res.json(
      commit(store, requireUser(store, req).id, req.params.pid, req.body),
    ),
  );
  r.get("/projects/:pid/history", (req, res) => {
    store.authorize(requireUser(store, req).id, req.params.pid);
    res.json(
      store.rows(
        "SELECT h.id,h.revision,h.label,h.created_at,u.name AS actor FROM history h JOIN users u ON u.id=h.user_id WHERE project_id=? ORDER BY revision DESC LIMIT 100",
        req.params.pid,
      ),
    );
  });
  r.post("/projects/:pid/history/:hid/undo", (req, res) => {
    const u = requireUser(store, req);
    store.authorize(u.id, req.params.pid, "edit");
    const data = z
      .object({
        revision: z.number().int(),
        requestId: z.string().min(1).max(150),
      })
      .parse(req.body);
    const out = store.transaction(() => {
      const h = store.row(
        "SELECT * FROM history WHERE id=? AND project_id=?",
        req.params.hid,
        req.params.pid,
      );
      if (!h) throw new HttpError(404, "History entry not found");
      if (
        store.row(
          "SELECT id FROM history WHERE project_id=? AND request_id=?",
          req.params.pid,
          data.requestId,
        )
      )
        return envelope(store, u.id, req.params.pid);
      const p = store.getProject(req.params.pid);
      if (
        p.revision !== data.revision ||
        JSON.stringify(p.document) !== h.after_doc
      )
        throw new HttpError(
          409,
          "Later edits conflict with this undo. Review the current project first.",
        );
      const restored: ProjectDocument = JSON.parse(h.before_doc);
      validateProject(restored);
      store.saveDocument(restored, p.revision + 1);
      store.run(
        "INSERT INTO history VALUES(?,?,?,?,?,?,?,?,?,?)",
        id(),
        req.params.pid,
        u.id,
        p.revision + 1,
        data.requestId,
        hash("undo:" + h.id),
        JSON.stringify(p.document),
        JSON.stringify(restored),
        "Undo: " + h.label,
        new Date().toISOString(),
      );
      return envelope(store, u.id, req.params.pid);
    });
    res.json(out);
  });
  r.post("/projects/:pid/template", (req, res) => {
    const u = requireUser(store, req);
    store.authorize(u.id, req.params.pid, "edit");
    const t = toTemplate(store.getProject(req.params.pid).document);
    store.run(
      "INSERT INTO templates VALUES(?,?,?)",
      t.id,
      u.id,
      JSON.stringify(t),
    );
    res.status(201).json(t);
  });
  r.delete("/projects/:pid", (req, res) => {
    store.authorize(requireUser(store, req).id, req.params.pid, "manage");
    store.run("DELETE FROM projects WHERE id=?", req.params.pid);
    res.sendStatus(204);
  });
  return r;
}
