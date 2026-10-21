import {
  blankProject,
  newTask,
  id,
  type ProjectDocument,
  type Calendar,
} from "./model";
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  tasks: ProjectDocument["tasks"];
  dependencies: ProjectDocument["dependencies"];
  resources: ProjectDocument["resources"];
  assignments: ProjectDocument["assignments"];
}
function starter(
  key: string,
  name: string,
  description: string,
  color: string,
  phases: [string, string[]][],
  roles: string[],
): Template {
  const p = blankProject();
  let previous: string | null = null;
  phases.forEach(([phase, titles], i) => {
    const parent = newTask(key + "-phase-" + i, phase, p.start, p.tasks.length);
    p.tasks.push(parent);
    titles.forEach((title, j) => {
      const t = {
        ...newTask(key + "-" + i + "-" + j, title, p.start, p.tasks.length),
        parentId: parent.id,
        duration: j === titles.length - 1 ? 0 : 8 * (j + 2),
      };
      p.tasks.push(t);
      if (previous)
        p.dependencies.push({
          id: "dep-" + t.id,
          from: previous,
          to: t.id,
          type: "FS",
          lag: 0,
        });
      previous = t.id;
    });
  });
  p.resources = roles.map((role, i) => ({
    id: key + "-role-" + i,
    name: role,
    role,
    kind: "person",
    capacity: 100,
    rate: 75,
    active: true,
    color: ["#7665df", "#e49b45", "#4c9e90"][i % 3],
  }));
  p.assignments = p.tasks
    .filter((t) => t.parentId && t.duration > 0)
    .map((t, i) => ({
      id: "as-" + t.id,
      taskId: t.id,
      resourceId: p.resources[i % roles.length].id,
      allocation: 100,
      actualWork: null,
      actualRate: null,
    }));
  return {
    id: key,
    name,
    description,
    category: name,
    color,
    tasks: p.tasks,
    dependencies: p.dependencies,
    resources: p.resources,
    assignments: p.assignments,
  };
}
export const starterTemplates: Template[] = [
  starter(
    "launch",
    "Product launch",
    "Take a great idea from discovery to launch day.",
    "#7767dc",
    [
      [
        "Discovery & strategy",
        ["Research & discovery", "Define project scope", "Strategy sign-off"],
      ],
      [
        "Design & development",
        ["Explore concepts", "Build the experience", "Design approval"],
      ],
      [
        "Launch & learn",
        ["Quality assurance", "Prepare launch assets", "Launch day"],
      ],
    ],
    ["Project lead", "Product designer", "Engineer"],
  ),
  starter(
    "software",
    "Software delivery",
    "A structured path from requirements to release.",
    "#4b9d8c",
    [
      ["Plan", ["Gather requirements", "Technical design", "Plan approved"]],
      ["Build", ["Implementation", "Integration testing", "Release candidate"]],
      ["Ship", ["Acceptance testing", "Release preparation", "Release"]],
    ],
    ["Product manager", "Engineer", "QA engineer"],
  ),
  starter(
    "marketing",
    "Marketing campaign",
    "Turn a clear message into a coordinated campaign.",
    "#d29a44",
    [
      ["Strategy", ["Audience research", "Campaign brief", "Brief approved"]],
      [
        "Create",
        ["Creative development", "Content production", "Creative sign-off"],
      ],
      ["Activate", ["Channel setup", "Campaign execution", "Campaign review"]],
    ],
    ["Campaign lead", "Creative director", "Content strategist"],
  ),
  starter(
    "event",
    "Event planning",
    "Bring people together without missing the details.",
    "#c47391",
    [
      [
        "Foundation",
        ["Define event concept", "Venue & budget", "Venue confirmed"],
      ],
      [
        "Preparation",
        ["Book speakers", "Coordinate vendors", "Program approved"],
      ],
      ["Event delivery", ["Rehearsal", "Final preparations", "Event day"]],
    ],
    ["Event manager", "Producer", "Coordinator"],
  ),
];
export function instantiateTemplate(
  t: Template,
  o: { name: string; start: string; id?: string; calendar?: Calendar },
): ProjectDocument {
  const p = blankProject(o.id ?? id(), o.name, o.start);
  if (o.calendar) p.calendar = o.calendar;
  const ids = new Map(t.tasks.map((x) => [x.id, id()])),
    rs = new Map(t.resources.map((x) => [x.id, id()]));
  p.tasks = t.tasks.map((x) => ({
    ...structuredClone(x),
    id: ids.get(x.id)!,
    parentId: x.parentId ? ids.get(x.parentId)! : null,
    start: o.start,
    finish: o.start,
    earliestStart: null,
    percent: 0,
    actualStart: null,
    actualFinish: null,
    actualFixedCost: 0,
    remainingWork: null,
  }));
  p.dependencies = t.dependencies.map((d) => ({
    ...d,
    id: id(),
    from: ids.get(d.from)!,
    to: ids.get(d.to)!,
  }));
  p.resources = t.resources.map((r) => ({ ...r, id: rs.get(r.id)! }));
  p.assignments = t.assignments.map((a) => ({
    ...a,
    id: id(),
    taskId: ids.get(a.taskId)!,
    resourceId: rs.get(a.resourceId)!,
    actualWork: null,
    actualRate: null,
  }));
  return p;
}
export function toTemplate(p: ProjectDocument): Template {
  const clean = structuredClone(p);
  const resources = clean.resources.map((r, i) => ({
    ...r,
    name: r.role || "Resource " + (i + 1),
  }));
  return {
    id: id(),
    name: p.name,
    description: p.description,
    category: "Your templates",
    color: "#7665df",
    tasks: clean.tasks.map((t) => ({
      ...t,
      percent: 0,
      actualStart: null,
      actualFinish: null,
      actualFixedCost: 0,
      remainingWork: null,
      earliestStart: null,
      start: blankProject().start,
      finish: blankProject().start,
    })),
    dependencies: clean.dependencies,
    resources,
    assignments: clean.assignments.map((a) => ({
      ...a,
      actualWork: null,
      actualRate: null,
    })),
  };
}
