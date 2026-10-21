import { Router } from "express";
import { z } from "zod";
import { id } from "../../shared/model";
import { previewCommands } from "../../shared/commands";
import { calculateMetrics } from "../../shared/metrics";
import { schedule } from "../../shared/schedule";
import { Store, HttpError } from "../db";
import { requireUser } from "../auth";
import { commit, envelope } from "../projects";
import { responseSchema, type AIProvider } from "./provider";
export function aiRouter(
  store: Store,
  provider: AIProvider | undefined,
  timeoutMs = 60000,
) {
  const r = Router(),
    controllers = new Map<string, AbortController>();
  const lookup = (req: any) => {
    const u = requireUser(store, req);
    store.authorize(u.id, req.params.pid);
    const row = store.row(
      "SELECT * FROM proposals WHERE id=? AND project_id=? AND user_id=?",
      req.params.aid,
      req.params.pid,
      u.id,
    );
    if (!row) throw new HttpError(404, "AI request not found");
    return row;
  };
  r.post("/projects/:pid/ai", (req, res) => {
    const u = requireUser(store, req),
      role = store.authorize(u.id, req.params.pid);
    if (!provider)
      throw new HttpError(
        503,
        "AI is not configured. Connect an AI provider to enable analysis and planning. Your manual planning tools remain available.",
      );
    const data = z
      .object({
        request: z.string().trim().min(1).max(10000),
        revision: z.number().int().nonnegative(),
        selectedTaskIds: z.array(z.string()).max(100).default([]),
      })
      .parse(req.body);
    const p = store.getProject(req.params.pid);
    if (p.revision !== data.revision)
      throw new HttpError(
        409,
        "Project changed; reload before asking the analyst",
      );
    if (
      controllers.size >= 10 ||
      store.row(
        "SELECT id FROM proposals WHERE project_id=? AND user_id=? AND status='running'",
        req.params.pid,
        u.id,
      )
    )
      throw new HttpError(
        429,
        "An analysis is already running. Wait or cancel it first.",
      );
    if (
      data.selectedTaskIds.some(
        (id) => !p.document.tasks.some((t) => t.id === id),
      )
    )
      throw new HttpError(422, "Selected task is not in this project");
    const aid = id(),
      controller = new AbortController();
    controllers.set(aid, controller);
    store.run(
      "INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?)",
      aid,
      req.params.pid,
      u.id,
      p.revision,
      "running",
      null,
      data.request,
      new Date().toISOString(),
    );
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("AI request timed out. Your project is unchanged."));
      }, timeoutMs);
    });
    void Promise.race([
      Promise.resolve().then(() =>
        provider.respond(
          {
            project: p.document,
            role,
            revision: p.revision,
            selectedTaskIds: data.selectedTaskIds,
          },
          data.request,
          controller.signal,
        ),
      ),
      timeout,
    ])
      .then((raw) => {
        if (controller.signal.aborted) return;
        const response = responseSchema.parse(raw);
        if (
          response.references.some(
            (ref) => !p.document.tasks.some((t) => t.id === ref),
          )
        )
          throw new Error("AI cited a task outside the project. Please retry.");
        let preview = null;
        if (response.kind === "proposal") {
          if (role === "viewer")
            throw new Error(
              "Viewers can analyze but cannot change the project",
            );
          for (const c of response.commands) {
            if (
              c.type === "baseline.add" &&
              !/\b(create|save|capture|set)\b.{0,40}\bbaseline\b/i.test(
                data.request,
              )
            )
              throw new Error(
                "A baseline requires an explicit request to create one",
              );
            if (
              c.type === "task.update" &&
              [
                "percent",
                "actualStart",
                "actualFinish",
                "actualFixedCost",
              ].some((k) => Object.hasOwn(c.patch, k))
            )
              throw new Error(
                "AI cannot fabricate actual progress. Update actuals manually.",
              );
            if (
              c.type === "task.add" &&
              (c.task.percent !== 0 ||
                c.task.actualFinish ||
                c.task.actualStart ||
                c.task.actualFixedCost)
            )
              throw new Error("New AI tasks must not contain actual progress");
            if (
              (c.type === "assignment.add" &&
                (c.assignment.actualWork !== null ||
                  c.assignment.actualRate !== null)) ||
              (c.type === "assignment.update" &&
                ["actualWork", "actualRate"].some((k) =>
                  Object.hasOwn(c.patch, k),
                ))
            )
              throw new Error("AI cannot invent actual work");
          }
          const candidate = previewCommands(p.document, response.commands);
          preview = {
            ...candidate,
            metricsBefore: calculateMetrics(p.document, schedule(p.document)),
            metricsAfter: calculateMetrics(
              candidate.document,
              candidate.schedule,
            ),
          };
        }
        store.run(
          "UPDATE proposals SET status='complete',document=? WHERE id=? AND status='running'",
          JSON.stringify({ response, preview }),
          aid,
        );
      })
      .catch((e) => {
        store.run(
          "UPDATE proposals SET status='failed',document=? WHERE id=? AND status='running'",
          JSON.stringify({
            error:
              e instanceof z.ZodError
                ? "The AI response did not match the supported planning commands. Please try a more specific request."
                : (e.message ?? "AI request failed"),
          }),
          aid,
        );
      })
      .finally(() => {
        clearTimeout(timer!);
        controllers.delete(aid);
      });
    res.status(202).json({ id: aid, status: "running" });
  });
  r.get("/projects/:pid/ai/:aid", (req, res) => {
    const row = lookup(req);
    res.json({
      id: row.id,
      status: row.status,
      revision: row.revision,
      ...(row.document ? JSON.parse(row.document) : {}),
    });
  });
  r.post("/projects/:pid/ai/:aid/cancel", (req, res) => {
    const row = lookup(req);
    controllers.get(row.id)?.abort();
    controllers.delete(row.id);
    store.run(
      "UPDATE proposals SET status='canceled' WHERE id=? AND status='running'",
      row.id,
    );
    res.json({ status: "canceled" });
  });
  r.post("/projects/:pid/ai/:aid/apply", (req, res) => {
    const row = lookup(req),
      u = requireUser(store, req);
    store.authorize(u.id, req.params.pid, "edit");
    if (row.status === "applied")
      return res.json(envelope(store, u.id, req.params.pid));
    if (row.status !== "complete")
      throw new HttpError(422, "AI proposal is not ready to apply");
    const data = JSON.parse(row.document);
    if (data.response.kind !== "proposal")
      throw new HttpError(422, "This response has no changes to apply");
    const result = commit(
      store,
      u.id,
      req.params.pid,
      {
        revision: row.revision,
        requestId: "ai-" + row.id,
        commands: data.response.commands,
      },
      "AI: " + row.request.slice(0, 100),
    );
    store.run("UPDATE proposals SET status='applied' WHERE id=?", row.id);
    res.json(result);
  });
  return r;
}
