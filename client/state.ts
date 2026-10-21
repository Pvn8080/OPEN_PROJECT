import { useCallback, useState } from "react";
import { api, apply, type Envelope } from "./api";
import { previewCommands } from "../shared/commands";
import type { Command, ChangePreview } from "../shared/model";
export function useProject() {
  const [project, setProject] = useState<Envelope | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<{
      commands: Command[];
      preview: ChangePreview;
      requestId: string;
    } | null>(null);
  const load = useCallback(async (id: string) => {
    const p = await api<Envelope>("/projects/" + id);
    setProject(p);
    setPending(null);
    setError("");
    return p;
  }, []);
  const save = async (commands: Command[]) => {
    if (!project) throw new Error("No project");
    const preview = previewCommands(project.document, commands),
      requestId = crypto.randomUUID();
    setPending({ commands, preview, requestId });
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
      setSaving(false);
    }
  };
  const retry = async () => {
    if (!project || !pending) return;
    const fresh = await api<Envelope>("/projects/" + project.document.id);
    setProject(fresh);
    setError(
      "Project refreshed. Review your retained changes before applying them.",
    );
    setPending({
      ...pending,
      preview: previewCommands(fresh.document, pending.commands),
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
