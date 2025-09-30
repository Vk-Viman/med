async function isAndroidExpoGo() {
  try {
    const Constants = (await import('expo-constants')).default;
    const { Platform } = await import('react-native');
    return Platform.OS === 'android' && Constants?.appOwnership === 'expo';
  } catch {
    return false;
  }
}

// Ensure Android has a high-importance default channel for local notifications in release builds
export async function ensureAndroidNotificationChannel() {
  try {
    const Notifications = await import('expo-notifications');
    const { Platform } = await import('react-native');
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {}
}

export async function requestLocalNotificationPermissions() {
  if (await isAndroidExpoGo()) {
    try { const { Alert } = await import('react-native'); Alert.alert('Notifications', 'Expo Go on Android does not support push. Local reminders require a development build.'); } catch {}
    return false;
  }
  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.requestPermissionsAsync();
  const granted = status === "granted";
  if (granted) {
    // Create/upgrade Android channel so scheduled notifications actually appear in APKs
    await ensureAndroidNotificationChannel();
  }
  return granted;
}

export async function scheduleLocalNotification({
  title = "Time to meditate!",
  body = "Take a few minutes for yourself.",
  hour = 8,
  minute = 0,
} = {}) {
  try {
    if (await isAndroidExpoGo()) {
      const { Alert } = await import('react-native');
      Alert.alert('Use a dev build', 'Scheduling reminders is limited in Expo Go on Android. Create a development build to enable local notifications.');
      return false;
    }
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Register categories/actions once
    try {
      const { registerNotificationActions, handleNotificationResponse } = await import('./services/adaptiveNotifications');
      await registerNotificationActions();
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    } catch {}

    const granted = await requestLocalNotificationPermissions();
    if (!granted) {
      if (typeof window === "undefined") {
        // Native: show alert
        const { Alert } = await import("react-native");
        Alert.alert("Permission Denied", "Notification permission was not granted.");
      }
      return false;
    }

    // Double-ensure Android channel exists before scheduling (safe no-op on iOS/web)
    await ensureAndroidNotificationChannel();

    await Notifications.scheduleNotificationAsync({
      content: { title, body, categoryIdentifier: 'med-reminder' },
      trigger: { hour, minute, repeats: true },
    });
    return true;
  } catch (err) {
    // Handle Expo Go limitation or other errors gracefully
    if (typeof window === "undefined") {
      const { Alert } = await import("react-native");
      Alert.alert(
        "Expo Go Limitation",
        "Local notifications are supported, but remote push is not. If you see this error, try using a development build for full support.\n\nError: " + (err?.message || err)
      );
    } else {
      // Web: log error
      console.error("Notification error:", err);
    }
    return false;
  }
}

export async function cancelAllLocalNotifications() {
  if (await isAndroidExpoGo()) return; // noop in Expo Go Android
  const Notifications = await import("expo-notifications");
  await Notifications.cancelAllScheduledNotificationsAsync();
}
