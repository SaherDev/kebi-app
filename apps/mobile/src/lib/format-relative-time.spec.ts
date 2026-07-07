import { formatClockTime, formatRelativeTime } from './format-relative-time';

// A fixed "now": Sunday 28 Jun 2026, 21:00 local. All cases are anchored to it
// so the whole-day diffs are deterministic regardless of when the suite runs.
const NOW = new Date(2026, 5, 28, 21, 0, 0);

describe('formatClockTime', () => {
  it('formats a 12-hour clock with a lowercase meridiem', () => {
    expect(formatClockTime(new Date(2026, 5, 28, 20, 42))).toBe('8:42 pm');
  });

  it('renders midnight and noon as 12', () => {
    expect(formatClockTime(new Date(2026, 5, 28, 0, 5))).toBe('12:05 am');
    expect(formatClockTime(new Date(2026, 5, 28, 12, 0))).toBe('12:00 pm');
  });
});

describe('formatRelativeTime', () => {
  it('says "today" for an instant earlier the same day', () => {
    expect(formatRelativeTime(new Date(2026, 5, 28, 8, 42).toISOString(), NOW)).toBe('today, 8:42 am');
  });

  it('says "yesterday" for the day before', () => {
    expect(formatRelativeTime(new Date(2026, 5, 27, 20, 5).toISOString(), NOW)).toBe(
      'yesterday, 8:05 pm',
    );
  });

  it('uses the weekday within the past week', () => {
    // Mon 22 Jun 2026 → 6 days before the Sunday "now".
    expect(formatRelativeTime(new Date(2026, 5, 22, 19, 10).toISOString(), NOW)).toBe('mon, 7:10 pm');
  });

  it('falls back to "mon dd" for anything a week or more old', () => {
    expect(formatRelativeTime(new Date(2026, 5, 12, 9, 0).toISOString(), NOW)).toBe('jun 12');
  });

  it('returns an empty string for an unparseable instant', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('');
  });
});
