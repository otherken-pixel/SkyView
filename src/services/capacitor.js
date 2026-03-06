/**
 * Platform-aware service layer for Capacitor native plugins.
 *
 * Each helper gracefully falls back to web APIs (or no-ops) when running
 * in a browser so the same code works on web, iOS, and Android.
 */
import { Capacitor } from '@capacitor/core';

/** True when running inside a native Capacitor shell (iOS / Android). */
export const isNative = Capacitor.isNativePlatform();

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

/**
 * Get the device's current position.
 * Uses the Capacitor Geolocation plugin on native, falls back to the
 * browser Geolocation API on web.
 *
 * @returns {Promise<{ lat: number, lon: number }>}
 */
export async function getCurrentPosition() {
  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

// ---------------------------------------------------------------------------
// Push Notifications
// ---------------------------------------------------------------------------

/**
 * Request push notification permissions and register for push.
 * No-op on web (web push requires a separate service worker flow).
 *
 * @returns {Promise<{ granted: boolean, token?: string }>}
 */
export async function registerPushNotifications() {
  if (!isNative) {
    return { granted: false };
  }

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== 'granted') {
    return { granted: false };
  }

  await PushNotifications.register();

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      resolve({ granted: true, token: token.value });
    });
    PushNotifications.addListener('registrationError', () => {
      resolve({ granted: false });
    });
  });
}

/**
 * Add a listener for incoming push notifications (foreground).
 * @param {(notification: object) => void} callback
 */
export async function onPushNotificationReceived(callback) {
  if (!isNative) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  PushNotifications.addListener('pushNotificationReceived', callback);
}

// ---------------------------------------------------------------------------
// Splash Screen
// ---------------------------------------------------------------------------

/** Hide the native splash screen (no-op on web). */
export async function hideSplash() {
  if (!isNative) return;
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide();
}

// ---------------------------------------------------------------------------
// Status Bar
// ---------------------------------------------------------------------------

/**
 * Style the native status bar to match the current theme.
 * @param {'dark' | 'light' | 'night'} theme
 */
export async function setStatusBarStyle(theme) {
  if (!isNative) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  const style = theme === 'light' ? Style.Light : Style.Dark;
  await StatusBar.setStyle({ style });

  // On Android, set the background colour to match the app header
  if (Capacitor.getPlatform() === 'android') {
    const bgColor = theme === 'light' ? '#ffffff' : '#0a0e1a';
    await StatusBar.setBackgroundColor({ color: bgColor });
  }
}

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

/**
 * Trigger a light haptic impact (no-op on web).
 */
export async function hapticLight() {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

/**
 * Listen for the native keyboard showing/hiding.
 * Useful for adjusting layout when the soft keyboard appears.
 *
 * @param {{ onShow?: (info: { keyboardHeight: number }) => void, onHide?: () => void }} handlers
 * @returns {Promise<void>}
 */
export async function addKeyboardListeners({ onShow, onHide } = {}) {
  if (!isNative) return;
  const { Keyboard } = await import('@capacitor/keyboard');
  if (onShow) Keyboard.addListener('keyboardWillShow', onShow);
  if (onHide) Keyboard.addListener('keyboardWillHide', onHide);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

/**
 * Listen for the app returning to the foreground (resume event).
 * Useful for refreshing weather data when the user switches back.
 *
 * @param {() => void} callback
 */
export async function onAppResume(callback) {
  if (!isNative) return () => {};
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) callback();
  });
  return () => handle.remove();
}
