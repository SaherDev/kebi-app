import { ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { CurateKnowledgeDto } from './curate-knowledge-request.dto';

/**
 * Runs the DTO through the *exact* global pipe (see services/api/src/main.ts) so
 * body validation + `whitelist` stripping match production behaviour.
 */
describe('CurateKnowledgeDto through the global pipe', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta: ArgumentMetadata = { type: 'body', metatype: CurateKnowledgeDto, data: '' };

  const run = (b: Record<string, unknown>) =>
    pipe.transform(b, meta) as Promise<CurateKnowledgeDto>;

  it('accepts non-empty text with no anchor (unanchored prose stays geo-scoped)', async () => {
    const dto = await run({ text: 'Dubai nightlife peaks after midnight.' });
    expect(dto.text).toBe('Dubai nightlife peaks after midnight.');
    expect(dto.anchor).toBeUndefined();
  });

  it('accepts a place anchor', async () => {
    const dto = await run({ text: 'Cash only at the bar.', anchor: { place_id: 'place_1' } });
    expect(dto.anchor).toEqual({ place_id: 'place_1' });
  });

  it('accepts an area anchor', async () => {
    const dto = await run({ text: 'prose', anchor: { area_id: 'aWQvYmFsaS9jYW5nZ3U' } });
    expect(dto.anchor).toEqual({ area_id: 'aWQvYmFsaS9jYW5nZ3U' });
  });

  it('rejects an anchor carrying both ids (kebi 422 caught at our edge)', async () => {
    await expect(
      run({ text: 'prose', anchor: { place_id: 'p1', area_id: 'a1' } }),
    ).rejects.toThrow();
  });

  it('rejects an empty anchor object (neither id)', async () => {
    await expect(run({ text: 'prose', anchor: {} })).rejects.toThrow();
  });

  it('rejects an anchor whose id is an empty string', async () => {
    await expect(run({ text: 'prose', anchor: { place_id: '' } })).rejects.toThrow();
  });

  it('rejects empty text', async () => {
    await expect(run({ text: '' })).rejects.toThrow();
  });

  it('rejects a missing text field', async () => {
    await expect(run({ anchor: { place_id: 'p1' } })).rejects.toThrow();
  });

  it('strips unknown top-level and nested fields (whitelist)', async () => {
    const dto = await run({
      text: 'prose',
      user_id: 'user_hacker',
      location_hint: { city: 'Dubai' },
      anchor: { place_id: 'p1', scope: 'global' },
    });
    expect(dto).not.toHaveProperty('user_id');
    // The retired field cannot sneak through as an unvalidated passthrough.
    expect(dto).not.toHaveProperty('location_hint');
    expect(dto.anchor).not.toHaveProperty('scope');
    expect(dto.anchor).toEqual({ place_id: 'p1' });
  });

  it('strips anything else inside the anchor, so only the two ids reach kebi', async () => {
    // Regression: the exactly-one rule once lived on a marker property *inside*
    // the anchor. A decorated property survives `whitelist`, so a client could
    // send that name and have it forwarded upstream as an unknown field. The
    // rule now lives on the parent's `anchor` property and the anchor declares
    // only the two ids.
    const dto = await run({
      text: 'prose',
      anchor: { place_id: 'p1', _exactlyOne: 'junk', area: 'sneaky' },
    });
    expect(dto.anchor).toEqual({ place_id: 'p1' });
  });

  it('rejects text over the max length', async () => {
    await expect(run({ text: 'x'.repeat(8001) })).rejects.toThrow();
  });
});
