import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  LayoutTemplate,
  Plus,
  CalendarDays,
  Copy,
  Trash2,
  UserPlus,
  History,
  Undo2,
} from "lucide-react";
import { DateTime } from "luxon";
import type { ProjectDocument, Command } from "../../shared/model";
import type { Template } from "../../shared/templates";
import { api, type Envelope } from "../api";
import { Modal, Field, Avatar, date } from "./ui";
export function NewProject({
  onCreated,
  onClose,
}: {
  onCreated: (p: Envelope) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]),
    [selected, setSelected] = useState<string>("launch"),
    [name, setName] = useState("My next big project"),
    [start, setStart] = useState(DateTime.now().toISODate()!),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Template[]>("/templates")
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Modal title="Start something great" onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const p = await api<Envelope>("/projects", "POST", {
              name,
              start: DateTime.fromISO(start, { zone: "America/Los_Angeles" })
                .set({ hour: 9 })
                .toISO(),
              templateId: selected || undefined,
            });
            onCreated(p);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          <p className="muted">
            A head start for whatever comes next. Choose a template or make it
            your own.
          </p>
          <div className="template-grid">
            <button
              type="button"
              className={"template-card " + (!selected ? "selected" : "")}
              onClick={() => setSelected("")}
            >
              <Plus size={24} />
              <b>Blank project</b>
              <small>A fresh canvas for your ideas.</small>
              {!selected && <Check className="template-check" size={16} />}
            </button>
            {templates.map((t) => (
              <button
                type="button"
                key={t.id}
                className={
                  "template-card " + (selected === t.id ? "selected" : "")
                }
                onClick={() => setSelected(t.id)}
              >
                <LayoutTemplate size={24} style={{ color: t.color }} />
                <b>{t.name}</b>
                <small>{t.description}</small>
                <span>
                  {t.tasks.filter((x) => x.parentId).length} tasks ·{" "}
                  {t.resources.length} roles
                </span>
                {selected === t.id && (
                  <Check className="template-check" size={16} />
                )}
              </button>
            ))}
          </div>
          {selected && (
            <div className="template-preview">
              <b>What’s in the plan</b>
              <p>
                {templates
                  .find((t) => t.id === selected)
                  ?.tasks.filter((t) => !t.parentId)
                  .map((t) => t.title)
                  .join(" → ")}
              </p>
            </div>
          )}
          <div className="form-grid">
            <Field label="Project name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Project start">
              <input
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Create project <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function BaselineDialog({
  onSave,
  onClose,
}: {
  onSave: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(
      "Baseline " + DateTime.now().toFormat("MMM d"),
    ),
    [error, setError] = useState("");
  return (
    <Modal title="Capture your baseline" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave(name);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="modal-body">
          <span className="dialog-illustration">
            <CalendarDays size={28} />
          </span>
          <p className="muted">
            Save today’s schedule, work, and costs as a reference point. Your
            baseline stays unchanged as your project evolves.
          </p>
          <Field label="Baseline name">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save baseline</button>
        </footer>
      </form>
    </Modal>
  );
}
export function ShareDialog({
  p,
  guest,
  onClose,
  onSignup,
}: {
  p: Envelope;
  guest: boolean;
  onClose: () => void;
  onSignup: () => void;
}) {
  const [members, setMembers] = useState<any[]>([]),
    [invites, setInvites] = useState<any[]>([]),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("editor"),
    [link, setLink] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const load = () =>
    api("/projects/" + p.document.id + "/members").then((x) => {
      setMembers(x.members);
      setInvites(x.invitations);
    });
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <Modal title="Better, together" onClose={onClose}>
      <div className="modal-body">
        <p className="muted">Bring your team into {p.document.name}.</p>
        {guest ? (
          <div className="notice">
            <p>
              Create an account to invite teammates. Your demo project will stay
              with you.
            </p>
            <button className="primary" onClick={onSignup}>
              Create an account
            </button>
          </div>
        ) : (
          p.role === "owner" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const i = await api(
                    "/projects/" + p.document.id + "/invitations",
                    "POST",
                    { email, role },
                  );
                  setLink(window.location.origin + "/?invite=" + i.token);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field label="Invite email">
                <input
                  type="email"
                  required
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <div className="inline-fields">
                <select
                  aria-label="Invitation role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="editor">Editor · can update the plan</option>
                  <option value="viewer">Viewer · read-only access</option>
                  <option value="owner">Owner · manages project access</option>
                </select>
                <button className="primary">
                  <UserPlus size={15} />
                  Create invitation
                </button>
              </div>
            </form>
          )
        )}
        {link && (
          <div className="invitation-result">
            <Field label="Invitation link">
              <input readOnly value={link} />
            </Field>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setError("Copy the invitation link from the field above.");
                }
              }}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy link"}
            </button>
            <small>
              Email was not sent. Share this link with the invited person; it
              expires in 7 days.
            </small>
          </div>
        )}
        <h3 className="section-label">PROJECT MEMBERS</h3>
        {members.map((m) => (
          <div className="member-row" key={m.id}>
            <Avatar name={m.name} />
            <div>
              <b>{m.name}</b>
              <small>{m.email}</small>
            </div>
            {p.role === "owner" ? (
              <select
                aria-label={"Role for " + m.name}
                value={m.role}
                onChange={async (e) => {
                  try {
                    await api(
                      "/projects/" + p.document.id + "/members/" + m.id,
                      "PATCH",
                      { role: e.target.value },
                    );
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {["owner", "editor", "viewer"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            ) : (
              <span className="pill">{m.role}</span>
            )}
          </div>
        ))}
        {invites
          .filter((i) => !i.revoked && i.expires_at > Date.now())
          .map((i) => (
            <div key={i.id} className="mini-list">
              <span>
                {i.email}
                <small>Pending · {i.role}</small>
              </span>
              {p.role === "owner" && (
                <button
                  className="icon-button"
                  aria-label={"Revoke invitation for " + i.email}
                  onClick={async () => {
                    await api(
                      "/projects/" + p.document.id + "/invitations/" + i.id,
                      "DELETE",
                    );
                    await load();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        {error && <p className="error">{error}</p>}
      </div>
    </Modal>
  );
}
export function ProjectSettings({
  p,
  onSave,
  onClose,
}: {
  p: ProjectDocument;
  onSave: (c: Command[]) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(structuredClone(p)),
    [exceptionDate, setExceptionDate] = useState(""),
    [exceptionHours, setExceptionHours] = useState(0),
    [error, setError] = useState("");
  return (
    <Modal title="Project settings" onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave([
              {
                type: "project.update",
                patch: {
                  name: draft.name,
                  description: draft.description,
                  start: draft.start,
                  statusDate: draft.statusDate,
                  currency: draft.currency,
                  calendar: {
                    ...draft.calendar,
                    exceptions: draft.calendar.exceptions,
                  },
                },
              },
            ]);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="modal-body">
          <Field label="Project name">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Project description">
            <textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </Field>
          <div className="form-grid">
            <Field label="Start">
              <input
                type="date"
                value={draft.start.slice(0, 10)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    start: DateTime.fromISO(e.target.value, {
                      zone: draft.calendar.timezone,
                    })
                      .set({ hour: draft.calendar.startHour })
                      .toISO()!,
                  })
                }
              />
            </Field>
            <Field label="Status date">
              <input
                type="date"
                value={draft.statusDate.slice(0, 10)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    statusDate: DateTime.fromISO(e.target.value, {
                      zone: draft.calendar.timezone,
                    })
                      .set({ hour: draft.calendar.startHour })
                      .toISO()!,
                  })
                }
              />
            </Field>
            <Field label="Timezone">
              <input
                required
                value={draft.calendar.timezone}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    calendar: { ...draft.calendar, timezone: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Currency">
              <select
                value={draft.currency}
                onChange={(e) =>
                  setDraft({ ...draft, currency: e.target.value })
                }
              >
                {["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Hours per working day">
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={draft.calendar.hours}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    calendar: { ...draft.calendar, hours: +e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Workday start hour">
              <input
                type="number"
                min="0"
                max="23"
                value={draft.calendar.startHour}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    calendar: { ...draft.calendar, startHour: +e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <div className="working-days">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={draft.calendar.days.includes(i + 1)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      calendar: {
                        ...draft.calendar,
                        days: e.target.checked
                          ? [...draft.calendar.days, i + 1]
                          : draft.calendar.days.filter((d) => d !== i + 1),
                      },
                    })
                  }
                />
                {day}
              </label>
            ))}
          </div>
          <section className="calendar-exceptions">
            <h3>Holidays & special working days</h3>
            <p className="hint">
              Choose a date and the hours available that day. Use 0 for a day
              off.
            </p>
            <div className="form-grid">
              <Field label="Exception date">
                <input
                  type="date"
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                />
              </Field>
              <Field label="Exception working hours">
                <input
                  type="number"
                  min="0"
                  max={24 - draft.calendar.startHour}
                  step="0.25"
                  value={exceptionHours}
                  onChange={(e) => setExceptionHours(+e.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              className="secondary compact"
              disabled={!exceptionDate}
              onClick={() => {
                setDraft({
                  ...draft,
                  calendar: {
                    ...draft.calendar,
                    exceptions: {
                      ...draft.calendar.exceptions,
                      [exceptionDate]: exceptionHours,
                    },
                  },
                });
                setExceptionDate("");
              }}
            >
              <Plus size={14} />
              Add exception
            </button>
            {Object.entries(draft.calendar.exceptions)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, hours]) => (
                <div key={date} className="mini-list">
                  <span>
                    {DateTime.fromISO(date).toFormat("MMMM d, yyyy")}
                    <small>
                      {hours === 0 ? "Day off" : `${hours} working hours`}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Remove calendar exception " + date}
                    onClick={() => {
                      const exceptions = { ...draft.calendar.exceptions };
                      delete exceptions[date];
                      setDraft({
                        ...draft,
                        calendar: { ...draft.calendar, exceptions },
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </section>
          <p className="hint">
            Use 0 hours for a holiday. Changes recalculate automatic tasks;
            baseline snapshots remain intact.
          </p>
          {error && <p className="error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save settings</button>
        </footer>
      </form>
    </Modal>
  );
}
export function HistoryPanel({
  p,
  onChanged,
  onClose,
}: {
  p: Envelope;
  onChanged: (p: Envelope) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  const load = () =>
    api("/projects/" + p.document.id + "/history").then(setRows);
  useEffect(() => {
    load();
  }, [p.revision]);
  return (
    <Modal title="Project history" onClose={onClose}>
      <div className="modal-body">
        <p className="muted">
          Every change has a story. Undo creates a new history entry and
          protects later edits.
        </p>
        {rows.length === 0 && (
          <p className="muted">
            No edits yet. Your next change will appear here.
          </p>
        )}
        {rows.map((r, i) => (
          <div className="history-row" key={r.id}>
            <span className="history-dot">
              <History size={14} />
            </span>
            <div>
              <b>{r.label}</b>
              <small>
                {r.actor} · {new Date(r.created_at).toLocaleString()} · v
                {r.revision}
              </small>
            </div>
            {p.role !== "viewer" && i === 0 && (
              <button
                className="secondary compact"
                onClick={async () => {
                  try {
                    onChanged(
                      await api(
                        "/projects/" +
                          p.document.id +
                          "/history/" +
                          r.id +
                          "/undo",
                        "POST",
                        {
                          revision: p.revision,
                          requestId: crypto.randomUUID(),
                        },
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Undo2 size={14} />
                Reverse
              </button>
            )}
          </div>
        ))}
        {error && <p className="error">{error}</p>}
      </div>
    </Modal>
  );
}
