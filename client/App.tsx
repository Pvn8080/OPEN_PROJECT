import { desktop } from "./desktop";
import { DesktopSettings } from "./components/DesktopSettings";
import { CommandSummary } from "./components/CommandSummary";
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import {
  LayoutDashboard,
  ChartNoAxesGantt,
  Users,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Undo2,
  Redo2,
  History,
  CalendarDays,
  Flag,
  Check,
  FolderKanban,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Cloud,
  AlertCircle,
  LayoutTemplate,
  Menu,
} from "lucide-react";
import { api, type User, type Envelope, type ProjectListItem } from "./api";
import { useProject } from "./state";
import { schedule } from "../shared/schedule";
import { calculateMetrics } from "../shared/metrics";
import { id, type Command } from "../shared/model";
import { Auth } from "./components/Auth";
import { Logo, Avatar, Loading, Modal, date, money } from "./components/ui";
import { Planner } from "./components/Planner";
import { TaskInspector } from "./components/TaskInspector";
import { ResourceView } from "./components/ResourceView";
import { HealthView } from "./components/HealthView";
import { AIPanel } from "./components/AIPanel";
import {
  NewProject,
  BaselineDialog,
  ShareDialog,
  ProjectSettings,
  HistoryPanel,
} from "./components/ProjectDialogs";
export function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [list, setList] = useState<ProjectListItem[]>([]),
    [view, setView] = useState<"planner" | "resources" | "overview">("planner"),
    [ai, setAI] = useState(false),
    [sidebar, setSidebar] = useState(true),
    [dialog, setDialog] = useState<string | null>(null),
    [taskId, setTaskId] = useState<string | null>(null),
    [baselineId, setBaselineId] = useState(""),
    [history, setHistory] = useState<any[]>([]),
    [redoId, setRedoId] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [projectQuery, setProjectQuery] = useState("");
  useEffect(
    () => desktop?.onOpenSettings(() => setDialog("desktop-settings")),
    [],
  );
  const state = useProject(),
    { project: p } = state;
  const doc = p?.document;
  const refreshList = async () => {
    const items = await api<ProjectListItem[]>("/projects");
    setList(items);
    return items;
  };
  const changed = (next: Envelope) => {
    if (state.pending && next.document.id !== state.project?.document.id) {
      state.setError(
        "Review or discard your unsaved draft before switching projects.",
      );
      void refreshList();
      return;
    }
    state.setProject(next);
    void refreshList();
    setRedoId(null);
  };
  const save = async (commands: Command[]) => {
    const next = await state.save(commands);
    if (next) {
      setRedoId(null);
      void refreshList();
      if (commands.some((c) => c.type === "baseline.add"))
        setBaselineId(next.document.baselines.at(-1)?.id ?? "");
    }
    return next;
  };
  const acceptInvite = async () => {
    const token = new URLSearchParams(location.search).get("invite");
    if (!token) return null;
    try {
      const result = await api("/invitations/" + token + "/accept", "POST", {});
      historyReplace();
      setToast("You’re in. Welcome to the project.");
      return result.projectId as string;
    } catch (e) {
      state.setError((e as Error).message);
      return null;
    }
  };
  function historyReplace() {
    window.history.replaceState({}, "", location.pathname);
  }
  const openWorkspace = async (u: User) => {
    setUser(u);
    setBoot(true);
    try {
      const invited = await acceptInvite();
      let items = await refreshList();
      if (invited) {
        await state.load(invited);
      } else if (items.length) {
        const remembered = localStorage.getItem("op-project-" + u.id),
          key = items.some((p) => p.id === remembered)
            ? remembered!
            : items[0].id;
        await state.load(key);
      } else if (u.guest) {
        let demo = await api<Envelope>("/projects", "POST", {
          name: "Website redesign",
          templateId: "launch",
          start: DateTime.now()
            .setZone("America/Los_Angeles")
            .startOf("week")
            .set({ hour: 9 })
            .toISO(),
        });
        const resources = demo.document.resources;
        const leaves = demo.document.tasks.filter((t) => t.parentId);
        const commands: Command[] = [
          {
            type: "project.update",
            patch: {
              description: "A fresh experience. A stronger first impression.",
              statusDate: DateTime.now().toISO()!,
            },
          },
          ...resources.map((r, i) => ({
            type: "resource.update" as const,
            id: r.id,
            patch: { name: ["Mia Chen", "Alex Morgan", "James Wilson"][i] },
          })),
          { type: "baseline.add", name: "Initial plan" },
          ...leaves.slice(0, 2).map((t) => ({
            type: "task.update" as const,
            id: t.id,
            patch: {
              percent: 100,
              actualStart: demo.document.start,
              actualFinish: DateTime.now().toISO()!,
            },
          })),
          { type: "task.update", id: leaves[3].id, patch: { percent: 40 } },
        ];
        demo = await api("/projects/" + demo.document.id + "/changes", "POST", {
          revision: 0,
          requestId: id(),
          commands,
        });
        state.setProject(demo);
        setBaselineId(demo.document.baselines[0].id);
        await refreshList();
      } else setDialog("new");
    } catch (e) {
      state.setError((e as Error).message);
    } finally {
      setBoot(false);
    }
  };
  useEffect(() => {
    api<User>("/auth/session")
      .then(openWorkspace)
      .catch(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (p && user) {
      localStorage.setItem("op-project-" + user.id, p.document.id);
      api("/projects/" + p.document.id + "/history")
        .then(setHistory)
        .catch(() => {});
    }
  }, [p?.document.id, p?.revision]);
  useEffect(() => {
    if (!p) return;
    const timer = setInterval(async () => {
      try {
        const rows = await api<ProjectListItem[]>("/projects");
        const fresh = rows.find((r) => r.id === p.document.id);
        if (fresh && fresh.revision > p.revision)
          setToast(
            "A teammate updated this project. Reload to see their changes.",
          );
      } catch {}
    }, 15000);
    return () => clearInterval(timer);
  }, [p?.document.id, p?.revision]);
  const s = useMemo(() => (doc ? schedule(doc) : null), [doc]);
  const metrics = useMemo(
    () => (doc && s ? calculateMetrics(doc, s, baselineId) : null),
    [doc, s, baselineId],
  );
  const undo = async (key?: string) => {
    if (!p) return;
    const h = key ?? history[0]?.id;
    if (!h) return;
    try {
      const next = await api<Envelope>(
        "/projects/" + p.document.id + "/history/" + h + "/undo",
        "POST",
        { revision: p.revision, requestId: id() },
      );
      state.setProject(next);
      const updated = await api("/projects/" + p.document.id + "/history");
      setHistory(updated);
      setRedoId(key ? null : updated[0]?.id);
      void refreshList();
    } catch (e) {
      state.setError((e as Error).message);
    }
  };
  const logout = async () => {
    if (state.pending) {
      state.setError(
        "Review or discard your unsaved draft before signing out.",
      );
      return;
    }
    setDialog(null);
    await api("/auth/logout", "POST", {});
    setUser(null);
    state.setProject(null);
    setList([]);
  };
  if (boot) return <Loading />;
  if (!user) return <Auth onUser={(u) => void openWorkspace(u)} />;
  return (
    <div
      className={
        "app-shell " +
        (!sidebar ? "sidebar-hidden" : "") +
        (ai ? " with-ai" : "")
      }
    >
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button collapse-nav"
            aria-label="Collapse navigation"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <button
          className="workspace-picker"
          onClick={() => setDialog(desktop ? "desktop-settings" : "account")}
        >
          <span className="workspace-icon">{user.name[0]}</span>
          <span>
            <b>
              {desktop
                ? "My workspace"
                : user.guest
                  ? "Demo workspace"
                  : user.name.split(" ")[0] + "’s workspace"}
            </b>
            <small>
              {desktop
                ? "On this Mac"
                : user.guest
                  ? "Sample projects"
                  : "Team workspace"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="sidebar-search">
          <Search size={14} />
          <input
            aria-label="Find a project"
            placeholder="Find a project…"
            value={projectQuery}
            onChange={(e) => setProjectQuery(e.target.value)}
          />
          <kbd>⌕</kbd>
        </div>
        <span className="nav-caption">Workspace</span>
        <nav className="workspace-nav">
          <button
            className={view === "overview" ? "active" : ""}
            onClick={() => setView("overview")}
          >
            <LayoutDashboard size={17} />
            Overview
          </button>
          <button
            className={view === "planner" ? "active" : ""}
            onClick={() => setView("planner")}
          >
            <ChartNoAxesGantt size={17} />
            Planner{view === "planner" && <span className="nav-active-dot" />}
          </button>
          <button
            className={view === "resources" ? "active" : ""}
            onClick={() => setView("resources")}
          >
            <Users size={17} />
            Resources
          </button>
          <button onClick={() => setDialog("new")}>
            <LayoutTemplate size={17} />
            Templates<span className="new-badge">4+</span>
          </button>
        </nav>
        <div className="project-nav-heading">
          <span className="nav-caption">Projects</span>
          <button
            className="icon-button"
            aria-label="New project"
            onClick={() => setDialog("new")}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="project-nav">
          {list
            .filter((x) =>
              x.name.toLowerCase().includes(projectQuery.toLowerCase()),
            )
            .map((item, i) => (
              <button
                key={item.id}
                className={doc?.id === item.id ? "active" : ""}
                onClick={async () => {
                  try {
                    await state.load(item.id);
                    setBaselineId("");
                    setView("planner");
                  } catch (e) {
                    state.setError((e as Error).message);
                  }
                }}
              >
                <span
                  className="project-dot"
                  style={{
                    background: ["#9a87db", "#75a58c", "#d5a56e"][i % 3],
                  }}
                />
                {item.name}
                {doc?.id === item.id && <ChevronRight size={13} />}
              </button>
            ))}
          {projectQuery &&
            !list.some((x) =>
              x.name.toLowerCase().includes(projectQuery.toLowerCase()),
            ) && <small className="muted">No matching projects.</small>}
        </div>
        <div className="sidebar-bottom">
          <button className="analyst-shortcut" onClick={() => setAI(true)}>
            <Sparkles size={17} />
            <span>
              <b>AI analyst</b>
              <small>Analyze and adjust your plan</small>
            </span>
            <ChevronRight size={14} />
          </button>
          <div className="sidebar-help">
            <span className="prototype-label">
              {desktop ? "On this Mac" : "Web preview"}
            </span>
            <button
              className="icon-button"
              aria-label={desktop ? "App settings" : "Workspace account"}
              onClick={() =>
                setDialog(desktop ? "desktop-settings" : "account")
              }
            >
              <Settings2 size={16} />
            </button>
          </div>
          <div className="user-card">
            <Avatar name={user.name} />
            <button
              className="user-name"
              onClick={() =>
                setDialog(desktop ? "desktop-settings" : "account")
              }
            >
              <b>{user.name}</b>
              <small>
                {desktop
                  ? "Personal workspace"
                  : user.guest
                    ? "Demo account"
                    : user.email}
              </small>
            </button>
            {!desktop && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => void logout()}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            {!sidebar && (
              <button
                className="icon-button"
                aria-label="Open navigation"
                onClick={() => setSidebar(true)}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <FolderKanban size={15} />
            <span>Projects</span>
            <ChevronRight size={13} />
            <b>{doc?.name ?? "Your workspace"}</b>
          </div>
          <div>
            <span className="live-status">
              <i />
              {desktop ? "Local workspace" : "Workspace connected"}
            </span>
            <Avatar name={user.name} small />
          </div>
        </header>
        {doc && p && s && metrics ? (
          <>
            <section className="project-heading">
              <div>
                <div className="project-kicker">
                  <span className="project-tag">Project</span>
                  <span className="muted">
                    {p.role === "viewer"
                      ? "View-only access"
                      : "Working schedule"}
                  </span>
                </div>
                <h1>
                  {doc.name}
                  <button
                    className="icon-button"
                    aria-label="Project settings"
                    disabled={p.role === "viewer"}
                    onClick={() => setDialog("settings")}
                  >
                    <ChevronDown size={18} />
                  </button>
                </h1>
                <p>
                  {doc.description ||
                    "Manage tasks, dependencies and resources."}
                </p>
              </div>
              <div className="project-heading-actions">
                <div className="avatar-stack" aria-label="Assigned resources">
                  {doc.resources.slice(0, 3).map((r) => (
                    <Avatar
                      key={r.id}
                      name={r.name}
                      color={r.color + "30"}
                      small
                    />
                  ))}
                </div>
                <button
                  className="secondary"
                  aria-label="Share project"
                  onClick={() => setDialog(desktop ? "local-sharing" : "share")}
                >
                  <Share2 size={15} />
                  Share
                </button>
                <button
                  className={"ai-toggle " + (ai ? "active" : "")}
                  aria-label="AI analyst"
                  onClick={() => setAI(!ai)}
                >
                  <Sparkles size={16} />
                  AI analyst
                </button>
              </div>
            </section>
            <div className="project-stats">
              <div>
                <span className="stat-icon sage">
                  <Check size={17} />
                </span>
                <span>
                  <small>Schedule completion</small>
                  <b>
                    {Math.round(metrics.percent)}
                    <em>%</em>
                    <span className="stat-track">
                      <i style={{ width: metrics.percent + "%" }} />
                    </span>
                  </b>
                </span>
              </div>
              <div>
                <span className="stat-icon violet">
                  <CalendarDays size={17} />
                </span>
                <span>
                  <small>Project timeline</small>
                  <b className="date-stat">
                    {date(doc.start, doc.calendar.timezone)}
                    <span className="date-separator">—</span>
                    {date(s.finish, doc.calendar.timezone)}
                  </b>
                </span>
              </div>
              <div>
                <span className="stat-icon peach">
                  <Flag size={17} />
                </span>
                <span>
                  <small>Milestones</small>
                  <b>
                    {
                      doc.tasks.filter((t) => !t.duration && t.percent === 100)
                        .length
                    }
                    <em className="stat-outof">
                      / {doc.tasks.filter((t) => !t.duration).length}
                    </em>
                    <span className="stat-small">completed</span>
                  </b>
                </span>
              </div>
              <div>
                <span className="stat-icon blue">
                  <Users size={17} />
                </span>
                <span>
                  <small>Project resources</small>
                  <b>
                    {doc.resources.length}
                    <em className="stat-outof">resources</em>
                    <span className="stat-small">{metrics.work}h planned</span>
                  </b>
                </span>
              </div>
            </div>
            <div className="project-viewbar">
              <div className="view-tabs">
                {[
                  {
                    key: "planner",
                    name: "Gantt planner",
                    icon: ChartNoAxesGantt,
                  },
                  { key: "overview", name: "Insights", icon: LayoutDashboard },
                  { key: "resources", name: "Workload", icon: Users },
                ].map(({ key, name, icon: Icon }) => (
                  <button
                    key={key}
                    className={view === key ? "active" : ""}
                    onClick={() => setView(key as typeof view)}
                  >
                    <Icon size={15} />
                    {name}
                  </button>
                ))}
              </div>
              <div className="view-actions">
                <button
                  className="icon-button"
                  aria-label="Undo last change"
                  disabled={
                    p.role === "viewer" || !history.length || state.saving
                  }
                  onClick={() => void undo()}
                >
                  <Undo2 size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Redo last change"
                  disabled={p.role === "viewer" || !redoId}
                  onClick={() => void undo(redoId!)}
                >
                  <Redo2 size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="View change history"
                  onClick={() => setDialog("history")}
                >
                  <History size={16} />
                </button>
                <span className="toolbar-separator" />
                {doc.baselines.length > 0 && (
                  <select
                    aria-label="Compare baseline"
                    value={baselineId || doc.baselines.at(-1)?.id}
                    onChange={(e) => setBaselineId(e.target.value)}
                  >
                    {doc.baselines.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="secondary compact"
                  disabled={p.role === "viewer"}
                  onClick={() => setDialog("baseline")}
                >
                  <Flag size={13} />
                  Set baseline
                </button>
                <button
                  className="icon-button"
                  aria-label="Save project as template"
                  disabled={p.role === "viewer"}
                  onClick={async () => {
                    try {
                      await api(
                        "/projects/" + doc.id + "/template",
                        "POST",
                        {},
                      );
                      setToast(
                        "Template saved. Find it under Templates or New project.",
                      );
                    } catch (e) {
                      state.setError((e as Error).message);
                    }
                  }}
                >
                  <LayoutTemplate size={16} />
                </button>
              </div>
            </div>
            {state.error && (
              <div className="global-error" role="alert">
                <AlertCircle size={17} />
                <span>{state.error}</span>
                {state.pending && (
                  <>
                    <button
                      className="text-button"
                      onClick={() =>
                        void state
                          .retry()
                          .catch((e) => state.setError(e.message))
                      }
                    >
                      Reload & review draft
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDialog("pending")}
                    >
                      View retained changes
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  onClick={() => state.setError("")}
                >
                  Dismiss
                </button>
              </div>
            )}
            {toast && (
              <div className="toast">
                <Check size={15} />
                {toast}
                {toast.includes("teammate") && (
                  <button
                    className="text-button"
                    onClick={() =>
                      void state.load(doc.id).then(() => setToast(""))
                    }
                  >
                    Reload
                  </button>
                )}
                <button className="text-button" onClick={() => setToast("")}>
                  Dismiss
                </button>
              </div>
            )}
            <div className="workspace-content">
              {view === "planner" ? (
                <Planner
                  key={doc.id}
                  p={doc}
                  onSave={save}
                  onAdd={() => {
                    setTaskId(null);
                    setDialog("task");
                  }}
                  onEdit={(id) => {
                    setTaskId(id);
                    setDialog("task");
                  }}
                  readOnly={p.role === "viewer"}
                  baselineId={baselineId || doc.baselines.at(-1)?.id || ""}
                />
              ) : view === "resources" ? (
                <ResourceView
                  p={doc}
                  onSave={save}
                  onTask={(id) => {
                    setTaskId(id);
                    setDialog("task");
                  }}
                  readOnly={p.role === "viewer"}
                />
              ) : (
                <HealthView
                  p={doc}
                  baselineId={baselineId}
                  onTask={(id) => {
                    setTaskId(id);
                    setDialog("task");
                  }}
                  onAI={() => setAI(true)}
                />
              )}
            </div>
            <footer className="app-status">
              <span>
                <Cloud size={13} />
                {state.saving
                  ? "Saving changes…"
                  : state.pending
                    ? "Unsaved changes retained"
                    : "All changes saved"}
              </span>
              <span>
                Times in{" "}
                {doc.calendar.timezone.split("/").at(-1)?.replaceAll("_", " ")}
                <span>·</span>Revision {p.revision}
                <span>·</span>
                <span className="status-role">{p.role}</span>
              </span>
            </footer>
          </>
        ) : (
          <div className="workspace-empty">
            <Logo />
            <h1>Your next big thing starts here.</h1>
            <p>Create a project and give your ideas a little room to grow.</p>
            <button className="primary" onClick={() => setDialog("new")}>
              <Plus size={16} />
              Create your first project
            </button>
            {state.error && <p className="error">{state.error}</p>}
          </div>
        )}
      </div>
      {ai && p && (
        <AIPanel
          key={p.document.id}
          p={p}
          onClose={() => setAI(false)}
          onChanged={changed}
          onTask={(id) => {
            setTaskId(id);
            setDialog("task");
          }}
        />
      )}
      {dialog === "desktop-settings" && desktop && (
        <DesktopSettings onClose={() => setDialog(null)} />
      )}
      {dialog === "local-sharing" && (
        <Modal title="Share a workspace" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p className="muted">
              This workspace is saved on your Mac. Remote team sharing requires
              a hosted workspace; local invitation links would not work for
              teammates.
            </p>
            <p className="hint">
              You can save a database copy using File → Back Up Workspace.
            </p>
          </div>
          <footer>
            <button className="primary" onClick={() => setDialog(null)}>
              Done
            </button>
          </footer>
        </Modal>
      )}
      {dialog === "task" && doc && (
        <TaskInspector
          key={taskId ?? "new"}
          project={doc}
          taskId={taskId}
          onSave={save}
          onClose={() => setDialog(null)}
          readOnly={p?.role === "viewer"}
        />
      )}
      {dialog === "new" && (
        <NewProject
          onClose={() => setDialog(null)}
          onCreated={(next) => {
            changed(next);
            setBaselineId("");
            setView("planner");
          }}
        />
      )}
      {dialog === "baseline" && (
        <BaselineDialog
          onSave={(name) => save([{ type: "baseline.add", name }])}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "share" && p && (
        <ShareDialog
          p={p}
          guest={!!user.guest}
          onClose={() => setDialog(null)}
          onSignup={() => setDialog("signup")}
        />
      )}
      {dialog === "settings" && doc && (
        <ProjectSettings
          p={doc}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "history" && p && (
        <HistoryPanel
          p={p}
          onChanged={changed}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "account" && (
        <Modal title="Your workspace" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <Avatar name={user.name} />
            <h3>{user.name}</h3>
            <p className="muted">
              {user.guest
                ? "You’re exploring a demo project. Create an account to keep planning with your team."
                : user.email}
            </p>
            {user.guest && (
              <button className="primary" onClick={() => setDialog("signup")}>
                Create an account
              </button>
            )}
            <button className="secondary" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </Modal>
      )}
      {dialog === "signup" && (
        <div className="signup-overlay">
          <Auth
            initialRegister
            onUser={(u) => {
              setUser(u);
              setDialog(null);
              setToast("Account created. Your project is ready to share.");
            }}
            onClose={() => setDialog(null)}
          />
        </div>
      )}
      {dialog === "pending" && state.pending && (
        <Modal
          title="Your retained changes"
          onClose={() => setDialog(null)}
          wide
        >
          <div className="modal-body">
            <p className="muted">
              Review the current revision before applying your retained draft.
            </p>
            <CommandSummary
              commands={state.pending.commands}
              project={p!.document}
              candidate={state.pending.preview.document}
            />
          </div>
          <footer>
            <button
              className="danger text-button"
              onClick={() => {
                state.setPending(null);
                state.setError("");
                setDialog(null);
              }}
            >
              Discard draft
            </button>
            <button className="secondary" onClick={() => setDialog(null)}>
              Keep draft
            </button>
            <button
              className="primary"
              onClick={async () => {
                const cmds = state.pending!.commands;
                setDialog(null);
                try {
                  await save(cmds);
                } catch {}
              }}
            >
              Apply to current revision
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
