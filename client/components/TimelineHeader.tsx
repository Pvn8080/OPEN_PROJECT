import { memo } from "react";
import { DateTime } from "luxon";
export const TimelineHeader = memo(function TimelineHeader({
  base,
  days,
  zoom,
  timezone,
  today,
}: {
  base: string;
  days: number;
  zoom: number;
  timezone: string;
  today: string;
}) {
  const start = DateTime.fromISO(base).setZone(timezone),
    current = DateTime.fromISO(today, { zone: timezone });
  const dates = Array.from({ length: days }, (_, i) => start.plus({ days: i }));
  const months: { label: string; start: number; count: number }[] = [];
  dates.forEach((d, i) => {
    const label = d.toFormat("MMMM yyyy"),
      last = months.at(-1);
    if (last?.label === label) last.count++;
    else months.push({ label, start: i, count: 1 });
  });
  return (
    <div className="timeline-header" style={{ width: days * zoom }}>
      <div className="months">
        {months.map((m) => (
          <span
            key={m.label}
            style={{ left: m.start * zoom, width: m.count * zoom }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div className="day-headers">
        {dates.map((d, i) => (
          <span
            key={i}
            style={{ width: zoom }}
            title={d.toFormat("cccc, MMMM d, yyyy")}
            className={
              (d.weekday > 5 ? "weekend " : "") +
              (d.hasSame(current, "day") ? "today" : "")
            }
          >
            <small>{d.toFormat("ccc").slice(0, 2)}</small>
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
});
