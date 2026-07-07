// Expo 56 lazily loads its fetch polyfill from this path.
// In Jest's environment we just export the built-in global fetch (or a stub)
// so the lazy getter never tries to import native binaries.
module.exports = {
  fetch: typeof globalThis.fetch === 'function' ? globalThis.fetch : jest.fn(),
};
