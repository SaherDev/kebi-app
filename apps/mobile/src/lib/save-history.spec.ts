import { clearSaveHistory, recentSaveAttempts, recordSaveAttempt } from './save-history';

describe('save-history', () => {
  beforeEach(() => clearSaveHistory());

  it('records attempts newest-last with ISO timestamps', () => {
    recordSaveAttempt('https://tiktok.com/@x/video/1', 'saved: Bar Trench');
    recordSaveAttempt('gibberish', 'failed: no_candidates');

    const attempts = recentSaveAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      input: 'https://tiktok.com/@x/video/1',
      result: 'saved: Bar Trench',
    });
    expect(attempts[1].result).toBe('failed: no_candidates');
    expect(new Date(attempts[0].at).toISOString()).toBe(attempts[0].at);
  });

  it('keeps only the newest five attempts', () => {
    for (let i = 0; i < 7; i++) recordSaveAttempt(`input ${i}`, 'saved: x');

    const attempts = recentSaveAttempts();
    expect(attempts).toHaveLength(5);
    expect(attempts[0].input).toBe('input 2');
    expect(attempts[4].input).toBe('input 6');
  });

  it('clips oversized inputs to the gateway caps', () => {
    recordSaveAttempt('x'.repeat(1200), 'y'.repeat(600));

    const [attempt] = recentSaveAttempts();
    expect(attempt.input.length).toBe(1000);
    expect(attempt.input.endsWith('…')).toBe(true);
    expect(attempt.result.length).toBe(500);
  });

  it('returns a copy — mutating the result does not corrupt the log', () => {
    recordSaveAttempt('a', 'saved: a');
    recentSaveAttempts().pop();
    expect(recentSaveAttempts()).toHaveLength(1);
  });
});
