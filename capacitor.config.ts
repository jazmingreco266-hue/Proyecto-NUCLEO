import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ar.com.nucleoapp.app',
  appName: 'Núcleo',
  webDir: 'dist',
  backgroundColor: '#faf8fc',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#faf8fc',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
