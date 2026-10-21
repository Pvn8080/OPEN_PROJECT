import { DateTime } from "luxon";
import type { Command, ProjectDocument } from "../shared/model";
export const fieldLabel = (field: string) =>
  ({
    parentId: "phase",
    percent: "completion",
    earliestStart: "earliest start",
    manual: "scheduling mode",
    actualWork: "recorded work",
    actualRate: "recorded hourly rate",
    allocation: "allocation",
  })[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
export function describeCommand(c: Command, p: ProjectDocument): string {
  const task = (id: string) =>
      p.tasks.find((t) => t.id === id)?.title ?? "new task",
    resource = (id: string) =>
      p.resources.find((r) => r.id === id)?.name ?? "new resource";
  const value = (key: string, v: unknown): string => {
    if (v === null) return "not set";
    if (key === "duration" || key === "remainingWork" || key === "actualWork")
      return `${v} working hours`;
    if (key === "percent" || key === "allocation" || key === "capacity")
      return `${v}%`;
    if (key === "parentId") return task(String(v));
    if (key === "manual") return v ? "manual" : "automatic";
    if (key === "calendar") {
      const calendar = v as ProjectDocument["calendar"];
      return `${calendar.hours} hours per working day; ${calendar.days.map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1]).join(", ")}; ${calendar.timezone}; ${
        Object.entries(calendar.exceptions)
          .map(([date, hours]) => `${date}: ${hours} hours`)
          .join(", ") || "no date exceptions"
      }`;
    }
    if (
      [
        "start",
        "finish",
        "actualStart",
        "actualFinish",
        "earliestStart",
        "statusDate",
      ].includes(key)
    )
      return DateTime.fromISO(String(v))
        .setZone(p.calendar.timezone)
        .toFormat("MMM d, yyyy HH:mm");
    return String(v);
  };
  const changes = (patch: object) =>
    Object.entries(patch)
      .map(([key, v]) => `${fieldLabel(key)} → ${value(key, v)}`)
      .join("; ") || "no field changes";
  switch (c.type) {
    case "task.add":
      return `Add task “${c.task.title}” (${c.task.duration} working hours)`;
    case "task.update":
      return `Update ${task(c.id)}: ${changes(c.patch)}`;
    case "task.delete":
      return `Delete ${task(c.id)} and its subtasks, assignments, and dependency links`;
    case "resource.add":
      return `Add ${c.resource.kind} “${c.resource.name}”`;
    case "resource.update":
      return `Update ${resource(c.id)}: ${changes(c.patch)}`;
    case "resource.delete":
      return `Remove ${resource(c.id)} and its current assignments`;
    case "dependency.add":
      return `Link ${task(c.dependency.from)} → ${task(c.dependency.to)} (${c.dependency.type}, ${c.dependency.lag} working hours lag)`;
    case "dependency.delete": {
      const d = p.dependencies.find((d) => d.id === c.id);
      return d
        ? `Remove link ${task(d.from)} → ${task(d.to)}`
        : "Remove dependency link";
    }
    case "assignment.add":
      return `Assign ${resource(c.assignment.resourceId)} to ${task(c.assignment.taskId)} at ${c.assignment.allocation}%`;
    case "assignment.update": {
      const a = p.assignments.find((a) => a.id === c.id);
      return `Update assignment${a ? ` for ${resource(a.resourceId)} on ${task(a.taskId)}` : ""}: ${changes(c.patch)}`;
    }
    case "assignment.delete": {
      const a = p.assignments.find((a) => a.id === c.id);
      return a
        ? `Unassign ${resource(a.resourceId)} from ${task(a.taskId)}`
        : "Remove assignment";
    }
    case "baseline.add":
      return `Save baseline “${c.name}”`;
    case "project.update":
      return `Update project: ${changes(c.patch)}`;
  }
}
