import { WEEKDAYS } from './format';
import type { Rule } from './types';

/** Weekly-hours editor model: one list of time ranges per weekday (0 = Monday). */
export type Range = { start: string; end: string; capacity: number };
export type Week = Range[][];

export const hhmm = (t: string) => t.slice(0, 5);
export const DEFAULT_RANGE: Range = { start: '09:00', end: '13:00', capacity: 1 };

export function validateWeek(week: Week): string | null {
  for (const [day, ranges] of week.entries()) {
    const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
    for (const [i, r] of sorted.entries()) {
      if (r.start >= r.end) return `${WEEKDAYS[day]}: each range must end after it starts.`;
      const next = sorted[i + 1];
      if (next && r.end > next.start) return `${WEEKDAYS[day]}: time ranges overlap.`;
    }
  }
  return null;
}

export function toRules(week: Week): Rule[] {
  return week.flatMap((ranges, weekday) =>
    ranges.map((r) => ({ weekday, start_time: r.start, end_time: r.end, capacity: r.capacity })),
  );
}
