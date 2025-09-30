import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

let lastRegistered = 0;

export async function registerPushTokens({ force = false } = {}){
  try {
    const user = auth.currentUser; if (!user) return { ok:false, reason:'no-auth' };
    const now = Date.now();
    if (!force && now - lastRegistered < 10 * 60 * 1000) return { ok:true, reason:'cached' };

    // Ask permissions (Android 13+ requires POST_NOTIFICATIONS)
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return { ok:false, reason:'denied' };

    // Device push token (FCM on Android when google-services is configured)
    let fcmToken = null;
    try {
      if (Platform.OS === 'android') {
        const devTok = await Notifications.getDevicePushTokenAsync();
        // devTok: { type: 'fcm', data: '<token>' }
        fcmToken = devTok?.data || null;
      }
    } catch {}

    // Expo push token as fallback and for testing via Expo push service
    let expoToken = null;
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
      const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      expoToken = data;
    } catch {}

    // Persist tokens
    const ref = doc(db, 'users', user.uid, 'private', 'push');
    await setDoc(ref, {
      platform: Platform.OS,
      fcmToken: fcmToken || null,
      expoPushToken: expoToken || null,
      updatedAt: serverTimestamp(),
      sdk: Constants?.expoVersion || null,
    }, { merge: true });

    lastRegistered = now;
    return { ok:true, fcmToken, expoToken };
  } catch (e) {
    return { ok:false, error: e?.message || String(e) };
  }
}
