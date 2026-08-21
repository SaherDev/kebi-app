import { API_ROUTES } from './routes';

/**
 * Contract snapshot: every route pinned to a hand-written literal transcribed
 * from the gateway controllers (the *.controller.ts files in services/api/src).
 *
 * Every other spec in this layer asserts paths via API_ROUTES — correctly, for
 * "which route does this function call" — but that reduces to comparing the
 * constant with itself, so a wrong path passes as a tautology. One did ship:
 * `/user/library/areasss` (fixed in d7de966). This file is the one place the
 * expected values are independent of the implementation. If a route changes on
 * the gateway, change the literal here in the same commit — deliberately.
 */
describe('API_ROUTES gateway contract', () => {
  it('matches the paths the gateway serves', () => {
    expect(API_ROUTES).toEqual({
      health: '/health',
      login: '/auth/login',
      shareToken: '/auth/share-token',
      chat: '/chat',
      extract: '/extract',
      home: '/home',
      library: '/user/library',
      libraryAreas: '/user/library/areas',
      userIntents: '/user/intents',
      place: expect.any(Function),
      area: expect.any(Function),
      userPlaces: '/user/places',
      userPlace: expect.any(Function),
      userProfile: '/user/profile',
      userSettings: '/user/settings',
      userAboutMe: '/user/about-me',
      userMovement: '/user/movement',
      userPlan: '/user/plan',
      userData: '/user/data',
      feedback: '/feedback',
      knowledgeCurate: '/knowledge/curate',
      knowledgeClaims: '/knowledge/claims',
      knowledgeClaim: expect.any(Function),
      knowledgeEntities: '/knowledge/entities',
    });
  });

  it('builds parameterised paths against the gateway shape', () => {
    expect(API_ROUTES.place('abc123')).toBe('/places/abc123');
    expect(API_ROUTES.area('abc123')).toBe('/areas/abc123');
    expect(API_ROUTES.userPlace('abc123')).toBe('/user/places/abc123');
    expect(API_ROUTES.knowledgeClaim('abc123')).toBe('/knowledge/claims/abc123');
  });

  it('escapes ids that need it', () => {
    // place/area ids are opaque url-safe tokens off the wire, but the builders
    // must not trust that; a hostile or malformed id stays one path segment.
    expect(API_ROUTES.place('a b/c')).toBe('/places/a%20b%2Fc');
    expect(API_ROUTES.area('a b/c')).toBe('/areas/a%20b%2Fc');
    expect(API_ROUTES.knowledgeClaim('a b/c')).toBe('/knowledge/claims/a%20b%2Fc');
  });
});
