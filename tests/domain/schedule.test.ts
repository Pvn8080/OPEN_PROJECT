import { it, expect } from "vitest";
import { schedule } from "../../shared/schedule";
import { blankProject, newTask, type Dependency } from "../../shared/model";
import { DateTime } from "luxon";
const fixture = () => {
  const p = blankProject();
  p.tasks = [
    newTask("a", "Design", p.start),
    newTask("b", "Build", p.start, 1),
  ];
  p.dependencies = [{ id: "d", from: "a", to: "b", type: "FS", lag: 0 }];
  return p;
};
const day = (s: string) =>
  DateTime.fromISO(s)
    .setZone("America/Los_Angeles")
    .toFormat("yyyy-MM-dd HH:mm");
it("schedules FS successors and computes critical path", () => {
  const p = fixture();
  p.tasks.push({ ...newTask("c", "Parallel", p.start), duration: 4 });
  const s = schedule(p);
  expect(day(s.tasks.b.start)).toBe("2026-10-27 09:00");
  expect(s.critical).toEqual(expect.arrayContaining(["a", "b"]));
  expect(s.tasks.c.float).toBe(12);
});
it.each([
  ["SS", 0, "2026-10-26 09:00"],
  ["SS", 4, "2026-10-26 13:00"],
  ["FF", 8, "2026-10-27 09:00"],
  ["SF", 16, "2026-10-27 09:00"],
  ["FS", -4, "2026-10-26 13:00"],
] as const)("supports %s lag %s", (type, lag, start) => {
  const p = fixture();
  p.dependencies[0] = { ...p.dependencies[0], type, lag };
  expect(day(schedule(p).tasks.b.start)).toBe(start);
});
it("rejects graph cycles, self links, hierarchy cycles and summary links", () => {
  const p = fixture();
  p.dependencies.push({ id: "x", from: "b", to: "a", type: "FS", lag: 0 });
  expect(() => schedule(p)).toThrow(/cycle/i);
  p.dependencies = [{ id: "x", from: "a", to: "a", type: "FS", lag: 0 }];
  expect(() => schedule(p)).toThrow();
  p.dependencies = [];
  p.tasks[0].parentId = "b";
  p.tasks[1].parentId = "a";
  expect(() => schedule(p)).toThrow(/hierarchy/i);
  p.tasks[0].parentId = null;
  p.dependencies = [{ id: "x", from: "a", to: "b", type: "FS", lag: 0 }];
  expect(() => schedule(p)).toThrow(/summary/i);
});
it("rolls up nested summary dates and completion without counting milestones", () => {
  const p = fixture();
  p.dependencies = [];
  p.tasks.push({ ...newTask("s", "Phase", p.start), duration: 100 });
  p.tasks[0].parentId = "s";
  p.tasks[1].parentId = "s";
  p.tasks[0].percent = 100;
  p.tasks[1].duration = 24;
  const s = schedule(p);
  expect(s.tasks.s.percent).toBe(25);
  expect(s.tasks.s.summary).toBe(true);
  expect(s.tasks.s.finish).toBe(s.tasks.b.finish);
});
it("retains manual dates and reports violated dependencies", () => {
  const p = fixture();
  p.tasks[1].manual = true;
  const s = schedule(p);
  expect(day(s.tasks.b.start)).toBe("2026-10-26 09:00");
  expect(s.violations[0].taskId).toBe("b");
});
it("supports milestones and empty projects", () => {
  const p = fixture();
  p.tasks[1].duration = 0;
  const s = schedule(p);
  expect(s.tasks.b.start).toBe(s.tasks.b.finish);
  expect(schedule(blankProject()).critical).toEqual([]);
});
it("treats arbitrary task identifiers as dictionary keys, never prototype properties", () => {
  const p = blankProject();
  p.tasks = [
    newTask("__proto__", "Prototype named task", p.start),
    newTask("constructor", "Constructor named task", p.start),
  ];
  const s = schedule(p);
  expect(Object.keys(s.tasks)).toHaveLength(2);
  expect(Object.hasOwn(s.tasks, "__proto__")).toBe(true);
  expect(s.tasks["__proto__"].summary).toBe(false);
});
