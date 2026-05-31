// Expo 56 installs a lazy getter for `global.fetch` (and URL, TextDecoder, …)
// via winter/runtime.native.  The lazy getter defers loading ExpoFetchModule
// (a native binary) until the property is first accessed.  In Jest 30 this
// fails with "import outside test scope" because the lazy require fires after
// Jest's module-scope boundary.
//
// Fix: replace the lazy getter NOW with a direct value so the getter never
// fires.  Object.defineProperty with {value} overrides the getter because
// winter/installGlobal installs it with {configurable: true}.
Object.defineProperty(global, 'fetch', {
  value: jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  configurable: true,
  writable: true,
  enumerable: true,
});

jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
}));

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (object: unknown) => JSON.parse(JSON.stringify(object));
}
