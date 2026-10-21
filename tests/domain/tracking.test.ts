import { it, expect } from "vitest";
import { blankProject, newTask } from "../../shared/model";
import { schedule } from "../../shared/schedule";
import { calculateMetrics } from "../../shared/metrics";
import { previewCommands } from "../../shared/commands";
import {
  starterTemplates,
  instantiateTemplate,
  toTemplate,
} from "../../shared/templates";
const fixture = () => {
  const p = blankProject();
  p.tasks = [
    newTask("a", "Work", p.start),
    newTask("b", "Also work", p.start, 1),
  ];
  p.resources = [
    {
      id: "r",
      name: "Alex",
      role: "Designer",
      kind: "person" as const,
      capacity: 100,
      rate: 50,
      active: true,
      color: "#7171e5",
    },
  ];
  p.assignments = p.tasks.map((t) => ({
    id: t.id,
    taskId: t.id,
    resourceId: "r",
    allocation: 100,
    actualWork: null,
    actualRate: null,
  }));
  return p;
};
it("calculates overload, work and costs with no inferred actual costs", () => {
  const p = fixture();
  p.tasks[0].percent = 50;
  const m = calculateMetrics(p, schedule(p));
  expect(m.work).toBe(16);
  expect(m.cost).toBe(800);
  expect(m.actualCost).toBeNull();
  expect(m.overloads.length).toBeGreaterThan(0);
  p.assignments[0].actualWork = 2;
  p.assignments[0].actualRate = 40;
  expect(calculateMetrics(p, schedule(p)).actualCost).toBe(80);
});
it("captures immutable baselines and detects new and removed tasks", () => {
  const p = fixture();
  const b = previewCommands(p, [
    { type: "baseline.add", name: "Original" },
  ]).document;
  p.resources[0].rate = 999;
  expect(b.baselines[0].document.resources[0].rate).toBe(50);
  const c = previewCommands(b, [
    { type: "task.delete", id: "b" },
    { type: "task.add", task: newTask("c", "New", p.start) },
  ]).document;
  const m = calculateMetrics(c, schedule(c), b.baselines[0].id);
  expect(m.variance.find((v) => v.id === "b")?.state).toBe("removed");
  expect(m.variance.find((v) => v.id === "c")?.state).toBe("added");
});
it("rejects invalid progress, assignments, hierarchy and calendar changes atomically", () => {
  const p = fixture();
  expect(() =>
    previewCommands(p, [
      { type: "task.update", id: "a", patch: { percent: 101 } },
    ]),
  ).toThrow();
  expect(() =>
    previewCommands(p, [
      { type: "task.update", id: "a", patch: { percent: 100 } },
    ]),
  ).toThrow(/actual finish/i);
  expect(() =>
    previewCommands(p, [
      {
        type: "task.update",
        id: "a",
        patch: {
          actualStart: "2026-10-29T09:00:00-07:00",
          actualFinish: "2026-10-26T09:00:00-07:00",
        },
      },
    ]),
  ).toThrow();
  expect(() =>
    previewCommands(p, [
      {
        type: "assignment.add",
        assignment: {
          id: "x",
          taskId: "missing",
          resourceId: "r",
          allocation: 100,
          actualWork: null,
          actualRate: null,
        },
      },
    ]),
  ).toThrow();
  expect(p.tasks[0].percent).toBe(0);
});
it("resources never change fixed duration, and moved work resolves overload", () => {
  const p = fixture();
  const q = previewCommands(p, [
    {
      type: "task.update",
      id: "b",
      patch: { start: "2026-10-27T09:00:00-07:00" },
    },
    { type: "resource.update", id: "r", patch: { rate: 60 } },
  ]).document;
  expect(q.tasks[0].duration).toBe(8);
  expect(calculateMetrics(q, schedule(q)).overloads).toHaveLength(0);
  expect(calculateMetrics(q, schedule(q)).cost).toBe(960);
});
it("creates four valid private templates on alternate calendars", () => {
  expect(starterTemplates).toHaveLength(4);
  for (const t of starterTemplates) {
    const p = instantiateTemplate(t, {
      name: "Test",
      start: "2026-11-02T09:00:00-08:00",
    });
    expect(p.tasks.length).toBeGreaterThan(5);
    expect(() => schedule(p)).not.toThrow();
    const exported = toTemplate({
      ...p,
      baselines: [
        {
          id: "b",
          name: "private",
          createdAt: "now",
          document: blankProject(),
        },
      ],
    });
    expect(JSON.stringify(exported)).not.toContain("private");
    expect(
      exported.tasks.every((t) => t.percent === 0 && t.actualFinish === null),
    ).toBe(true);
  }
});
it("validates milestone-only rollup and excludes summary costs", () => {
  const p = fixture();
  p.tasks = [
    { ...newTask("s", "Phase", p.start), fixedCost: 1000 },
    {
      ...newTask("m", "Milestone", p.start),
      parentId: "s",
      duration: 0,
      percent: 100,
      actualFinish: p.start,
    },
    { ...newTask("n", "Milestone 2", p.start), parentId: "s", duration: 0 },
  ];
  p.assignments = [];
  const s = schedule(p);
  expect(s.tasks.s.percent).toBe(50);
  expect(calculateMetrics(p, s).cost).toBe(0);
});
it("materializes scheduled dates while letting automatic successors move earlier again", () => {
  const p = fixture();
  p.dependencies = [{ id: "link", from: "a", to: "b", type: "FS", lag: 0 }];
  const first = previewCommands(p, [
    { type: "task.update", id: "a", patch: { duration: 24 } },
  ]).document;
  expect(first.tasks.find((t) => t.id === "b")!.finish).toBe(
    schedule(first).tasks.b.finish,
  );
  const earlier = previewCommands(first, [
    { type: "task.update", id: "a", patch: { duration: 8 } },
  ]).document;
  expect(earlier.tasks.find((t) => t.id === "b")!.start).toBe(
    "2026-10-27T09:00:00.000-07:00",
  );
});
