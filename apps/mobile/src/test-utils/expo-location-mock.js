// expo-location is a native module; jest-expo doesn't stub it. lib/location.ts
// imports it directly, so map it to a granted permission + fixed Tokyo coords
// (mirrors the expo-localization-mock pattern — jest.config.cts moduleNameMapper).
module.exports = {
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 35.6595, longitude: 139.7005 } }),
};
