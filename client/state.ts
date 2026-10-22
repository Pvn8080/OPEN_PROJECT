import { useCallback, useEffect, useRef, useState } from "react";
import { api, apply, type Envelope } from "./api";
import { previewCommands } from "../shared/commands";
import type { Command, ChangePreview } from "../shared/model";
type Pending = {
  commands: Command[];
  preview: ChangePreview;
  requestId: string;
};
export function useProject() {
  const [project, setProject] = useState<Envelope | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [pending, setPendingState] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null),
    savingRef = useRef(false);
  const setPending = useCallback((value: Pending | null) => {
    pendingRef.current = value;
    setPendingState(value);
  }, []);
  const load = useCallback(async (id: string) => {
    if (pendingRef.current) {
      const message =
        "You have an unsaved draft. Review or discard it before reloading or switching projects.";
      setError(message);
      throw new Error(message);
    }
    const p = await api<Envelope>("/projects/" + id);
    setProject(p);
    setError("");
    return p;
  }, []);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const save = async (commands: Command[]) => {
    if (!project) throw new Error("No project");
    if (savingRef.current)
      throw new Error("A save is already in progress. Please wait.");
    const retained = pendingRef.current;
    if (
      retained &&
      JSON.stringify(retained.commands) !== JSON.stringify(commands)
    ) {
      const message =
        "Review or discard your unsaved draft before making a different change.";
      setError(message);
      throw new Error(message);
    }
    const preview = previewCommands(project.document, commands),
      requestId = retained?.requestId ?? crypto.randomUUID();
    setPending({ commands, preview, requestId });
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const p = await apply(project, commands, requestId);
      setProject(p);
      setPending(null);
      return p;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const retry = async () => {
    const retained = pendingRef.current;
    if (!project || !retained) return;
    const fresh = await api<Envelope>("/projects/" + project.document.id);
    setProject(fresh);
    setError(
      "Project refreshed. Review your retained changes before applying them.",
    );
    setPending({
      ...retained,
      preview: previewCommands(fresh.document, retained.commands),
    });
  };
  return {
    project,
    setProject,
    load,
    save,
    saving,
    error,
    setError,
    pending,
    setPending,
    retry,
  };
}
