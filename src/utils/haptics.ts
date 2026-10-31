/**
 * Utility for triggering native Telegram WebApp haptic feedback safely.
 * Gracefully degrades to a no-op when running outside Telegram or on unsupported clients.
 */

export const hapticFeedback = {
  light: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch {}
  },
  medium: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } catch {}
  },
  heavy: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy');
    } catch {}
  },
  success: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {}
  },
  warning: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    } catch {}
  },
  error: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } catch {}
  },
  selection: (): void => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    } catch {}
  },
};
