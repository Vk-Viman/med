// Firebase config for the Expo app
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
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
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
