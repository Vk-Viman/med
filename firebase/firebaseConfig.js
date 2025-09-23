
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// NOTE: getAnalytics is not supported in React Native

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB07VKxzf0lhdtRTLhMwHs0x54bOMlodA4",
  authDomain: "calmspace-4c73f.firebaseapp.com",
  projectId: "calmspace-4c73f",
  storageBucket: "calmspace-4c73f.appspot.com",
  messagingSenderId: "765940996744",
  appId: "1:765940996744:web:487918ed132b41bba0dd3d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
