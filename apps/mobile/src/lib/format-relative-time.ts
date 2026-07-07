/**
 * Time formatting for the client. Kept pure and Intl-independent (Hermes ships
 * a trimmed ICU, so `toLocaleTimeString` is unreliable) and lowercase to match
 * the design-system voice. The server sends raw ISO instants; only the client
 * knows the user's timezone, so relative phrasing is rendered here.
 *
 * English-only by design (CLAUDE.md: English is the only locale), so the day /
 * weekday / month tokens live inline — same precedent as the chat clock.
 */

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

/** "9:38 pm" — 12-hour clock, lowercase meridiem. */
export function formatClockTime(d: Date): string {
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  const hour = d.getHours() % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

/** Midnight (local) of the given date, as epoch ms — for whole-day diffs. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Render an ISO instant as a recall timestamp relative to `now`:
 * - same day   → `today, 8:42 pm`
 * - day before → `yesterday, 8:42 pm`
 * - this week  → `mon, 7:10 pm`
 * - older      → `jun 12`
 *
 * `now` is injectable so the output is deterministic under test. An unparseable
 * input returns `''` (the caller renders nothing rather than "invalid date").
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const time = formatClockTime(d);

  if (dayDiff <= 0) return `today, ${time}`;
  if (dayDiff === 1) return `yesterday, ${time}`;
  if (dayDiff < 7) return `${WEEKDAYS[d.getDay()]}, ${time}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
