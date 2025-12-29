'use client';

import { useMemo, useState } from "react";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import Text from "../atoms/Text/Text";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const holidayNotes: Record<number, string> = {
  5: "Strategy Offsite",
  12: "Wellness Friday",
  25: "Founders' Day",
};

const legend = [
  { label: "Today", color: "bg-emerald-500" },
  { label: "Holiday", color: "bg-rose-500" },
  { label: "Weekend", color: "bg-indigo-500" },
];

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const year = currentDate.getFullYear();

  const monthCells = useMemo(() => {
    const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(
      year,
      currentDate.getMonth(),
      1
    ).getDay();
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const cells: Array<number | null> = [];

    for (let i = 0; i < offset; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [currentDate, year]);

  const today = new Date();
  const isSameDay = (day: number | null) => {
    if (!day) return false;
    return (
      today.getDate() === day &&
      today.getMonth() === currentDate.getMonth() &&
      today.getFullYear() === currentDate.getFullYear()
    );
  };

  const handleMonthChange = (direction: "prev" | "next") => {
    const delta = direction === "prev" ? -1 : 1;
    setCurrentDate(new Date(year, currentDate.getMonth() + delta, 1));
  };

  return (
    <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-xl shadow-indigo-50 backdrop-blur transition-colors duration-200 dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-900/60">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            Team calendar
          </p>
          <Text
            text={`${monthName} ${year}`}
            className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous month"
            className="rounded-2xl border border-slate-200 bg-white p-2 text-xl text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
            onClick={() => handleMonthChange("prev")}
          >
            <GrFormPrevious />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="rounded-2xl border border-slate-200 bg-white p-2 text-xl text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
            onClick={() => handleMonthChange("next")}
          >
            <GrFormNext />
          </button>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-3">
        {legend.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-1 text-xs font-semibold text-slate-500 transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300"
          >
            <span className={`h-2 w-2 rounded-full ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {daysOfWeek.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {monthCells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-12" />;
          }

          const date = new Date(year, currentDate.getMonth(), day);
          const weekday = date.getDay();
          const isWeekend = weekday === 6 || weekday === 0;
          const holidayLabel = holidayNotes[day];
          const todayActive = isSameDay(day);

          let stateClass =
            "border border-transparent bg-white/70 text-slate-600 hover:border-slate-200 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-500";

          if (holidayLabel) {
            stateClass =
              "border-rose-200 bg-gradient-to-br from-rose-500/90 to-orange-400 text-white shadow-lg hover:shadow-xl dark:border-rose-500/40 dark:shadow-rose-900/50";
          } else if (todayActive) {
            stateClass =
              "border-emerald-200 bg-emerald-500/90 text-white shadow-lg dark:border-emerald-500/60 dark:bg-emerald-500/90 dark:shadow-emerald-900/50";
          } else if (isWeekend) {
            stateClass =
              "border-indigo-100 bg-indigo-50 text-indigo-600 hover:border-indigo-200 dark:border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-200 dark:hover:border-indigo-400";
          }

          return (
            <button
              key={day}
              type="button"
              title={holidayLabel ?? undefined}
              className={`h-12 w-full rounded-2xl text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${stateClass}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default Calendar;
