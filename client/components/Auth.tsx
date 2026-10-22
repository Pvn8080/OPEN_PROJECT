import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChartNoAxesGantt,
  Sparkles,
  Layers,
  Users,
} from "lucide-react";
import { api, type User } from "../api";
import { Logo, Field } from "./ui";
export function Auth({
  onUser,
  initialRegister = false,
  onClose,
}: {
  onUser: (u: User) => void;
  initialRegister?: boolean;
  onClose?: () => void;
}) {
  const [register, setRegister] = useState(initialRegister),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (demo = false) => {
    setBusy(true);
    setError("");
    try {
      onUser(
        await api(
          "/auth/" + (demo ? "demo" : register ? "register" : "login"),
          "POST",
          demo ? {} : { name, email, password },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Logo />
        <div className="auth-copy">
          <span className="eyebrow">Project planning workspace</span>
          <h1>
            Every task. Every dependency.
            <br />
            One clear plan.
          </h1>
          <p>
            Schedule work, assign resources and track delivery.
            <br />
            Built for teams that need to see the whole project.
          </p>
          <div className="auth-features">
            <span>
              <ChartNoAxesGantt size={18} />
              Interactive Gantt scheduling
            </span>
            <span>
              <Users size={18} />
              Resource and capacity planning
            </span>
            <span>
              <Sparkles size={18} />
              AI analysis with reviewed changes
            </span>
          </div>
        </div>
        <div className="auth-mini-plan">
          <div className="mini-header">
            <Layers size={16} />
            <b>Product release</b>
            <span>On track</span>
          </div>
          {[
            "Discovery and scope",
            "Design and implementation",
            "Validation and release",
          ].map((t, i) => (
            <div className="mini-plan-row" key={t}>
              <span>
                <Check size={12} />
                {t}
              </span>
              <i
                style={{
                  marginLeft: i * 35,
                  width: 170 - i * 20,
                  background: ["#b9b0ee", "#8d7cde", "#c1d9cb"][i],
                }}
              />
            </div>
          ))}
          <div className="mini-ai">
            <Sparkles size={16} />
            <span>Dependencies connect each phase.</span>
          </div>
        </div>
        <small>Open Project / Planning workspace</small>
      </section>
      <section className="auth-form-wrap">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="auth-form"
        >
          <span className="pill">Project workspace</span>
          <h2>
            {register ? "Create your workspace." : "Welcome to Open Project."}
          </h2>
          <p>
            {register
              ? "Create your account and bring your team along."
              : "Sign in to continue planning."}
          </p>
          {register && (
            <Field label="Your name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Alex Morgan"
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="At least 10 characters"
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
          <div className="auth-switch">
            {register ? "Already have an account?" : "Need an account?"}{" "}
            <button type="button" onClick={() => setRegister(!register)}>
              {register ? "Sign in" : "Create an account"}
            </button>
          </div>
          <div className="divider">
            <span>or take a look around</span>
          </div>
          <button
            type="button"
            className="secondary full"
            disabled={busy}
            onClick={() => void submit(true)}
          >
            Explore demo workspace <ArrowRight size={16} />
          </button>
          {onClose && (
            <button
              type="button"
              className="text-button full"
              onClick={onClose}
            >
              Back to your workspace
            </button>
          )}
          <small className="auth-note">
            Web prototype · Your plans are saved in this workspace.
          </small>
        </form>
      </section>
    </main>
  );
}
