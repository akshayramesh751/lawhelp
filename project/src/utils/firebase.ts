import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDdQib838T_ATkWRPvPJ36LJ11dpiK3e8c",
  authDomain: "lawhelp-project.firebaseapp.com",
  projectId: "lawhelp-project",
  storageBucket: "lawhelp-project.firebasestorage.app",
  messagingSenderId: "1018074569485",
  appId: "1:1018074569485:web:7017f2969edb1d81baae44",
  measurementId: "G-N36Z4ST0HZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
