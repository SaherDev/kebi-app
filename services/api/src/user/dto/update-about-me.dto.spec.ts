import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ABOUT_ME_MAX_LENGTH } from '@kebi-app/shared';
import { UpdateAboutMeDto } from './update-about-me.dto';

/** Mirrors the global ValidationPipe (whitelist + transform) in main.ts. */
function parse(body: Record<string, unknown>): {
  dto: UpdateAboutMeDto;
  errors: string[];
} {
  const dto = plainToInstance(UpdateAboutMeDto, body, {
    enableImplicitConversion: true,
  });
  return { dto, errors: validateSync(dto).map((e) => e.property) };
}

describe('UpdateAboutMeDto', () => {
  it('normalizes a lowercase alpha-2 country to upper (contract: case-insensitive inbound)', () => {
    const { dto, errors } = parse({ home_country: 'ae' });

    expect(errors).toEqual([]);
    expect(dto.home_country).toBe('AE');
  });

  it.each(['United Arab Emirates', 'ARE', 'XX'])(
    'rejects %s — only alpha-2 may reach kebi',
    (home_country) => {
      expect(parse({ home_country }).errors).toEqual(['home_country']);
    },
  );

  it('turns a whitespace-only about into null rather than prose', () => {
    const { dto, errors } = parse({ about: '   ' });

    expect(errors).toEqual([]);
    expect(dto.about).toBeNull();
  });

  it('accepts an explicit null on both fields (a cleared form)', () => {
    const { dto, errors } = parse({ home_country: null, about: null });

    expect(errors).toEqual([]);
    expect(dto.home_country).toBeNull();
    expect(dto.about).toBeNull();
  });

  it('trims prose and keeps it at the cap', () => {
    const about = 'x'.repeat(ABOUT_ME_MAX_LENGTH);
    const { dto, errors } = parse({ about: ` ${about} ` });

    expect(errors).toEqual([]);
    expect(dto.about).toBe(about);
  });

  it('rejects prose over the cap instead of letting kebi 422 it', () => {
    expect(parse({ about: 'x'.repeat(ABOUT_ME_MAX_LENGTH + 1) }).errors).toEqual(['about']);
  });
});
