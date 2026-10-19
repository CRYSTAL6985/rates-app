import type { CapacitorConfig } from '@capacitor/cli';

// The app loads the نرخ server in a WebView, so the address is baked in at sync time.
const url = process.env.NERKH_SERVER;
if (!url) throw new Error('Set NERKH_SERVER, e.g. http://192.168.1.5:3000');

const config: CapacitorConfig = {
  appId: 'ir.nerkh.app',
  appName: 'نرخ',
  webDir: 'public',
  // cleartext: the dev server is plain http; remove once it has HTTPS (pre-publish).
  server: { url, cleartext: true },
};

export default config;
