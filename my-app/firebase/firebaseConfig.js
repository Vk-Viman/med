// Firebase config for the Expo app
import { initializeApp } from "firebase/app";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB07VKxzf0lhdtRTLhMwHs0x54bOMlodA4",
  authDomain: "calmspace-4c73f.firebaseapp.com",
  projectId: "calmspace-4c73f",
  storageBucket: "calmspace-4c73f.appspot.com",
  messagingSenderId: "765940996744",
  appId: "1:765940996744:web:487918ed132b41bba0dd3d"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth differently for web vs native
let authInstance;
if (Platform.OS === 'web') {
  const { getAuth, setPersistence, browserLocalPersistence } = require('firebase/auth');
  authInstance = getAuth(app);
  try { setPersistence(authInstance, browserLocalPersistence); } catch {}
} else {
  const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}
export const auth = authInstance;
// Use in-memory local cache to avoid BloomFilter warnings on certain SDK versions
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export const storage = getStorage(app);
