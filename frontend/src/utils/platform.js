// Platform abstraction — lets one React codebase serve both the web PWA at
// nouriscan.app and the native iOS app built with Capacitor.
//
// Rule of thumb used throughout: the web behaviour is the fallback and must
// never regress. Native paths are additive and are only taken when we are
// genuinely running inside a Capacitor shell.

import { Capacitor } from '@capacitor/core';

/** True when running inside the native iOS/Android shell (not mobile Safari). */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/** 'ios' | 'android' | 'web' */
export function platform() {
  return Capacitor.getPlatform();
}

export function isIOS() {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Light haptic tap. No-ops on web so call sites don't need to branch.
 * Used on scan success/failure so the app feels native rather than webby.
 */
export async function haptic(style = 'medium') {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] || ImpactStyle.Medium });
  } catch (_) {
    // Haptics unavailable (older device, simulator) — silently ignore.
  }
}

/** Success/warning/error notification haptic. */
export async function hapticNotify(type = 'success') {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const map = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: map[type] || NotificationType.Success });
  } catch (_) {}
}

/**
 * Durable key/value storage.
 *
 * On web this is localStorage (unchanged behaviour). On native we use
 * Capacitor Preferences, which is backed by UserDefaults and survives
 * WKWebView data eviction — iOS will clear webview localStorage under
 * storage pressure, which would silently sign users out.
 */
export const storage = {
  async get(key) {
    if (!isNative()) return localStorage.getItem(key);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value ?? null;
    } catch (_) {
      return localStorage.getItem(key);
    }
  },

  async set(key, value) {
    if (!isNative()) {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return;
    }
    try {
      const { Preferences } = await import('@capacitor/preferences');
      if (value == null) await Preferences.remove({ key });
      else await Preferences.set({ key, value });
    } catch (_) {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    // Mirror into localStorage too so the synchronous getters in api.js keep
    // working during the same session without an await.
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (_) {}
  },

  async remove(key) {
    return this.set(key, null);
  },
};

/**
 * On native startup, rehydrate anything that lives in Preferences back into
 * localStorage, so the existing synchronous `getAuthToken()` style helpers in
 * api.js continue to work untouched.
 */
export async function rehydrateNativeStorage(keys) {
  if (!isNative()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    for (const key of keys) {
      const { value } = await Preferences.get({ key });
      if (value != null && localStorage.getItem(key) == null) {
        localStorage.setItem(key, value);
      }
    }
  } catch (_) {}
}

/**
 * Configure native chrome on boot: status bar style and splash dismissal.
 */
export async function initNativeShell() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Dark text/glyphs, because our background is light cream.
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch (_) {}
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (_) {}
}

/** Open an external URL in the system browser rather than navigating the webview. */
export async function openExternal(url) {
  if (!isNative()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch (_) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
