import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kebi-app.app',
  appName: 'Kebi',
  webDir: 'public',
  server: {
    url: 'https://kebi-app-ten-phi.vercel.app',
    cleartext: false,
    allowNavigation: [
      'kebi-app-ten-phi.vercel.app',
      '*.clerk.accounts.dev',
      '*.clerk.com',
      'accounts.google.com',
      'oauth2.googleapis.com',
      'ssl.gstatic.com',
    ],
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
