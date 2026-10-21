import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  addWorkingHours,
  normalizeStart,
  workingHoursBetween,
} from "../../shared/calendar";
import { defaultCalendar } from "../../shared/model";
const local = (s: string) =>
  DateTime.fromISO(s)
    .setZone(defaultCalendar.timezone)
    .toFormat("yyyy-MM-dd HH:mm");
describe("working calendar", () => {
  it("finishes Friday at 17 and normalizes its successor to Monday", () => {
    const finish = addWorkingHours(
      "2026-10-23T09:00:00-07:00",
      8,
      defaultCalendar,
    );
    expect(local(finish)).toBe("2026-10-23 17:00");
    expect(local(normalizeStart(finish, defaultCalendar))).toBe(
      "2026-10-26 09:00",
    );
  });
  it("skips holidays and observes custom working hours", () => {
    const c = {
      ...defaultCalendar,
      exceptions: { "2026-10-26": 0, "2026-10-27": 4 },
    };
    expect(local(addWorkingHours("2026-10-23T09:00:00-07:00", 16, c))).toBe(
      "2026-10-28 13:00",
    );
  });
  it("handles DST and signed work arithmetic", () => {
    const start = "2026-10-30T09:00:00-07:00";
    const end = addWorkingHours(start, 16, defaultCalendar);
    expect(local(end)).toBe("2026-11-02 17:00");
    expect(workingHoursBetween(start, end, defaultCalendar)).toBe(16);
    expect(local(addWorkingHours(end, -16, defaultCalendar))).toBe(
      "2026-10-30 09:00",
    );
  });
  it("rejects unusable calendars and invalid dates", () => {
    expect(() => normalizeStart("bad", defaultCalendar)).toThrow();
    expect(() =>
      addWorkingHours("2026-10-23", 8, {
        ...defaultCalendar,
        days: [],
        exceptions: {},
      }),
    ).toThrow();
  });
});
