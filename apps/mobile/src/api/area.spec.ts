import { getArea } from './area';
import { API_ROUTES } from './routes';
import { AreaScreenView, AreaSection, isSectionEmpty } from './models/area';
import { SchemaValidationError } from './validate';
import { makeFakeClient } from '../test-utils/fake-http-client';

const AREA_ID = 'aWQvYmFsaS9jYW5nZ3U';

/** The contract sample (api-contract.md §GET /v1/areas/{area_id}). */
const CANGGU = {
  key: 'id/bali/canggu',
  uri: `kebi://area/${AREA_ID}`,
  name: 'Canggu',
  level: 'neighbourhood',
  icon: '🏄',
  summary: 'the surf-and-laptop end of bali.',
  best_for: [{ icon: '🌅', text: 'sunset drinks' }],
  breadcrumb: [
    { key: 'id', name: 'Indonesia', uri: 'kebi://area/aWQ' },
    { key: 'id/bali', name: 'Bali', uri: 'kebi://area/aWQvYmFsaQ' },
  ],
  saved_count: 4,
  profiled: true,
  section: {
    kind: 'saved',
    areas: [],
    places: [
      {
        id: 'c0ffee00',
        name: 'Savaya Bali',
        uri: 'kebi://venue/c0ffee00',
        icon: '🍸',
        subtitle: 'beach club · lively',
        liked: true,
        visited: true,
      },
    ],
  },
};

describe('getArea', () => {
  it('GETs the area route with the token, and validates into class instances', async () => {
    const client = makeFakeClient({ payload: CANGGU });

    const view = await getArea(client, AREA_ID);

    expect(client.calls).toEqual([{ method: 'GET', path: API_ROUTES.area(AREA_ID) }]);
    expect(view).toBeInstanceOf(AreaScreenView);
    expect(view.section).toBeInstanceOf(AreaSection);
    expect(view.name).toBe('Canggu');
    expect(view.saved_count).toBe(4);
    expect(view.section?.places[0].subtitle).toBe('beach club · lively');
  });

  it('accepts a thin first open — an unprofiled area is a normal response', async () => {
    // `profiled: false` (ADR-153) means the open that got this response is what
    // triggered generation: the profile fields are absent, not malformed.
    const client = makeFakeClient({
      payload: {
        key: 'id/bali/pererenan',
        uri: 'kebi://area/aWQvYmFsaS9wZXJlcmVuYW4',
        name: 'Pererenan',
        level: null,
        icon: null,
        summary: null,
        best_for: [],
        breadcrumb: [],
        saved_count: 0,
        profiled: false,
        section: null,
      },
    });

    const view = await getArea(client, 'aWQvYmFsaS9wZXJlcmVuYW4');

    expect(view.profiled).toBe(false);
    expect(view.summary).toBeNull();
    expect(view.section).toBeNull();
  });

  it('rejects a response missing the identity fields', async () => {
    const client = makeFakeClient({ payload: { name: 'Canggu' } });

    await expect(getArea(client, AREA_ID)).rejects.toBeInstanceOf(SchemaValidationError);
  });

  it('treats an empty section as nothing to draw', async () => {
    const client = makeFakeClient({
      payload: { ...CANGGU, section: { kind: 'saved', areas: [], places: [] } },
    });

    const view = await getArea(client, AREA_ID);

    expect(isSectionEmpty(view.section!)).toBe(true);
  });
});
