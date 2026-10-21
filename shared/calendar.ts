import { DomainError } from "./errors";
import { DateTime } from "luxon";
import type { Calendar } from "./model";
function parse(date: string, c: Calendar): DateTime {
  const d = DateTime.fromISO(date, { zone: c.timezone }).setZone(c.timezone);
  if (!d.isValid || !DateTime.local().setZone(c.timezone).isValid)
    throw new DomainError("Invalid date or timezone");
  if (!c.days.length && !Object.values(c.exceptions).some((h) => h > 0))
    throw new DomainError("Calendar needs working days");
  if (
    c.hours <= 0 ||
    c.hours > 24 ||
    c.startHour < 0 ||
    c.startHour + c.hours > 24 ||
    c.days.some((d) => d < 1 || d > 7) ||
    Object.values(c.exceptions).some((h) => h < 0 || h + c.startHour > 24)
  )
    throw new DomainError("Invalid calendar hours");
  return d;
}
function shift(d: DateTime, c: Calendar) {
  const day = d.toISODate()!;
  const hours = c.exceptions[day] ?? (c.days.includes(d.weekday) ? c.hours : 0);
  const start = d.startOf("day").plus({ hours: c.startHour });
  return { hours, start, end: start.plus({ hours }) };
}
export function normalizeStart(date: string, c: Calendar): string {
  let d = parse(date, c);
  for (let n = 0; n < 36600; n++) {
    const { hours, start, end } = shift(d, c);
    if (hours && d < end) return (d < start ? start : d).toISO()!;
    d = d.plus({ days: 1 }).startOf("day");
  }
  throw new DomainError("No working time within calendar range");
}
export function addWorkingHours(
  date: string,
  hours: number,
  c: Calendar,
): string {
  if (!Number.isFinite(hours) || Math.abs(hours) > 8e5)
    throw new DomainError("Duration outside supported range");
  let d = parse(date, c);
  let left = Math.abs(hours);
  if (!left) return d.toISO()!;
  const forward = hours > 0;
  for (let n = 0; n < 100000; n++) {
    const s = shift(d, c);
    if (s.hours) {
      if (forward) {
        if (d < s.start) d = s.start;
        const available = Math.max(0, s.end.diff(d, "hours").hours);
        if (left <= available + 1e-8) return d.plus({ hours: left }).toISO()!;
        left -= available;
      } else {
        if (d > s.end) d = s.end;
        const available = Math.max(0, d.diff(s.start, "hours").hours);
        if (left <= available + 1e-8) return d.minus({ hours: left }).toISO()!;
        left -= available;
      }
    }
    d = forward
      ? d.plus({ days: 1 }).startOf("day")
      : d.minus({ days: 1 }).endOf("day");
  }
  throw new DomainError("Schedule exceeds supported range");
}
export function workingHoursBetween(
  start: string,
  finish: string,
  c: Calendar,
): number {
  let a = parse(start, c),
    b = parse(finish, c);
  if (a > b) return -workingHoursBetween(finish, start, c);
  let total = 0;
  for (let n = 0; n < 100000 && a < b; n++) {
    const s = shift(a, c);
    const low = a > s.start ? a : s.start;
    const high = b < s.end ? b : s.end;
    if (s.hours && high > low) total += high.diff(low, "hours").hours;
    a = a.plus({ days: 1 }).startOf("day");
  }
  if (a < b) throw new DomainError("Schedule exceeds supported range");
  return Math.round(total * 1e8) / 1e8;
}
/** Reuses calendar segments across a schedule, avoiding repeated walks from the epoch. */
export function createWorkingAxis(base: string, c: Calendar) {
  const origin = parse(normalizeStart(base, c), c);
  const segments: { start: number; end: number; from: number; to: number }[] =
    [];
  let cursor = origin,
    offset = 0;
  function append() {
    const day = shift(cursor, c);
    const hours = day.end.diff(cursor, "hours").hours;
    segments.push({
      start: cursor.toMillis(),
      end: day.end.toMillis(),
      from: offset,
      to: offset + hours,
    });
    offset += hours;
    cursor = parse(normalizeStart(day.end.toISO()!, c), c);
  }
  const cache = new Map<string, string>();
  return (hours: number, start = false) => {
    if (hours < 0)
      return start
        ? normalizeStart(addWorkingHours(base, hours, c), c)
        : addWorkingHours(base, hours, c);
    if (hours > 8e5 || !Number.isFinite(hours))
      throw new DomainError("Schedule exceeds supported range");
    const key = hours + ":" + start;
    if (cache.has(key)) return cache.get(key)!;
    while (!segments.length || offset < hours || (start && offset === hours))
      append();
    let lo = 0,
      hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (start ? segments[mid].to <= hours : segments[mid].to < hours)
        lo = mid + 1;
      else hi = mid;
    }
    const seg = segments[lo];
    const iso = DateTime.fromMillis(seg.start + (hours - seg.from) * 3600000, {
      zone: c.timezone,
    }).toISO()!;
    cache.set(key, iso);
    return iso;
  };
}
