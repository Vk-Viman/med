import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function parseRouteFromData(data){
  if (!data) return null;
  // Prefer deep link (url) else route field
  const url = data.url || data.link || null;
  if (url) return url;
  const route = data.route || null; // e.g., '/report' or '/plan'
  return route;
}

export function openFromNotificationData(data){
  try {
    const dest = parseRouteFromData(data);
    if (!dest) return false;
    if (dest.startsWith('http') || dest.startsWith('calmspace://')) {
      Linking.openURL(dest);
    } else {
      // Assume app route at root, e.g. '/report' or 'report'
      const path = dest.startsWith('/') ? dest : `/${dest}`;
      Linking.openURL(`calmspace://${path}`);
    }
    return true;
  } catch { return false; }
}

export function wireForegroundHandler(){
  // Example: show in-app banner or just no-op; expo-notifications displays system notifications by default
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
