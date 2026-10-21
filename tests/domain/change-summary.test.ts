import { it, expect } from "vitest";
import { blankProject, newTask } from "../../shared/model";
import { describeCommand } from "../../client/changeSummary";
it("describes task and calendar changes in planning language instead of implementation payloads", () => {
  const p = blankProject();
  p.tasks = [newTask("t", "Launch review", p.start)];
  expect(
    describeCommand(
      { type: "task.update", id: "t", patch: { duration: 16, percent: 50 } },
      p,
    ),
  ).toBe("Update Launch review: duration → 16 working hours; completion → 50%");
  expect(describeCommand({ type: "baseline.add", name: "Approved" }, p)).toBe(
    "Save baseline “Approved”",
  );
  expect(
    describeCommand(
      { type: "project.update", patch: { calendar: p.calendar } },
      p,
    ),
  ).toContain("8 hours per working day");
});
