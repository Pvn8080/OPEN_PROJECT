import { blankProject, newTask } from "../../shared/model";
export function largeProject() {
  const p = blankProject();
  p.tasks = Array.from({ length: 1000 }, (_, i) => ({
    ...newTask("t" + i, "Task " + i, p.start, i),
    duration: 1,
  }));
  p.dependencies = Array.from({ length: 999 }, (_, i) => ({
    id: "d" + i,
    from: "t" + i,
    to: "t" + (i + 1),
    type: "FS" as const,
    lag: 0,
  }));
  for (let i = 0; i < 501; i++)
    p.dependencies.push({
      id: "extra" + i,
      from: "t" + i,
      to: "t" + (i + 5),
      type: "FS",
      lag: 0,
    });
  p.resources = Array.from({ length: 100 }, (_, i) => ({
    id: "r" + i,
    name: "Resource " + i,
    role: "Contributor",
    kind: "person" as const,
    capacity: 100,
    rate: 75,
    active: true,
    color: "#8673cf",
  }));
  p.assignments = p.tasks.map((t, i) => ({
    id: "a" + i,
    taskId: t.id,
    resourceId: "r" + (i % 100),
    allocation: 100,
    actualWork: null,
    actualRate: null,
  }));
  return p;
}
