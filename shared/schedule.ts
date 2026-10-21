import { DomainError } from "./errors";
import type {
  ProjectDocument,
  ScheduleResult,
  Task,
  Dependency,
} from "./model";
import {
  addWorkingHours,
  normalizeStart,
  workingHoursBetween,
  createWorkingAxis,
} from "./calendar";
export function schedule(p: ProjectDocument): ScheduleResult {
  const base = normalizeStart(p.start, p.calendar),
    axis = createWorkingAxis(base, p.calendar),
    requestedCache = new Map<string, number>(),
    byId = new Map(p.tasks.map((t) => [t.id, t]));
  if (
    byId.size !== p.tasks.length ||
    p.tasks.length > 10000 ||
    p.dependencies.length > 30000
  )
    throw new DomainError("Invalid or oversized task graph");
  const children = new Map<string, Task[]>();
  for (const t of p.tasks) {
    if (
      !Number.isFinite(t.duration) ||
      t.duration < 0 ||
      t.duration > 8e5 ||
      t.percent < 0 ||
      t.percent > 100
    )
      throw new DomainError("Invalid task duration or completion");
    if (t.parentId) {
      if (!byId.has(t.parentId)) throw new DomainError("Missing parent task");
      children.set(t.parentId, [...(children.get(t.parentId) || []), t]);
    }
    const seen = new Set([t.id]);
    let par = t.parentId;
    while (par) {
      if (seen.has(par)) throw new DomainError("Task hierarchy cycle");
      seen.add(par);
      par = byId.get(par)?.parentId ?? null;
    }
  }
  const leaves = p.tasks.filter((t) => !children.has(t.id));
  const incoming = new Map<string, Dependency[]>(),
    outgoing = new Map<string, Dependency[]>();
  for (const d of p.dependencies) {
    if (!byId.has(d.from) || !byId.has(d.to) || d.from === d.to)
      throw new DomainError("Dependency requires two distinct existing tasks");
    if (children.has(d.from) || children.has(d.to))
      throw new DomainError("Dependencies cannot link summary tasks");
    if (!["FS", "SS", "FF", "SF"].includes(d.type) || !Number.isFinite(d.lag))
      throw new DomainError("Invalid dependency");
    incoming.set(d.to, [...(incoming.get(d.to) || []), d]);
    outgoing.set(d.from, [...(outgoing.get(d.from) || []), d]);
  }
  const indegree = new Map(
    leaves.map((t) => [t.id, incoming.get(t.id)?.length ?? 0]),
  );
  const queue = leaves.filter((t) => !indegree.get(t.id)).map((t) => t.id);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    order.push(id);
    for (const d of outgoing.get(id) || []) {
      indegree.set(d.to, indegree.get(d.to)! - 1);
      if (!indegree.get(d.to)) queue.push(d.to);
    }
  }
  if (order.length !== leaves.length)
    throw new DomainError("Dependency cycle detected");
  const weight = (d: Dependency) =>
    (d.type[0] === "F" ? byId.get(d.from)!.duration : 0) -
    (d.type[1] === "F" ? byId.get(d.to)!.duration : 0) +
    d.lag;
  const starts = new Map<string, number>(),
    finish = new Map<string, number>();
  const result: ScheduleResult = {
    tasks: Object.create(null),
    critical: [],
    violations: [],
    finish: base,
  };
  for (const id of order) {
    const t = byId.get(id)!;
    let required = 0;
    for (const d of incoming.get(id) || [])
      required = Math.max(required, starts.get(d.from)! + weight(d));
    const requestedDate = t.manual
      ? t.start
      : t.earliestStart === undefined
        ? t.start
        : (t.earliestStart ?? p.start);
    let requested = requestedCache.get(requestedDate);
    if (requested === undefined) {
      requested = workingHoursBetween(
        base,
        normalizeStart(requestedDate, p.calendar),
        p.calendar,
      );
      requestedCache.set(requestedDate, requested);
    }
    const start = t.manual ? requested : Math.max(required, requested);
    starts.set(id, start);
    finish.set(id, start + t.duration);
    if (t.manual && start < required)
      result.violations.push({
        taskId: id,
        message: "Manual dates violate a dependency",
      });
  }
  const end = Math.max(0, ...finish.values()),
    latest = new Map<string, number>();
  for (const id of [...order].reverse()) {
    let l = end - byId.get(id)!.duration;
    for (const d of outgoing.get(id) || [])
      l = Math.min(l, latest.get(d.to)! - weight(d));
    latest.set(id, l);
    const t = byId.get(id)!;
    const start = axis(starts.get(id)!, t.duration > 0);
    const f = axis(starts.get(id)! + t.duration, false);
    const float = Math.max(0, Math.round((l - starts.get(id)!) * 1e6) / 1e6);
    result.tasks[id] = {
      start,
      finish: f,
      float,
      percent: t.percent,
      summary: false,
    };
    if (float < 1e-6) result.critical.push(id);
  }
  const roll = (id: string): void => {
    if (result.tasks[id]) return;
    const kids = children.get(id)!;
    kids.forEach((t) => roll(t.id));
    const descendants = (task: Task): Task[] =>
      children.has(task.id)
        ? children.get(task.id)!.flatMap(descendants)
        : [task];
    const all = kids.flatMap(descendants);
    const total = all.reduce((s, t) => s + t.duration, 0);
    const percent = total
      ? all.reduce((s, t) => s + t.duration * t.percent, 0) / total
      : (all.filter((t) => t.percent === 100).length / all.length) * 100;
    const dates = kids.map((t) => result.tasks[t.id]);
    result.tasks[id] = {
      start: dates
        .map((t) => t.start)
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0],
      finish: dates
        .map((t) => t.finish)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0],
      float: Math.min(...dates.map((t) => t.float)),
      percent,
      summary: true,
    };
  };
  p.tasks.forEach((t) => roll(t.id));
  result.finish = axis(end, false);
  return result;
}
