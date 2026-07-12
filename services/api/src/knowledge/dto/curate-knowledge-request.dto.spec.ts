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

  it('accepts non-empty text and validates the nested location_hint', async () => {
    const dto = await run({
      text: 'Dubai nightlife peaks after midnight.',
      location_hint: { country_alpha2: 'ae', city: 'Dubai' },
    });
    expect(dto.text).toBe('Dubai nightlife peaks after midnight.');
    expect(dto.location_hint).toEqual({ country_alpha2: 'ae', city: 'Dubai' });
  });

  it('rejects empty text', async () => {
    await expect(run({ text: '' })).rejects.toThrow();
  });

  it('rejects a missing text field', async () => {
    await expect(run({ location_hint: { city: 'Dubai' } })).rejects.toThrow();
  });

  it('strips unknown top-level and nested fields (whitelist)', async () => {
    const dto = await run({
      text: 'prose',
      user_id: 'user_hacker',
      location_hint: { city: 'Dubai', scope: 'global' },
    });
    expect(dto).not.toHaveProperty('user_id');
    expect(dto.location_hint).not.toHaveProperty('scope');
    expect(dto.location_hint).toEqual({ city: 'Dubai' });
  });

  it('rejects text over the max length', async () => {
    await expect(run({ text: 'x'.repeat(8001) })).rejects.toThrow();
  });
});
