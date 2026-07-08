import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.bookary.reader',
  appName: 'Bookary',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    // For live-reload during development, uncomment and point at your
    // Lovable preview URL, then run `npx cap sync android`:
    // url: 'https://id-preview--93770b53-4cc3-4522-8213-1b7ad9a73973.lovable.app',
    // cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0b0a1a',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
  },
};

export default config;
