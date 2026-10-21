import { CommandSummary } from "./CommandSummary";
import { fieldLabel } from "../changeSummary";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  ArrowUp,
  ArrowRight,
  Check,
  LoaderCircle,
  ShieldCheck,
  RefreshCw,
  Flag,
  Layers,
  TrendingUp,
} from "lucide-react";
import type { Envelope } from "../api";
import { api } from "../api";
import { date, money } from "./ui";
export function AIPanel({
  p,
  onClose,
  onChanged,
  onTask,
}: {
  p: Envelope;
  onClose: () => void;
  onChanged: (p: Envelope) => void;
  onTask: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState(""),
    [request, setRequest] = useState(""),
    [job, setJob] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [jobId, setJobId] = useState<string | null>(() =>
      sessionStorage.getItem("ai-" + p.document.id),
    ),
    [applying, setApplying] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jobId) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api("/projects/" + p.document.id + "/ai/" + jobId);
        if (stopped) return;
        setJob(result);
        if (result.status === "running") {
          setBusy(true);
          timer = setTimeout(poll, 800);
        } else {
          setBusy(false);
          if (result.status === "failed") setError(result.error);
        }
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setBusy(false);
        }
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, p.document.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [job, error, busy]);
  const send = async (text = prompt) => {
    if (!text.trim()) return;
    setRequest(text);
    setError("");
    setJob(null);
    setBusy(true);
    setPrompt("");
    try {
      const j = await api("/projects/" + p.document.id + "/ai", "POST", {
        request: text,
        revision: p.revision,
        selectedTaskIds: [],
      });
      sessionStorage.setItem("ai-" + p.document.id, j.id);
      setJobId(j.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const response = job?.response,
    preview = job?.preview;
  return (
    <aside className="ai-panel">
      <header>
        <span className="ai-symbol">
          <Sparkles size={19} />
        </span>
        <div>
          <b>Open Intelligence</b>
          <small>Your planning partner</small>
        </div>
        <button
          className="icon-button"
          aria-label="Close AI analyst"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <div className="ai-body">
        <div className="ai-intro">
          <span className="ai-orbit">
            <Sparkles size={24} />
          </span>
          <span className="eyebrow">A LITTLE INSIGHT. A BIG DIFFERENCE.</span>
          <h2>Your project copilot</h2>
          <p>
            See the possibilities.
            <br />
            Find your next best move.
          </p>
        </div>
        {!request && !job && (
          <div className="ai-suggestions">
            {[
              {
                icon: TrendingUp,
                text: "Analyze delivery risks",
                sub: "Find what deserves your attention",
              },
              {
                icon: Flag,
                text: "How can we finish sooner?",
                sub: "Explore the path to an earlier finish",
              },
              {
                icon: Layers,
                text: "Generate a launch template",
                sub: "Turn an idea into an actionable plan",
              },
            ].map(({ icon: Icon, text, sub }) => (
              <button key={text} onClick={() => void send(text)}>
                <Icon size={17} />
                <span>
                  <b>{text}</b>
                  <small>{sub}</small>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        )}
        {request && <div className="user-message">{request}</div>}
        {busy && (
          <div className="ai-thinking">
            <Sparkles size={15} />
            <span>
              Working through your plan<span className="animated-dots">…</span>
            </span>
            <button
              className="text-button"
              onClick={async () => {
                if (jobId) {
                  await api(
                    "/projects/" + p.document.id + "/ai/" + jobId + "/cancel",
                    "POST",
                    {},
                  );
                  setJobId(null);
                }
                setBusy(false);
                setJob({ status: "canceled" });
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {job?.status === "canceled" && (
          <p className="hint">Analysis canceled. Your project is unchanged.</p>
        )}
        {response && (
          <div className="ai-response">
            <div className="response-label">
              <Sparkles size={13} />
              {response.kind === "proposal"
                ? "A plan worth considering"
                : response.kind === "clarification"
                  ? "One thing to clarify"
                  : "Here’s what I’m seeing"}
            </div>
            <p className="ai-prose">{response.message}</p>
            {response.assumptions.length > 0 && (
              <details>
                <summary>Assumptions</summary>
                <ul>
                  {response.assumptions.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>
            )}
            {response.references.length > 0 && (
              <div className="ai-references">
                {response.references.map((key: string) => (
                  <button
                    key={key}
                    className="pill"
                    onClick={() => onTask(key)}
                  >
                    {p.document.tasks.find((t) => t.id === key)?.title ?? key}
                  </button>
                ))}
              </div>
            )}
            {preview && (
              <div className="ai-proposal">
                <h3>Proposed impact</h3>
                <dl>
                  <div>
                    <dt>Project finish</dt>
                    <dd>
                      {date(preview.finishBefore, p.document.calendar.timezone)}{" "}
                      →{" "}
                      {date(preview.finishAfter, p.document.calendar.timezone)}
                    </dd>
                  </div>
                  <div>
                    <dt>Planned cost</dt>
                    <dd>
                      {money(preview.metricsBefore.cost, p.document.currency)} →{" "}
                      {money(preview.metricsAfter.cost, p.document.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>Daily overloads</dt>
                    <dd>
                      {preview.metricsBefore.overloads.length} →{" "}
                      {preview.metricsAfter.overloads.length}
                    </dd>
                  </div>
                </dl>
                <details open>
                  <summary>
                    {preview.changes.length} field changes ·{" "}
                    {response.commands.length} operations
                  </summary>
                  <div className="change-list">
                    {preview.changes.map((c: any, i: number) => (
                      <div key={i}>
                        <b>{c.title}</b>
                        <small>
                          {fieldLabel(c.field)}: {c.before} → {c.after}
                        </small>
                      </div>
                    ))}
                  </div>
                  <CommandSummary
                    commands={response.commands}
                    project={p.document}
                    candidate={preview.document}
                  />
                </details>
                {job.status === "applied" ? (
                  <div className="success-label">
                    <Check size={15} />
                    Applied to the plan · undo in history
                  </div>
                ) : (
                  <button
                    className="primary full"
                    disabled={applying || p.role === "viewer"}
                    onClick={async () => {
                      setApplying(true);
                      try {
                        const updated = await api<Envelope>(
                          "/projects/" +
                            p.document.id +
                            "/ai/" +
                            job.id +
                            "/apply",
                          "POST",
                          {},
                        );
                        onChanged(updated);
                        setJob((j: any) => ({ ...j, status: "applied" }));
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setApplying(false);
                      }
                    }}
                  >
                    {applying ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Apply proposed changes
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="ai-error" role="alert">
            <b>A small pause</b>
            <p>{error}</p>
            <button
              className="text-button"
              onClick={() => void send(request || "Analyze delivery risks")}
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="ai-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Ask your AI analyst"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask, explore, or make a plan…"
          rows={3}
        />
        <div>
          <span>
            <span className="context-dot" />
            {p.document.name}
          </span>
          <button
            className="ai-send"
            aria-label="Send to analyst"
            disabled={busy || !prompt.trim()}
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </form>
      <footer>
        <ShieldCheck size={12} />
        You review changes before they’re applied.
      </footer>
    </aside>
  );
}
