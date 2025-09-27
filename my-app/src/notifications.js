async function isAndroidExpoGo() {
  try {
    const Constants = (await import('expo-constants')).default;
    const { Platform } = await import('react-native');
    return Platform.OS === 'android' && Constants?.appOwnership === 'expo';
  } catch {
    return false;
  }
}

export async function requestLocalNotificationPermissions() {
  if (await isAndroidExpoGo()) {
    try { const { Alert } = await import('react-native'); Alert.alert('Notifications', 'Expo Go on Android does not support push. Local reminders require a development build.'); } catch {}
    return false;
  }
  const Notifications = await import("expo-notifications");
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
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

    const granted = await requestLocalNotificationPermissions();
    if (!granted) {
      if (typeof window === "undefined") {
        // Native: show alert
        const { Alert } = await import("react-native");
        Alert.alert("Permission Denied", "Notification permission was not granted.");
      }
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
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
