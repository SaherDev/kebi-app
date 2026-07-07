// expo-localization is a native module; jest-expo doesn't stub it. The i18n
// module reads getLocales() at import time, so map it to a fixed English locale
// (mirrors the safe-area-mock pattern — jest.config.cts moduleNameMapper).
module.exports = {
  getLocales: () => [{ languageCode: 'en' }],
};
