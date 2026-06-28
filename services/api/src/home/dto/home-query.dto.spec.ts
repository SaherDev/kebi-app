import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { HomeQueryDto } from './home-query.dto';

/**
 * Runs HomeQueryDto through the *exact* global pipe (see services/api/src/main.ts)
 * — implicit conversion ON, so lat/lng arrive as strings on the wire and must
 * coerce to numbers and range-check (out-of-range → 422). Unset params stay
 * undefined so the service drops them before forwarding to kebi.
 */
describe('HomeQueryDto through the global pipe', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta: ArgumentMetadata = { type: 'query', metatype: HomeQueryDto, data: '' };

  const run = (q: Record<string, unknown>) =>
    pipe.transform(q, meta) as Promise<HomeQueryDto>;

  it('coerces lat/lng strings to numbers', async () => {
    const dto = await run({ lat: '35.6615', lng: '139.6680' });
    expect(dto.lat).toBeCloseTo(35.6615);
    expect(dto.lng).toBeCloseTo(139.668);
  });

  it('forwards city/local_time/weather as strings', async () => {
    const dto = await run({
      city: 'shimokitazawa',
      local_time: '2026-06-28T21:41:00',
      weather: 'clear',
    });
    expect(dto.city).toBe('shimokitazawa');
    expect(dto.local_time).toBe('2026-06-28T21:41:00');
    expect(dto.weather).toBe('clear');
  });

  it('rejects out-of-range lat (422 vocabulary)', async () => {
    await expect(run({ lat: '91' })).rejects.toThrow();
  });

  it('rejects out-of-range lng (422 vocabulary)', async () => {
    await expect(run({ lng: '-181' })).rejects.toThrow();
  });

  it('leaves every param undefined for a bare query', async () => {
    const dto = await run({});
    expect(dto.lat).toBeUndefined();
    expect(dto.lng).toBeUndefined();
    expect(dto.city).toBeUndefined();
    expect(dto.local_time).toBeUndefined();
    expect(dto.weather).toBeUndefined();
  });
});
