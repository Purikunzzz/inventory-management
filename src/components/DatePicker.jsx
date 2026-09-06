import { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

/** year/month(0-indexed)/day → "YYYY-MM-DD", matching native <input type="date"> values. */
function toISODate(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** "YYYY-MM-DD" → {year, month(0-indexed), day}. Parsed manually (never via
 * `new Date(isoString)`) so a date typed/selected as the 17th can never
 * silently become the 16th in a negative-UTC-offset timezone. */
function parseISODate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function formatDisplay(str) {
  const parsed = parseISODate(str);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed.year, parsed.month, parsed.day));
}

function isSameDay(a, b) {
  return !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Custom calendar date picker — replaces the browser's native
 * `<input type="date">` (which renders wildly inconsistent, dated-looking
 * UI across Chrome/Safari/Firefox/OS) with one that matches the app's own
 * design system. Drop-in compatible: `value`/`onChange` use the same
 * "YYYY-MM-DD" string the native input used, so call sites don't change.
 */
export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  id,
  ariaLabel,
  className,
  clearable = true,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = useMemo(() => parseISODate(value), [value]);
  const today = new Date();
  const todayParsed = {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };

  const [viewYear, setViewYear] = useState(selected?.year ?? todayParsed.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? todayParsed.month);

  // Jump the visible month back to the selected date whenever it changes
  // externally (e.g. form reset).
  useEffect(() => {
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 (Sun) – 6 (Sat)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      // JS Date normalizes out-of-range days (e.g. day 0 or day 32) into the
      // adjacent month for us — no manual leading/trailing-day math needed.
      const cellDate = new Date(viewYear, viewMonth, i - startWeekday + 1);
      return {
        year: cellDate.getFullYear(),
        month: cellDate.getMonth(),
        day: cellDate.getDate(),
        outside: cellDate.getMonth() !== viewMonth,
      };
    });
  }, [viewYear, viewMonth]);

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDate(iso) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "input flex items-center justify-between gap-2 text-left min-h-[44px]",
          className,
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className={cn(!value && "text-gray-400")}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1.5 w-72 rounded-xl border border-gray-100 bg-white shadow-elevated p-3"
            role="dialog"
          >
            {/* Month header */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={goPrevMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={goNextMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-center text-[11px] font-medium text-gray-400 py-1"
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const iso = toISODate(cell.year, cell.month, cell.day);
                const isSelected = isSameDay(selected, cell);
                const isToday = isSameDay(todayParsed, cell);
                const disabled = (min && iso < min) || (max && iso > max);
                return (
                  <button
                    type="button"
                    key={iso + (cell.outside ? "-o" : "")}
                    disabled={disabled}
                    onClick={() => selectDate(iso)}
                    className={cn(
                      "h-8 w-8 flex items-center justify-center rounded-lg text-xs transition-colors",
                      cell.outside ? "text-gray-300" : "text-gray-700",
                      !isSelected && !disabled && "hover:bg-gray-100",
                      isToday && !isSelected && "font-semibold text-primary-600 ring-1 ring-inset ring-primary-200",
                      isSelected && "bg-primary-500 text-white font-semibold hover:bg-primary-600",
                      disabled && "opacity-30 cursor-not-allowed hover:bg-transparent",
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
              <button
                type="button"
                onClick={() => {
                  const iso = toISODate(todayParsed.year, todayParsed.month, todayParsed.day);
                  if (!((min && iso < min) || (max && iso > max))) {
                    setViewYear(todayParsed.year);
                    setViewMonth(todayParsed.month);
                    selectDate(iso);
                  }
                }}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => selectDate("")}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
