import { it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { blankProject, newTask } from "../../shared/model";
import { schedule } from "../../shared/schedule";
import { largeProject } from "../fixtures/large-project";
it("recalculates 1000 tasks and 1500 edges without walking the calendar per task", () => {
  const p = largeProject(),
    start = performance.now();
  const s = schedule(p);
  const elapsed = performance.now() - start;
  expect(Object.keys(s.tasks)).toHaveLength(1000);
  expect(s.critical).toHaveLength(1000);
  expect(elapsed).toBeLessThan(1000);
}, 30000);
