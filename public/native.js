// Bridge to the Android app. In a normal browser there is no window.Capacitor, so everything here does nothing.
export const DENIED = 'اعلان‌ها برای نرخ خاموش است. از تنظیمات گوشی روشنش کنید تا هشدارها برسد.';

export const isNative = (win = window) => Boolean(win.Capacitor?.isNativePlatform?.());

// The widgets and the background alert check read these from Android's storage, then redraw.
export async function shareWithAndroid(key, value, win = window, log = console) {
  if (!isNative(win)) return;
  try {
    await win.Capacitor.Plugins.Preferences.set({ key, value });
    await win.Capacitor.Plugins.Nerkh.refreshWidgets();
  } catch (err) {
    log.warn('[native]', err);
  }
}

// null when notifications may be shown, else the message for the alerts screen.
export async function androidNotifications(win = window) {
  if (!isNative(win)) return null;
  const { granted } = await win.Capacitor.Plugins.Nerkh.requestNotifications();
  return granted ? null : DENIED;
}
