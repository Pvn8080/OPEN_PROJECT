import { useState } from "react";
import { DateTime } from "luxon";
import {
  Plus,
  Users,
  AlertTriangle,
  Briefcase,
  Monitor,
  ArrowRight,
} from "lucide-react";
import {
  id,
  type ProjectDocument,
  type Resource,
  type Command,
} from "../../shared/model";
import { schedule } from "../../shared/schedule";
import { calculateMetrics } from "../../shared/metrics";
import { Modal, Field, Avatar, money, Empty } from "./ui";
export function ResourceView({
  p,
  onSave,
  onTask,
  readOnly,
}: {
  p: ProjectDocument;
  onSave: (c: Command[]) => Promise<unknown>;
  onTask: (id: string) => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState<Resource | null>(null),
    [creating, setCreating] = useState(false),
    [period, setPeriod] = useState("week");
  const s = schedule(p),
    m = calculateMetrics(p, s);
  const start = DateTime.fromISO(p.start)
      .setZone(p.calendar.timezone)
      .startOf("week"),
    count = period === "week" ? 8 : 14;
  const buckets = Array.from({ length: count }, (_, i) =>
    start.plus(period === "week" ? { weeks: i } : { days: i }),
  );
  return (
    <div className="view-page">
      <header className="view-header">
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND THE PLAN</span>
          <h2>Resource planning</h2>
          <p>A balanced workload. A team set up to do its best.</p>
        </div>
        <button
          className="primary"
          disabled={readOnly}
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus size={16} />
          Add resource
        </button>
      </header>
      <div className="resource-summary">
        <div>
          <Users size={20} />
          <span>
            <b>{p.resources.filter((r) => r.kind === "person").length}</b>People
          </span>
        </div>
        <div>
          <Monitor size={20} />
          <span>
            <b>{p.resources.filter((r) => r.kind === "equipment").length}</b>
            Equipment
          </span>
        </div>
        <div>
          <Briefcase size={20} />
          <span>
            <b>{m.work.toLocaleString()}h</b>Planned work
          </span>
        </div>
        <div className={m.overloads.length ? "warning-stat" : ""}>
          <AlertTriangle size={20} />
          <span>
            <b>{new Set(m.overloads.map((o) => o.resourceId)).size}</b>
            Overallocated resources
          </span>
        </div>
      </div>
      <section className="surface">
        <div className="surface-title">
          <h3>
            Team capacity{" "}
            <span className="count-badge">{p.resources.length}</span>
          </h3>
          <div className="segmented">
            <button
              className={period === "week" ? "active" : ""}
              onClick={() => setPeriod("week")}
            >
              Weekly
            </button>
            <button
              className={period === "day" ? "active" : ""}
              onClick={() => setPeriod("day")}
            >
              Daily
            </button>
          </div>
        </div>
        <div className="workload-scroll">
          <table className="workload-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Rate / hour</th>
                {buckets.map((d) => (
                  <th key={d.toISO()}>{d.toFormat("MMM d")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.resources.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="resource-name"
                      onClick={() => setEditing(r)}
                    >
                      <Avatar name={r.name} color={r.color + "25"} />
                      <span>
                        <b>{r.name}</b>
                        <small>
                          {r.role} · {r.capacity}% capacity
                          {!r.active ? " · inactive" : ""}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>{money(r.rate, p.currency)}</td>
                  {buckets.map((d) => {
                    const end = d.plus(
                      period === "week" ? { weeks: 1 } : { days: 1 },
                    );
                    const rows = m.workloads.filter(
                      (w) =>
                        w.resourceId === r.id &&
                        w.date >= d.toISODate()! &&
                        w.date < end.toISODate()!,
                    );
                    const demand = rows.reduce((a, w) => a + w.demand, 0);
                    let capacity = 0;
                    for (let day = d; day < end; day = day.plus({ days: 1 })) {
                      capacity +=
                        ((p.calendar.exceptions[day.toISODate()!] ??
                          (p.calendar.days.includes(day.weekday)
                            ? p.calendar.hours
                            : 0)) *
                          r.capacity) /
                        100;
                    }
                    const ratio = capacity ? demand / capacity : 0,
                      over = rows.some((w) => w.demand > w.capacity);
                    return (
                      <td key={d.toISO()}>
                        <button
                          className={
                            "capacity-cell " +
                            (over ? "over" : demand ? "allocated" : "")
                          }
                          onClick={() => {
                            const ids = rows.flatMap((w) => w.taskIds);
                            if (ids.length) onTask(ids[0]);
                          }}
                          disabled={!demand}
                          title={`${r.name}: ${demand.toFixed(1)}h assigned / ${capacity.toFixed(1)}h capacity${over ? " · daily overload" : ""}`}
                        >
                          <b>{demand ? `${+demand.toFixed(1)}h` : "—"}</b>
                          {demand > 0 && (
                            <span className="capacity-track">
                              <i
                                style={{
                                  width: Math.min(100, ratio * 100) + "%",
                                }}
                              />
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!p.resources.length && (
            <Empty
              title="Meet your project team"
              description="Add people or equipment, then assign them to tasks."
            />
          )}
        </div>
        <div className="surface-foot">
          <span>
            <i className="legend-dot green" />
            Within capacity
          </span>
          <span>
            <i className="legend-dot red" />
            Daily overload
          </span>
          <small>Select a workload cell to see the assigned task.</small>
        </div>
      </section>
      {m.overloads.length > 0 && (
        <section className="surface">
          <div className="surface-title">
            <h3>
              <AlertTriangle size={16} />
              Capacity conflicts
            </h3>
            <span className="pill warning">Needs a little attention</span>
          </div>
          <div className="conflict-list">
            {m.overloads.slice(0, 15).map((o) => (
              <div key={o.resourceId + o.date}>
                <Avatar
                  name={p.resources.find((r) => r.id === o.resourceId)!.name}
                />
                <span>
                  <b>{p.resources.find((r) => r.id === o.resourceId)!.name}</b>
                  <small>
                    {DateTime.fromISO(o.date).toFormat("MMM d")} ·{" "}
                    {o.demand.toFixed(1)}h planned against{" "}
                    {o.capacity.toFixed(1)}h capacity
                  </small>
                </span>
                <button
                  className="text-button"
                  onClick={() => onTask(o.taskIds[0])}
                >
                  Review tasks
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {(editing || creating) && (
        <ResourceEditor
          key={editing?.id ?? "new"}
          initial={editing}
          currency={p.currency}
          project={p}
          readOnly={readOnly}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={onSave}
        />
      )}
    </div>
  );
}
function ResourceEditor({
  initial,
  currency,
  project,
  onSave,
  onClose,
  readOnly,
}: {
  initial: Resource | null;
  currency: string;
  project: ProjectDocument;
  onSave: (c: Command[]) => Promise<unknown>;
  onClose: () => void;
  readOnly: boolean;
}) {
  const [r, setR] = useState<Resource>(
      initial ?? {
        id: id(),
        name: "",
        role: "",
        kind: "person",
        capacity: 100,
        rate: 75,
        active: true,
        color: "#8673cf",
      },
    ),
    [error, setError] = useState("");
  return (
    <Modal
      title={initial ? "Resource details" : "Add a resource"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const before = calculateMetrics(project, schedule(project)).cost;
            const next = {
              ...project,
              resources: project.resources.map((resource) =>
                resource.id === r.id ? r : resource,
              ),
            };
            const after = calculateMetrics(next, schedule(next)).cost;
            if (
              initial &&
              initial.rate !== r.rate &&
              !confirm(
                `Change hourly rate from ${money(initial.rate, currency)} to ${money(r.rate, currency)}? Current planned cost: ${money(before, currency)} → ${money(after, currency)} (${money(after - before, currency)} change). Baseline costs remain unchanged.`,
              )
            )
              return;
            const { id: _, ...patch } = r;
            await onSave([
              initial
                ? { type: "resource.update", id: r.id, patch }
                : { type: "resource.add", resource: r },
            ]);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="modal-body">
          <Field label="Resource name">
            <input
              required
              autoFocus
              disabled={readOnly}
              value={r.name}
              onChange={(e) => setR({ ...r, name: e.target.value })}
            />
          </Field>
          <Field label="Role / category">
            <input
              disabled={readOnly}
              value={r.role}
              onChange={(e) => setR({ ...r, role: e.target.value })}
              placeholder="Designer, developer, equipment…"
            />
          </Field>
          <div className="form-grid">
            <Field label="Resource type">
              <select
                disabled={readOnly}
                value={r.kind}
                onChange={(e) =>
                  setR({ ...r, kind: e.target.value as Resource["kind"] })
                }
              >
                <option value="person">Person</option>
                <option value="equipment">Equipment</option>
              </select>
            </Field>
            <Field label="Capacity (%)">
              <input
                type="number"
                min="1"
                max="1000"
                disabled={readOnly}
                value={r.capacity}
                onChange={(e) => setR({ ...r, capacity: +e.target.value })}
              />
            </Field>
            <Field label={"Hourly rate (" + currency + ")"}>
              <input
                type="number"
                min="0"
                disabled={readOnly}
                value={r.rate}
                onChange={(e) => setR({ ...r, rate: +e.target.value })}
              />
            </Field>
            <Field label="Resource color">
              <input
                type="color"
                disabled={readOnly}
                value={r.color}
                onChange={(e) => setR({ ...r, color: e.target.value })}
              />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={r.active}
              onChange={(e) => setR({ ...r, active: e.target.checked })}
            />
            Available for new assignments
          </label>
          <p className="hint">
            Resources can be planned without a user account. Assignments never
            silently change task durations.
          </p>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          {initial && !readOnly && (
            <button
              type="button"
              className="danger text-button"
              onClick={async () => {
                if (
                  confirm(
                    "Delete this resource and its current assignments? Baselines and history are retained.",
                  )
                ) {
                  try {
                    await onSave([{ type: "resource.delete", id: r.id }]);
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              }}
            >
              Delete resource
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          {!readOnly && (
            <button className="primary">
              {initial ? "Save resource" : "Create resource"}
            </button>
          )}
        </footer>
      </form>
    </Modal>
  );
}
