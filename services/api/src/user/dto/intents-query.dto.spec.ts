import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { IntentsQueryDto } from './intents-query.dto';

/**
 * Runs IntentsQueryDto through the *exact* global pipe (see services/api/src/main.ts).
 * `limit` arrives as a string and must coerce to an int within 1..100 (out of
 * range → 422); `cursor` is forwarded verbatim.
 */
describe('IntentsQueryDto through the global pipe', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta: ArgumentMetadata = { type: 'query', metatype: IntentsQueryDto, data: '' };

  const run = (q: Record<string, unknown>) =>
    pipe.transform(q, meta) as Promise<IntentsQueryDto>;

  it('coerces a limit string to an int', async () => {
    const dto = await run({ limit: '20' });
    expect(dto.limit).toBe(20);
  });

  it('passes cursor through verbatim', async () => {
    const dto = await run({ cursor: 'eyJ0cyI6' });
    expect(dto.cursor).toBe('eyJ0cyI6');
  });

  it('rejects limit below 1', async () => {
    await expect(run({ limit: '0' })).rejects.toThrow();
  });

  it('rejects limit above 100', async () => {
    await expect(run({ limit: '101' })).rejects.toThrow();
  });

  it('leaves both params undefined for a bare query', async () => {
    const dto = await run({});
    expect(dto.limit).toBeUndefined();
    expect(dto.cursor).toBeUndefined();
  });
});
