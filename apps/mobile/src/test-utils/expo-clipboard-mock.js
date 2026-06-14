// expo-clipboard is a native module; jest-expo doesn't stub it. The chat screen
// imports it for the per-turn copy button, so map it to a no-op setter
// (mirrors the expo-location-mock pattern — jest.config.cts moduleNameMapper).
module.exports = {
  setStringAsync: async () => true,
  getStringAsync: async () => '',
};
