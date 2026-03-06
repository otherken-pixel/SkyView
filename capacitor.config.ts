import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flightscore.app',
  appName: 'FlightScore',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
