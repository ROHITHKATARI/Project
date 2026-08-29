import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dostwheels.app',
  appName: 'DostWheels',
  webDir: 'dist',
  // NOTE: Do NOT set androidScheme here. The default ('http') is required
  // so that Capacitor's local asset server works correctly. Setting it to
  // 'https' causes the WebView to reload under a different origin which
  // blanks the screen after a few seconds.
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
