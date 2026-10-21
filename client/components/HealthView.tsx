import {
  ArrowUpRight,
  Flag,
  Check,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import type { ProjectDocument } from "../../shared/model";
import { schedule } from "../../shared/schedule";
import { calculateMetrics } from "../../shared/metrics";
import { date, money, Empty } from "./ui";
export function HealthView({
  p,
  baselineId,
  onTask,
  onAI,
}: {
  p: ProjectDocument;
  baselineId: string;
  onTask: (id: string) => void;
  onAI: () => void;
}) {
  const s = schedule(p),
    m = calculateMetrics(p, s, baselineId),
    leaves = p.tasks.filter((t) => !s.tasks[t.id].summary),
    done = leaves.filter((t) => t.percent === 100).length,
    milestones = leaves.filter((t) => !t.duration);
  return (
    <div className="view-page">
      <header className="view-header">
        <div>
          <span className="eyebrow">SEE THE BIG PICTURE</span>
          <h2>Project overview</h2>
          <p>Your plan, your progress, and what needs a little attention.</p>
        </div>
        <button className="secondary" onClick={onAI}>
          <TrendingUp size={16} />
          Explore with AI
          <ArrowUpRight size={14} />
        </button>
      </header>
      <div className="overview-grid">
        <section className="surface progress-surface">
          <div className="surface-title">
            <h3>Every step counts</h3>
            <span className="pill">Schedule completion</span>
          </div>
          <div className="completion-chart">
            <svg
              viewBox="0 0 160 160"
              role="img"
              aria-label={`${Math.round(m.percent)} percent schedule completion`}
            >
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke="#f0eef6"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke="#8a76d3"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(m.percent / 100) * 402.1} 402.1`}
                transform="rotate(-90 80 80)"
              />
            </svg>
            <div>
              <b>
                {Math.round(m.percent)}
                <small>%</small>
              </b>
              <span>of the way there</span>
            </div>
          </div>
          <div className="completion-stats">
            <span>
              <i className="legend-dot green" />
              {done} completed
            </span>
            <span>
              <i className="legend-dot purple" />
              {leaves.filter((t) => t.percent > 0 && t.percent < 100).length} in
              progress
            </span>
            <span>
              <i className="legend-dot grey" />
              {leaves.filter((t) => !t.percent).length} to start
            </span>
          </div>
        </section>
        <section className="surface">
          <div className="surface-title">
            <h3>At a glance</h3>
            <span className="tiny-label">CALCULATED FROM YOUR PLAN</span>
          </div>
          <div className="health-metrics">
            <div>
              <Clock size={18} />
              <span>Scheduled finish</span>
              <b>{date(s.finish, p.calendar.timezone)}</b>
            </div>
            <div>
              <Flag size={18} />
              <span>Critical tasks</span>
              <b>{s.critical.length}</b>
            </div>
            <div>
              <AlertTriangle size={18} />
              <span>Overdue tasks</span>
              <b>{m.overdue.length}</b>
            </div>
            <div>
              <TrendingUp size={18} />
              <span>Planned cost</span>
              <b>{money(m.cost, p.currency)}</b>
            </div>
            <div>
              <Clock size={18} />
              <span>Planned work</span>
              <b>{m.work.toLocaleString()}h</b>
            </div>
            <div>
              <Check size={18} />
              <span>Recorded actual cost</span>
              <b>
                {m.actualCost === null
                  ? "Not recorded"
                  : money(m.actualCost, p.currency)}
              </b>
            </div>
          </div>
          <p className="hint health-hint">
            Actuals reflect recorded work and costs, not completion percentages.
            Unrecorded work is excluded.
          </p>
        </section>
        <section className="surface">
          <div className="surface-title">
            <h3>Milestones ahead</h3>
            <Flag size={16} />
          </div>
          <div className="milestone-list">
            {milestones.map((t) => (
              <button key={t.id} onClick={() => onTask(t.id)}>
                <span
                  className={
                    "milestone-check " + (t.percent === 100 ? "complete" : "")
                  }
                >
                  {t.percent === 100 ? <Check size={13} /> : <Flag size={13} />}
                </span>
                <span>
                  <b>{t.title}</b>
                  <small>
                    {t.percent === 100
                      ? "Completed"
                      : s.critical.includes(t.id)
                        ? "On the critical path"
                        : "Upcoming milestone"}
                  </small>
                </span>
                <time>{date(s.tasks[t.id].finish, p.calendar.timezone)}</time>
                <ChevronArrow />
              </button>
            ))}
            {!milestones.length && (
              <Empty
                title="Mark the big moments"
                description="Add zero-duration tasks to create milestones."
              />
            )}
          </div>
        </section>
        <section className="surface">
          <div className="surface-title">
            <h3>Worth a closer look</h3>
            <span className="pill">Project signals</span>
          </div>
          <div className="signals">
            <div>
              <span className="signal-icon coral">
                <AlertTriangle size={18} />
              </span>
              <span>
                <b>
                  {new Set(m.overloads.map((o) => o.resourceId)).size} resources
                  above capacity
                </b>
                <small>
                  Review overlapping assignments before committing to dates.
                </small>
              </span>
            </div>
            <div>
              <span className="signal-icon violet">
                <Flag size={18} />
              </span>
              <span>
                <b>
                  {m.overdue.length} unfinished tasks past their planned finish
                </b>
                <small>
                  Compared with the project status date,{" "}
                  {date(p.statusDate, p.calendar.timezone)}.
                </small>
              </span>
            </div>
            <div>
              <span className="signal-icon sage">
                <Clock size={18} />
              </span>
              <span>
                <b>{s.violations.length} manual scheduling conflicts</b>
                <small>
                  Manual dates are retained even when dependencies are violated.
                </small>
              </span>
            </div>
          </div>
          <button className="insight-link" onClick={onAI}>
            Ask your AI analyst to investigate <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <section className="surface">
        <div className="surface-title">
          <h3>Baseline comparison</h3>
          {m.baselineCost !== null && (
            <span className="pill">
              Cost variance: {money(m.cost - m.baselineCost, p.currency)}
            </span>
          )}
        </div>
        {!m.variance.length ? (
          <Empty
            title="A reference point for your progress"
            description="Save a baseline to see how your current plan compares with your original expectations."
          />
        ) : (
          <div className="variance-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>State</th>
                  <th>Start variance</th>
                  <th>Finish variance</th>
                  <th>Duration</th>
                  <th>Work</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {m.variance.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button
                        className="text-button"
                        disabled={v.state === "removed"}
                        onClick={() => onTask(v.id)}
                      >
                        {v.title}
                      </button>
                    </td>
                    <td>
                      <span className="pill">
                        {v.state === "changed" ? "Compared" : v.state}
                      </span>
                    </td>
                    {[v.start, v.finish, v.duration, v.work].map((n, i) => (
                      <td key={i} className={n > 0 ? "variance-late" : ""}>
                        {v.state !== "changed"
                          ? "—"
                          : `${n > 0 ? "+" : ""}${+n.toFixed(1)}h`}
                      </td>
                    ))}
                    <td>
                      {v.state === "changed" ? money(v.cost, p.currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
function ChevronArrow() {
  return <ArrowRight size={14} className="muted" />;
}
