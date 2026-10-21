import type {
  ProjectDocument,
  Role,
  Command,
  ChangePreview,
} from "../shared/model";
export interface User {
  id: string;
  name: string;
  email: string;
  guest: number;
}
export interface Envelope {
  document: ProjectDocument;
  revision: number;
  role: Role;
  updatedAt: string;
  preview?: ChangePreview;
}
export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  taskCount: number;
  revision: number;
  role: Role;
  updatedAt: string;
}
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = r.status === 204 ? null : await r.json();
  if (!r.ok) throw new APIError(r.status, data?.error ?? "Request failed");
  return data;
}
export const apply = (
  p: Envelope,
  commands: Command[],
  requestId = crypto.randomUUID(),
) =>
  api<Envelope>("/projects/" + p.document.id + "/changes", "POST", {
    revision: p.revision,
    requestId,
    commands,
  });
