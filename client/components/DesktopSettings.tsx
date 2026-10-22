import { useEffect, useState } from "react";
import { desktop, type DesktopSettings as Settings } from "../desktop";
import { Modal, Field } from "./ui";
export function DesktopSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [baseURL, setBaseURL] = useState(""),
    [model, setModel] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    desktop!
      .getSettings()
      .then((data) => {
        setSettings(data);
        setBaseURL(data.baseURL);
        setModel(data.model);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Modal title="Open Project Settings" onClose={onClose}>
      <div className="modal-body desktop-settings">
        <h3>AI provider</h3>
        <p className="hint">
          Connect an OpenAI-compatible provider. Your key is encrypted using OS
          credential storage and stays out of project data.
        </p>
        <Field label="Provider URL">
          <input
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.openai.com/v1"
            type="url"
          />
        </Field>
        <Field label="Model">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4.1-mini"
          />
        </Field>
        <Field
          label={
            settings?.hasKey
              ? "Replace API key (leave blank to keep current key)"
              : "API key"
          }
        >
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              settings?.hasKey
                ? "Key saved securely"
                : "Enter your own provider key"
            }
          />
        </Field>
        <p className="hint">
          For Groq, use https://api.groq.com/openai/v1 and a currently available
          model supporting JSON mode. Provider usage and limits depend on your
          account.
        </p>
        {settings?.hasKey && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setSettings(
                  await desktop!.saveSettings({
                    baseURL,
                    model,
                    apiKey: "",
                    removeKey: true,
                  }),
                );
                setMessage("Provider key removed.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove provider key
          </button>
        )}
        <section className="desktop-data">
          <h3>Workspace data</h3>
          <p className="hint">
            Your SQLite database and project history are saved on this Mac.
            Sharing with teammates requires a hosted workspace.
          </p>
          <code>{settings?.dataDirectory}</code>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                const path = await desktop!.backup();
                if (path) setMessage("Backup saved: " + path);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Back Up Workspace…
          </button>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </div>
      <footer>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
        <button
          className="primary"
          disabled={busy || !settings}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMessage("");
            try {
              setSettings(
                await desktop!.saveSettings({ baseURL, model, apiKey: key }),
              );
              setKey("");
              setMessage(
                "Settings saved. Your next AI request will use this provider.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save settings
        </button>
      </footer>
    </Modal>
  );
}
