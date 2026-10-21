import { memo, useEffect, useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
/** Keep typing immediate; schedule the larger row-filter update after a short pause. */
export const TaskSearch = memo(function TaskSearch({
  onQuery,
}: {
  onQuery: (query: string) => void;
}) {
  const [value, setValue] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      onQuery(value);
      setPending(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [value, pending, onQuery]);
  return (
    <div className="table-search" aria-busy={pending}>
      {pending ? (
        <LoaderCircle size={14} className="spin" />
      ) : (
        <Search size={14} />
      )}
      <input
        aria-label="Search tasks"
        placeholder="Find a task…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setPending(true);
        }}
      />
    </div>
  );
});
