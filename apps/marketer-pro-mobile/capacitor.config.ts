import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.marketerpro.app',
  appName: 'Marketer Pro',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f0f13',
  },
  android: {
    backgroundColor: '#0f0f13',
  },
}

export default config
