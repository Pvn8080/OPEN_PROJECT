import type { Command, ProjectDocument } from "../../shared/model";
import { describeCommand } from "../changeSummary";
export function CommandSummary({
  commands,
  project,
  candidate,
}: {
  commands: Command[];
  project: ProjectDocument;
  candidate?: ProjectDocument;
}) {
  const context = candidate
    ? {
        ...project,
        tasks: [
          ...project.tasks,
          ...candidate.tasks.filter(
            (t) => !project.tasks.some((old) => old.id === t.id),
          ),
        ],
        resources: [
          ...project.resources,
          ...candidate.resources.filter(
            (r) => !project.resources.some((old) => old.id === r.id),
          ),
        ],
      }
    : project;
  return (
    <ol className="command-summary">
      {commands.map((c, i) => (
        <li key={i}>{describeCommand(c, context)}</li>
      ))}
    </ol>
  );
}
