import { useState } from "react";
import { Plus, Trash2, Link2, Users } from "lucide-react";
import { DateTime } from "luxon";
import {
  id,
  newTask,
  type Task,
  type ProjectDocument,
  type Command,
} from "../../shared/model";
import { schedule } from "../../shared/schedule";
import { previewCommands } from "../../shared/commands";
import { Modal, Field } from "./ui";
export function TaskInspector({
  project,
  taskId,
  onSave,
  onClose,
  readOnly = false,
}: {
  project: ProjectDocument;
  taskId: string | null;
  onSave: (c: Command[]) => Promise<unknown>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const existing = project.tasks.find((t) => t.id === taskId),
    s = schedule(project);
  const [task, setTask] = useState<Task>(
    existing
      ? {
          ...existing,
          start: s.tasks[existing.id].start,
          finish: s.tasks[existing.id].finish,
        }
      : newTask(id(), "New task", project.start, project.tasks.length),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [extra, setExtra] = useState<Command[]>([]),
    [predecessor, setPredecessor] = useState(""),
    [linkType, setLinkType] = useState<"FS" | "SS" | "FF" | "SF">("FS"),
    [lag, setLag] = useState(0),
    [resource, setResource] = useState("");
  const summary = existing && s.tasks[existing.id].summary;
  const change = <K extends keyof Task>(key: K, value: Task[K]) =>
    setTask((t) => ({ ...t, [key]: value }));
  const run = async (c: Command[]) => {
    setBusy(true);
    try {
      await onSave(c);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const reference = existing
      ? {
          ...existing,
          start: s.tasks[existing.id].start,
          finish: s.tasks[existing.id].finish,
        }
      : null;
    const patch = Object.fromEntries(
      Object.entries(task).filter(
        ([key, value]) =>
          key !== "id" &&
          JSON.stringify(reference?.[key as keyof Task]) !==
            JSON.stringify(value),
      ),
    ) as Partial<Omit<Task, "id">>;
    const cmds: Command[] = existing
      ? [
          {
            type: "task.update",
            id: task.id,
            patch: summary
              ? Object.fromEntries(
                  Object.entries(patch).filter(([key]) =>
                    [
                      "title",
                      "description",
                      "parentId",
                      "order",
                      "priority",
                    ].includes(key),
                  ),
                )
              : patch,
          },
          ...extra,
        ]
      : [{ type: "task.add", task }, ...extra];
    void run(cmds);
  };
  const dt = (v: string | null) =>
    v
      ? DateTime.fromISO(v)
          .setZone(project.calendar.timezone)
          .toFormat("yyyy-MM-dd'T'HH:mm")
      : "";
  const iso = (v: string) =>
    v
      ? DateTime.fromISO(v, { zone: project.calendar.timezone }).toISO()!
      : null;
  return (
    <Modal
      title={existing ? "Task details" : "Add a task"}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="modal-body">
          <span className="eyebrow">
            {summary
              ? "SUMMARY TASK"
              : task.duration === 0
                ? "MILESTONE"
                : "PLAN THE DETAILS"}
          </span>
          <Field label="Task name">
            <input
              autoFocus
              required
              disabled={readOnly}
              value={task.title}
              onChange={(e) => change("title", e.target.value)}
            />
          </Field>
          <Field label="Description">
            <textarea
              disabled={readOnly}
              value={task.description}
              onChange={(e) => change("description", e.target.value)}
              placeholder="A little context goes a long way…"
              rows={2}
            />
          </Field>
          <div className="form-grid">
            <Field label="Duration (hours)">
              <input
                type="number"
                min="0"
                max="800000"
                step="0.25"
                disabled={readOnly || summary}
                value={task.duration}
                onChange={(e) => change("duration", Number(e.target.value))}
              />
            </Field>
            <Field label="Completion (%)">
              <input
                type="number"
                min="0"
                max="100"
                disabled={readOnly || summary}
                value={task.percent}
                onChange={(e) => {
                  const percent = Number(e.target.value);
                  setTask((t) => ({
                    ...t,
                    percent,
                    actualFinish:
                      percent === 100
                        ? (t.actualFinish ?? project.statusDate)
                        : t.actualFinish,
                  }));
                }}
              />
            </Field>
            <Field label="Start date">
              <input
                type="datetime-local"
                disabled={readOnly || summary}
                value={dt(task.start)}
                onChange={(e) =>
                  setTask((t) => ({
                    ...t,
                    start: iso(e.target.value) ?? project.start,
                    earliestStart: iso(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Scheduling">
              <select
                value={task.manual ? "manual" : "automatic"}
                disabled={readOnly || summary}
                onChange={(e) => change("manual", e.target.value === "manual")}
              >
                <option value="automatic">
                  Automatic · dependencies respected
                </option>
                <option value="manual">Manual · keep my dates</option>
              </select>
            </Field>
            <Field label="Phase / parent">
              <select
                disabled={readOnly}
                value={task.parentId ?? ""}
                onChange={(e) => change("parentId", e.target.value || null)}
              >
                <option value="">Top level</option>
                {project.tasks
                  .filter((t) => t.id !== task.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                disabled={readOnly}
                value={task.priority}
                onChange={(e) =>
                  change("priority", e.target.value as Task["priority"])
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </Field>
          </div>
          {!summary && (
            <>
              <details className="details-section">
                <summary>Actuals & costs</summary>
                <div className="form-grid">
                  <Field label="Actual start">
                    <input
                      type="datetime-local"
                      disabled={readOnly}
                      value={dt(task.actualStart)}
                      onChange={(e) =>
                        change("actualStart", iso(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Actual finish">
                    <input
                      type="datetime-local"
                      disabled={readOnly}
                      value={dt(task.actualFinish)}
                      onChange={(e) =>
                        change("actualFinish", iso(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Fixed cost">
                    <input
                      type="number"
                      min="0"
                      disabled={readOnly}
                      value={task.fixedCost}
                      onChange={(e) => change("fixedCost", +e.target.value)}
                    />
                  </Field>
                  <Field label="Actual fixed cost">
                    <input
                      type="number"
                      min="0"
                      disabled={readOnly}
                      value={task.actualFixedCost}
                      onChange={(e) =>
                        change("actualFixedCost", +e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Remaining work (hours)">
                    <input
                      type="number"
                      min="0"
                      disabled={readOnly}
                      value={task.remainingWork ?? ""}
                      onChange={(e) =>
                        change(
                          "remainingWork",
                          e.target.value === "" ? null : +e.target.value,
                        )
                      }
                    />
                  </Field>
                </div>
              </details>
              <section className="inspector-section">
                <h3>
                  <Link2 size={15} /> Dependencies
                </h3>
                {project.dependencies
                  .filter((d) => d.to === task.id)
                  .map((d) => (
                    <div className="mini-list" key={d.id}>
                      <span>
                        {project.tasks.find((t) => t.id === d.from)?.title}{" "}
                        <small>
                          {d.type} {d.lag ? `${d.lag}h` : ""}
                        </small>
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Remove dependency"
                          onClick={() =>
                            setExtra((v) => [
                              ...v,
                              { type: "dependency.delete", id: d.id },
                            ])
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                {!readOnly && (
                  <div className="inline-fields">
                    <select
                      aria-label="Predecessor task"
                      value={predecessor}
                      onChange={(e) => setPredecessor(e.target.value)}
                    >
                      <option value="">Choose predecessor…</option>
                      {project.tasks
                        .filter(
                          (t) => t.id !== task.id && !s.tasks[t.id].summary,
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label="Dependency type"
                      value={linkType}
                      onChange={(e) =>
                        setLinkType(e.target.value as typeof linkType)
                      }
                    >
                      {["FS", "SS", "FF", "SF"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      aria-label="Lag in hours"
                      value={lag}
                      onChange={(e) => setLag(+e.target.value)}
                      style={{ width: 65 }}
                    />
                    <button
                      type="button"
                      className="secondary compact"
                      disabled={!predecessor}
                      onClick={() => {
                        setExtra((v) => [
                          ...v,
                          {
                            type: "dependency.add",
                            dependency: {
                              id: id(),
                              from: predecessor,
                              to: task.id,
                              type: linkType,
                              lag,
                            },
                          },
                        ]);
                        setPredecessor("");
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </section>
              <section className="inspector-section">
                <h3>
                  <Users size={15} /> Assignments
                </h3>
                {project.assignments
                  .filter((a) => a.taskId === task.id)
                  .map((a) => (
                    <div className="assignment-row" key={a.id}>
                      <span>
                        {
                          project.resources.find((r) => r.id === a.resourceId)
                            ?.name
                        }
                      </span>
                      <label>
                        Allocation %
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          disabled={readOnly}
                          defaultValue={a.allocation}
                          onChange={(e) =>
                            setExtra((v) => [
                              ...v,
                              {
                                type: "assignment.update",
                                id: a.id,
                                patch: { allocation: +e.target.value },
                              },
                            ])
                          }
                        />
                      </label>
                      <label>
                        Actual hours
                        <input
                          type="number"
                          min="0"
                          disabled={readOnly}
                          defaultValue={a.actualWork ?? ""}
                          onChange={(e) =>
                            setExtra((v) => [
                              ...v,
                              {
                                type: "assignment.update",
                                id: a.id,
                                patch: {
                                  actualWork:
                                    e.target.value === ""
                                      ? null
                                      : +e.target.value,
                                  actualRate:
                                    a.actualRate ??
                                    project.resources.find(
                                      (r) => r.id === a.resourceId,
                                    )!.rate,
                                },
                              },
                            ])
                          }
                        />
                      </label>
                      {!readOnly && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Remove assignment"
                          onClick={() =>
                            setExtra((v) => [
                              ...v,
                              { type: "assignment.delete", id: a.id },
                            ])
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                {!readOnly && (
                  <div className="inline-fields">
                    <select
                      aria-label="Assign resource"
                      value={resource}
                      onChange={(e) => setResource(e.target.value)}
                    >
                      <option value="">Choose resource…</option>
                      {project.resources
                        .filter(
                          (r) =>
                            r.active &&
                            !project.assignments.some(
                              (a) =>
                                a.taskId === task.id && a.resourceId === r.id,
                            ),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} · {r.role}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="secondary compact"
                      disabled={!resource}
                      onClick={() => {
                        setExtra((v) => [
                          ...v,
                          {
                            type: "assignment.add",
                            assignment: {
                              id: id(),
                              taskId: task.id,
                              resourceId: resource,
                              allocation: 100,
                              actualWork: null,
                              actualRate: null,
                            },
                          },
                        ]);
                        setResource("");
                      }}
                    >
                      Assign
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          {extra.length > 0 && (
            <p className="hint">
              {extra.length} assignment or dependency change(s) queued for save.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          {existing && !readOnly && (
            <button
              type="button"
              className="danger text-button"
              onClick={() => {
                try {
                  const preview = previewCommands(project, [
                    { type: "task.delete", id: task.id },
                  ]);
                  if (
                    confirm(
                      `Delete ${preview.deleted.tasks} task(s), ${preview.deleted.assignments} assignment(s), and ${preview.deleted.dependencies} dependency link(s)? This can be undone.`,
                    )
                  )
                    void run([{ type: "task.delete", id: task.id }]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Trash2 size={15} />
              Delete task
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          {!readOnly && (
            <button className="primary" disabled={busy}>
              {existing ? "Save changes" : "Create task"}
            </button>
          )}
        </footer>
      </form>
    </Modal>
  );
}
