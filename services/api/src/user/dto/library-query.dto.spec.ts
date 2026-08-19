import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { LibraryQueryDto } from './library-query.dto';

/**
 * Regression guard for the boolean query-param coercion bug. The global pipe's
 * `enableImplicitConversion` coerces a string-typed boolean via `Boolean(value)`
 * — so `"false"` would become `true`, silently inverting `visited=false` /
 * `approved=false`. The DTO keeps these as string literals so they survive the
 * pipe untouched and forward verbatim to kebi (which parses "true"/"false").
 * This runs the DTO through the *exact* global pipe (see services/api/main.ts).
 */
describe('LibraryQueryDto boolean params survive the global pipe', () => {
  // Mirror services/api/src/main.ts exactly — implicit conversion ON.
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta: ArgumentMetadata = { type: 'query', metatype: LibraryQueryDto, data: '' };

  const run = (q: Record<string, unknown>) =>
    pipe.transform(q, meta) as Promise<LibraryQueryDto>;

  it('keeps "false" as "false" (not coerced to true)', async () => {
    const dto = await run({ visited: 'false', approved: 'false', liked: 'false' });
    expect(dto.visited).toBe('false');
    expect(dto.approved).toBe('false');
    expect(dto.liked).toBe('false');
  });

  it('keeps "true" as "true"', async () => {
    const dto = await run({ visited: 'true', approved: 'true' });
    expect(dto.visited).toBe('true');
    expect(dto.approved).toBe('true');
  });

  it('rejects a non-boolean value (422 vocabulary)', async () => {
    await expect(run({ visited: 'maybe' })).rejects.toThrow();
  });

  it('leaves unset booleans undefined', async () => {
    const dto = await run({ sort: 'recent' });
    expect(dto.visited).toBeUndefined();
    expect(dto.approved).toBeUndefined();
  });

  /**
   * `whitelist: true` strips any property the DTO does not declare, so an
   * undeclared param reaches kebi as if the user never typed it — a search that
   * silently returns the unfiltered library. Declaring them is the fix; this is
   * the guard.
   */
  it('forwards q and area rather than stripping them (ADR-164, ADR-165)', async () => {
    const dto = await run({ q: 'canggu coffee', area: 'id/bali/canggu' });
    expect(dto.q).toBe('canggu coffee');
    expect(dto.area).toBe('id/bali/canggu');
  });

  it('keeps a geo key with slashes intact', async () => {
    expect((await run({ area: 'th/bangkok' })).area).toBe('th/bangkok');
  });
});
