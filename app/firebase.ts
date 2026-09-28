import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCYU280eGkfxweFSVz7zJspWtr2YpwxBmk",
  authDomain: "readyneighbor-863ad.firebaseapp.com",
  projectId: "readyneighbor-863ad",
  storageBucket: "readyneighbor-863ad.firebasestorage.app",
  messagingSenderId: "644432651097",
  appId: "1:644432651097:web:f4b5d951e40faf18c56248"
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

export default app;