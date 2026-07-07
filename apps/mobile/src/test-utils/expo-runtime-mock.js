// No-op module. Expo 56's winter/runtime.native installs lazy polyfill getters
// (fetch, URL, TextDecoder, …) that trigger Jest's "import outside test scope"
// error when those globals are first accessed during test runs.
// Replacing the module with an empty object prevents those getters from being
// registered; Jest already provides built-in globals for fetch, URL, etc.
module.exports = {};
