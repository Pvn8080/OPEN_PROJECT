import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DateTime } from "luxon";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  GripVertical,
  Flag,
  SlidersHorizontal,
  Link2,
  ArrowRight,
  CornerDownRight,
  CornerUpLeft,
} from "lucide-react";
import type {
  ProjectDocument,
  ScheduleResult,
  Task,
  Command,
  ChangePreview,
} from "../../shared/model";
import { id } from "../../shared/model";
import { schedule } from "../../shared/schedule";
import { previewCommands } from "../../shared/commands";
import {
  addWorkingHours,
  normalizeStart,
  workingHoursBetween,
} from "../../shared/calendar";
import { Avatar, Modal, date, Empty } from "./ui";
import { TaskSearch } from "./TaskSearch";
import { TimelineHeader } from "./TimelineHeader";
// Resource colors are user-selected, so labels must adapt to their background.
function barTextColor(hex: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
export function Planner({
  p,
  onSave,
  onEdit,
  onAdd,
  readOnly,
  baselineId,
}: {
  p: ProjectDocument;
  onSave: (c: Command[]) => Promise<unknown>;
  onEdit: (id: string) => void;
  onAdd: () => void;
  readOnly: boolean;
  baselineId: string;
}) {
  const [query, setQuery] = useState(""),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [zoom, setZoom] = useState(38),
    [colorMode, setColorMode] = useState("status"),
    [selected, setSelected] = useState<string | null>(null),
    [columns, setColumns] = useState(false),
    [showOwner, setShowOwner] = useState(true),
    [showCompletion, setShowCompletion] = useState(true),
    [gridWidth, setGridWidth] = useState(580),
    [proposal, setProposal] = useState<{
      commands: Command[];
      preview: ChangePreview;
    } | null>(null),
    [error, setError] = useState(""),
    [linking, setLinking] = useState<string | null>(null),
    [ghost, setGhost] = useState<{
      id: string;
      delta: number;
      resize: boolean;
    } | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [editTitle, setEditTitle] = useState("");
  const scroll = useRef<HTMLDivElement>(null),
    dragging = useRef<string | null>(null);
  const s = useMemo(() => schedule(p), [p]);
  const base = DateTime.fromISO(p.start)
    .setZone(p.calendar.timezone)
    .startOf("week")
    .minus({ days: 1 });
  const finish = DateTime.fromISO(s.finish).setZone(p.calendar.timezone);
  const days = Math.max(
      35,
      Math.min(730, Math.ceil(finish.diff(base, "days").days) + 10),
    ),
    width = days * zoom;
  const coordinateCache = useMemo(
    () => new Map<string, number>(),
    [s, zoom, base.toISO()],
  );
  const x = (value: string) => {
    const existing = coordinateCache.get(value);
    if (existing !== undefined) return existing;
    const n =
      DateTime.fromISO(value).setZone(p.calendar.timezone).diff(base, "days")
        .days * zoom;
    coordinateCache.set(value, n);
    return n;
  };
  const parentIds = new Set(p.tasks.map((t) => t.parentId).filter(Boolean));
  const ordered = useMemo(() => {
    const rows: { task: Task; depth: number }[] = [];
    const groups = new Map<string | null, Task[]>(),
      byId = new Map(p.tasks.map((t) => [t.id, t]));
    for (const t of p.tasks)
      groups.set(t.parentId, [...(groups.get(t.parentId) ?? []), t]);
    for (const group of groups.values())
      group.sort((a, b) => a.order - b.order);
    const matches = new Set<string>();
    if (query)
      for (const t of p.tasks)
        if (t.title.toLowerCase().includes(query.toLowerCase())) {
          matches.add(t.id);
          let parent = t.parentId;
          while (parent) {
            matches.add(parent);
            parent = byId.get(parent)?.parentId ?? null;
          }
        }
    const walk = (parent: string | null, depth: number) => {
      for (const t of groups.get(parent) ?? []) {
        if (!query || matches.has(t.id)) rows.push({ task: t, depth });
        if (!collapsed.has(t.id) || query) walk(t.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [p, collapsed, query]);
  const virtual = useVirtualizer({
    count: ordered.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 46,
    overscan: 8,
  });
  const old = p.baselines.find((b) => b.id === baselineId);
  const bs = useMemo(() => (old ? schedule(old.document) : null), [old]);
  const submit = async (commands: Command[]) => {
    try {
      await onSave(commands);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const propose = (commands: Command[]) => {
    try {
      setProposal({ commands, preview: previewCommands(p, commands) });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const moveCommands = (
    task: Task,
    delta: number,
    resize: boolean,
  ): Command[] => {
    if (resize)
      return [
        {
          type: "task.update",
          id: task.id,
          patch: {
            duration: Math.max(
              0,
              task.duration + Math.round(delta) * p.calendar.hours,
            ),
          },
        },
      ];
    const start = normalizeStart(
      DateTime.fromISO(s.tasks[task.id].start)
        .setZone(p.calendar.timezone)
        .plus({ days: Math.round(delta) })
        .toISO()!,
      p.calendar,
    );
    return [{ type: "task.update", id: task.id, patch: { start } }];
  };
  const pointer = (e: PointerEvent, task: Task, resize: boolean) => {
    if (readOnly || s.tasks[task.id].summary) return;
    e.preventDefault();
    e.stopPropagation();
    const initial = e.clientX,
      el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let delta = 0;
    const move = (ev: globalThis.PointerEvent) => {
      delta = (ev.clientX - initial) / zoom;
      setGhost({ id: task.id, delta, resize });
    };
    const cleanup = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      setGhost(null);
    };
    const up = () => {
      cleanup();
      if (Math.abs(delta) >= 0.5) propose(moveCommands(task, delta, resize));
    };
    const cancel = () => cleanup();
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") cleanup();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
  };
  const link = (target: string) => {
    if (linking && linking !== target) {
      propose([
        {
          type: "dependency.add",
          dependency: {
            id: id(),
            from: linking,
            to: target,
            type: "FS",
            lag: 0,
          },
        },
      ]);
      setLinking(null);
    }
  };
  const indent = (out = false) => {
    if (!selected) return;
    const index = ordered.findIndex((r) => r.task.id === selected),
      t = ordered[index]?.task;
    if (!t) return;
    if (out) {
      const parent = p.tasks.find((x) => x.id === t.parentId);
      if (parent)
        propose([
          {
            type: "task.update",
            id: t.id,
            patch: { parentId: parent.parentId, order: parent.order + 0.5 },
          },
        ]);
    } else {
      const siblings = p.tasks
        .filter((candidate) => candidate.parentId === t.parentId)
        .sort((a, b) => a.order - b.order);
      const previous =
        siblings[siblings.findIndex((candidate) => candidate.id === t.id) - 1];
      if (previous)
        propose([
          { type: "task.update", id: t.id, patch: { parentId: previous.id } },
        ]);
    }
  };
  const drop = (target: Task) => {
    const from = dragging.current;
    dragging.current = null;
    if (!from || from === target.id) return;
    const current = p.tasks.find((t) => t.id === from)!;
    const siblings = p.tasks
      .filter((t) => t.parentId === target.parentId && t.id !== from)
      .sort((a, b) => a.order - b.order);
    siblings.splice(
      siblings.findIndex((t) => t.id === target.id),
      0,
      current,
    );
    propose(
      siblings.map((t, i) => ({
        type: "task.update",
        id: t.id,
        patch: { order: i, parentId: target.parentId },
      })),
    );
  };
  const rowIndex = new Map(ordered.map((r, i) => [r.task.id, i]));
  const taskResources = useMemo(() => {
    const resources = new Map(p.resources.map((r) => [r.id, r]));
    const result = new Map<string, (typeof p.resources)[number]>();
    for (const a of p.assignments) {
      const r = resources.get(a.resourceId);
      if (r && !result.has(a.taskId)) result.set(a.taskId, r);
    }
    return result;
  }, [p]);
  const visibleRows = virtual.getVirtualItems();
  const firstVisible = visibleRows[0]?.index ?? 0,
    lastVisible = visibleRows.at(-1)?.index ?? 0;
  const color = (t: Task) => {
    if (colorMode === "risk")
      return s.critical.includes(t.id) ? "#c2413b" : "#477d68";
    if (colorMode === "owner") {
      const a = p.assignments.find((a) => a.taskId === t.id);
      return (
        p.resources.find((r) => r.id === a?.resourceId)?.color ?? "#a4a5b5"
      );
    }
    return t.percent === 100
      ? "#348063"
      : t.percent > 0
        ? "#2563b5"
        : "#8c9fb5";
  };
  return (
    <section className="planner-card">
      <div className="planner-toolbar">
        <div className="toolbar-left">
          <button
            className="primary compact"
            disabled={readOnly}
            onClick={onAdd}
          >
            <Plus size={15} />
            Add task
          </button>
          <div className="toolbar-separator" />
          <button
            className="icon-button"
            aria-label="Indent task"
            disabled={readOnly || !selected}
            onClick={() => indent()}
          >
            <CornerDownRight size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Outdent task"
            disabled={readOnly || !selected}
            onClick={() => indent(true)}
          >
            <CornerUpLeft size={16} />
          </button>
          <button
            className="secondary compact"
            onClick={() =>
              setCollapsed(
                collapsed.size
                  ? new Set()
                  : new Set([...parentIds] as string[]),
              )
            }
          >
            <ChevronsUpDown size={14} />
            <span>Phases</span>
          </button>
        </div>
        <div className="toolbar-right">
          <TaskSearch onQuery={setQuery} />
          <button
            className={"icon-button " + (columns ? "active" : "")}
            aria-label="Choose columns"
            onClick={() => setColumns(!columns)}
          >
            <SlidersHorizontal size={16} />
          </button>
          <select
            aria-label="Timeline zoom"
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          >
            <option value={54}>Day</option>
            <option value={38}>Week</option>
            <option value={22}>Month</option>
          </select>
          <button
            className="secondary compact"
            onClick={() => {
              const today = x(DateTime.now().toISO()!);
              scroll.current?.scrollTo({
                left: Math.max(0, today - 200),
                behavior: "smooth",
              });
            }}
          >
            Today
          </button>
        </div>
      </div>
      {columns && (
        <div className="column-picker">
          <label>
            <input
              type="checkbox"
              checked={showOwner}
              onChange={(e) => setShowOwner(e.target.checked)}
            />
            Resource
          </label>
          <label>
            <input
              type="checkbox"
              checked={showCompletion}
              onChange={(e) => setShowCompletion(e.target.checked)}
            />
            Completion
          </label>
          <label>
            Task pane width
            <input
              type="range"
              min="400"
              max="800"
              value={gridWidth}
              onChange={(e) => setGridWidth(+e.target.value)}
            />
          </label>
        </div>
      )}
      {linking && (
        <div className="notice slim">
          <Link2 size={14} />
          Select another task bar to add a finish-to-start dependency.
          <button className="text-button" onClick={() => setLinking(null)}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <div className="error slim" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      <div
        className="planner-scroll"
        ref={scroll}
        style={
          {
            "--grid-width": gridWidth + "px",
            "--day-width": zoom + "px",
          } as React.CSSProperties
        }
      >
        <div
          style={{
            width: gridWidth + width,
            minWidth: "100%",
            position: "relative",
          }}
        >
          <div className="planner-header" style={{ width: gridWidth + width }}>
            <div
              className="grid-header"
              style={{
                width: gridWidth,
                gridTemplateColumns: `32px minmax(120px,1fr) 60px ${showOwner ? "86px " : ""}${showCompletion ? "82px" : ""}`,
              }}
            >
              <span>#</span>
              <span>
                Task name <ChevronDown size={12} />
              </span>
              <span>Duration</span>
              {showOwner && <span>Resource</span>}
              {showCompletion && <span>Complete</span>}
            </div>
            <TimelineHeader
              base={base.toISO()!}
              days={days}
              zoom={zoom}
              timezone={p.calendar.timezone}
              today={DateTime.now().setZone(p.calendar.timezone).toISODate()!}
            />
          </div>
          <div
            style={{
              height: virtual.getTotalSize(),
              position: "relative",
              minHeight: 270,
            }}
          >
            {!ordered.length && (
              <div className="grid-empty" style={{ width: gridWidth }}>
                <Empty
                  title={query ? "No matching tasks" : "A clear canvas"}
                  description={
                    query
                      ? "Try another search."
                      : "Add your first task to get things moving."
                  }
                >
                  {!query && (
                    <button
                      className="secondary"
                      onClick={onAdd}
                      disabled={readOnly}
                    >
                      <Plus size={15} />
                      Add a task
                    </button>
                  )}
                </Empty>
              </div>
            )}
            <svg
              className="dependency-layer"
              style={{ left: gridWidth, width, height: virtual.getTotalSize() }}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="arrow"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                >
                  <path d="M0 0 L5 2.5 L0 5" fill="#94a3b8" />
                </marker>
              </defs>
              {p.dependencies.map((d) => {
                const from = rowIndex.get(d.from) ?? -1,
                  to = rowIndex.get(d.to) ?? -1;
                if (
                  from < 0 ||
                  to < 0 ||
                  Math.max(from, to) < firstVisible ||
                  Math.min(from, to) > lastVisible
                )
                  return null;
                const a = s.tasks[d.from],
                  b = s.tasks[d.to],
                  sx = x(d.type[0] === "F" ? a.finish : a.start),
                  tx = x(d.type[1] === "F" ? b.finish : b.start),
                  sy = from * 46 + 23,
                  ty = to * 46 + 23;
                return (
                  <path
                    key={d.id}
                    d={`M${sx},${sy} H${sx + 10} V${ty} H${tx - 3}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    markerEnd="url(#arrow)"
                  />
                );
              })}
            </svg>
            {visibleRows.map((row) => {
              const { task: t, depth } = ordered[row.index],
                st = s.tasks[t.id],
                resource = taskResources.get(t.id);
              let left = x(st.start),
                barWidth = Math.max(t.duration ? 12 : 0, x(st.finish) - left);
              if (ghost?.id === t.id) {
                if (ghost.resize)
                  barWidth = Math.max(12, barWidth + ghost.delta * zoom);
                else left += ghost.delta * zoom;
              }
              const baseline = bs?.tasks[t.id];
              return (
                <div
                  key={t.id}
                  className={
                    "planner-row " +
                    (selected === t.id ? "selected " : "") +
                    (st.summary ? "summary-row" : "")
                  }
                  style={{
                    transform: `translateY(${row.start}px)`,
                    width: gridWidth + width,
                    height: 46,
                  }}
                >
                  <div
                    className="grid-cells"
                    style={{
                      width: gridWidth,
                      gridTemplateColumns: `32px minmax(120px,1fr) 60px ${showOwner ? "86px " : ""}${showCompletion ? "82px" : ""}`,
                    }}
                    onClick={() => setSelected(t.id)}
                    onDragOver={(e) => {
                      if (!readOnly) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(t);
                    }}
                  >
                    <span className="row-number">
                      <span>{row.index + 1}</span>
                      {!readOnly && (
                        <button
                          className="drag-handle"
                          draggable
                          aria-label={"Reorder " + t.title}
                          onDragStart={() => {
                            dragging.current = t.id;
                          }}
                        >
                          <GripVertical size={13} />
                        </button>
                      )}
                    </span>
                    <div
                      className="task-title"
                      style={{ paddingLeft: depth * 17 }}
                    >
                      {st.summary ? (
                        <button
                          className="collapse-button"
                          aria-label={
                            (collapsed.has(t.id) ? "Expand " : "Collapse ") +
                            t.title
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsed((c) => {
                              const n = new Set(c);
                              n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                              return n;
                            });
                          }}
                        >
                          {collapsed.has(t.id) ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      ) : t.duration === 0 ? (
                        <Flag size={13} className="milestone-icon" />
                      ) : (
                        <span
                          className={
                            "task-status " +
                            (t.percent === 100
                              ? "done"
                              : t.percent > 0
                                ? "progress"
                                : "")
                          }
                        >
                          {t.percent === 100 ? "✓" : ""}
                        </span>
                      )}
                      {editing === t.id ? (
                        <input
                          autoFocus
                          aria-label="Edit task title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => {
                            if (editTitle.trim() && editTitle !== t.title)
                              void submit([
                                {
                                  type: "task.update",
                                  id: t.id,
                                  patch: { title: editTitle },
                                },
                              ]);
                            setEditing(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        <button
                          className="title-button"
                          onClick={() => onEdit(t.id)}
                          onDoubleClick={(e) => {
                            if (!readOnly) {
                              e.preventDefault();
                              setEditing(t.id);
                              setEditTitle(t.title);
                            }
                          }}
                        >
                          {t.title}
                        </button>
                      )}
                      {s.critical.includes(t.id) && !st.summary && (
                        <span className="critical-dot" title="Critical path" />
                      )}
                    </div>
                    <span className="cell-duration">
                      {st.summary
                        ? +(
                            workingHoursBetween(
                              st.start,
                              st.finish,
                              p.calendar,
                            ) / p.calendar.hours
                          ).toFixed(1) + "d"
                        : t.duration === 0
                          ? "—"
                          : `${+(t.duration / p.calendar.hours).toFixed(1)}d`}
                    </span>
                    {showOwner && (
                      <span className="cell-owner">
                        {resource ? (
                          <>
                            <Avatar
                              name={resource.name}
                              color={resource.color + "25"}
                              small
                            />
                            <span>{resource.name.split(" ")[0]}</span>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                    )}
                    {showCompletion && (
                      <span className="cell-complete">
                        <span className="mini-progress">
                          <i
                            style={{
                              width: st.percent + "%",
                              background:
                                st.percent === 100 ? "#348063" : "#2563b5",
                            }}
                          />
                        </span>
                        <span>{Math.round(st.percent)}%</span>
                      </span>
                    )}
                  </div>
                  <div
                    className="timeline-cells"
                    style={{
                      left: gridWidth,
                      width,
                      backgroundSize: `${zoom * 7}px 100%, ${zoom}px 100%`,
                      backgroundPosition: `${zoom * 6}px 0, 0 0`,
                    }}
                  >
                    {baseline && (
                      <span
                        className="baseline-bar"
                        style={{
                          left: x(baseline.start),
                          width: Math.max(
                            5,
                            x(baseline.finish) - x(baseline.start),
                          ),
                        }}
                        title="Baseline schedule"
                      />
                    )}
                    {st.summary ? (
                      <div
                        className="summary-bar"
                        style={{ left, width: barWidth }}
                      >
                        <span>{t.title}</span>
                      </div>
                    ) : t.duration === 0 ? (
                      <button
                        className="milestone-bar"
                        data-task-id={t.id}
                        aria-label={"Milestone: " + t.title}
                        style={{ left: left - 6 }}
                        onClick={() => (linking ? link(t.id) : onEdit(t.id))}
                      />
                    ) : (
                      <div
                        className={
                          "gantt-bar " +
                          (ghost?.id === t.id ? "dragging " : "") +
                          (linking ? "link-target" : "")
                        }
                        data-task-id={t.id}
                        style={{ left, width: barWidth, background: color(t) }}
                        onPointerDown={(e) => {
                          if (linking) {
                            e.stopPropagation();
                            link(t.id);
                          } else pointer(e, t, false);
                        }}
                        onDoubleClick={() => onEdit(t.id)}
                        role="group"
                        onKeyDown={(e) => {
                          if (readOnly) return;
                          if (e.key === "Enter") onEdit(t.id);
                          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                            e.preventDefault();
                            propose(
                              moveCommands(
                                t,
                                e.key === "ArrowRight" ? 1 : -1,
                                e.shiftKey,
                              ),
                            );
                          }
                        }}
                      >
                        <button
                          className="bar-keyboard"
                          aria-label={`Move ${t.title}, ${date(st.start, p.calendar.timezone)} to ${date(st.finish, p.calendar.timezone)}`}
                          onClick={() => {
                            if (linking) link(t.id);
                          }}
                        />
                        <span
                          className="bar-completion"
                          style={{ width: t.percent + "%" }}
                        />
                        <span
                          className="bar-label"
                          style={{ color: barTextColor(color(t)) }}
                        >
                          {t.title}
                        </span>
                        {!readOnly && (
                          <>
                            <button
                              className="link-handle"
                              aria-label={"Link dependency from " + t.title}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLinking(t.id);
                              }}
                            />
                            <span
                              aria-hidden="true"
                              title={"Resize " + t.title}
                              className="resize-handle"
                              onPointerDown={(e) => pointer(e, t, true)}
                            >
                              Ⅱ
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div
              className="today-line"
              style={{
                left:
                  gridWidth +
                  x(
                    DateTime.now()
                      .setZone(p.calendar.timezone)
                      .startOf("day")
                      .plus({ hours: 12 })
                      .toISO()!,
                  ),
                height: "100%",
              }}
            >
              <span>Today</span>
            </div>
          </div>
          <button
            className="table-add"
            style={{ width: gridWidth }}
            disabled={readOnly}
            onClick={onAdd}
          >
            <Plus size={14} /> Add a task
          </button>
        </div>
      </div>
      <footer className="planner-footer">
        <span>
          <i className="legend-dot purple" />
          {ordered.length} of {p.tasks.length} tasks{" "}
          <span className="footer-divider">·</span>
          {s.critical.length} critical
        </span>
        <div>
          <label>
            Color by{" "}
            <select
              aria-label="Color tasks by"
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value)}
            >
              <option value="status">Status</option>
              <option value="owner">Resource</option>
              <option value="risk">Risk</option>
            </select>
          </label>
          {colorMode === "status" ? (
            <>
              <span>
                <i className="legend-dot green" />
                Complete
              </span>
              <span>
                <i className="legend-dot purple" />
                In progress
              </span>
              <span>
                <i className="legend-dot grey" />
                Not started
              </span>
            </>
          ) : colorMode === "risk" ? (
            <>
              <span>
                <i className="legend-dot red" />
                Critical path
              </span>
              <span>
                <i className="legend-dot green" />
                Has float
              </span>
            </>
          ) : (
            <span>Resource colors shown in assignments</span>
          )}
        </div>
      </footer>
      {proposal && (
        <Modal
          title="Review schedule change"
          onClose={() => setProposal(null)}
          wide
        >
          <div className="modal-body">
            <p className="muted">
              Review the impact before updating the shared plan.
            </p>
            <div className="impact-summary">
              <span>Project finish</span>
              <b>
                {date(proposal.preview.finishBefore, p.calendar.timezone)}{" "}
                <ArrowRight size={14} />{" "}
                {date(proposal.preview.finishAfter, p.calendar.timezone)}
              </b>
            </div>
            <div className="change-list">
              {proposal.preview.changes.map((c, i) => (
                <div key={i}>
                  <b>{c.title}</b>
                  <small>
                    {c.field}: {c.before} → {c.after}
                  </small>
                </div>
              ))}
            </div>
            {!proposal.preview.changes.length && (
              <p className="notice">
                The scheduling rules leave the calculated dates unchanged.
                Review dependencies or use manual scheduling if appropriate.
              </p>
            )}
          </div>
          <footer>
            <button className="secondary" onClick={() => setProposal(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await onSave(proposal.commands);
                  setProposal(null);
                } catch (e) {
                  setError((e as Error).message);
                  setProposal(null);
                }
              }}
            >
              Apply change
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
