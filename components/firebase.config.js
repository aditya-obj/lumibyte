import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider
} from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Initialize Firebase only if it hasn't been initialized
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();
const emailProvider = new EmailAuthProvider();

const isProduction = process.env.NODE_ENV === "production";
const redirectUrl = isProduction
  ? "https://byte-prep.vercel.app/auth/handler"
  : "http://localhost:3000/__/auth/handler";

googleProvider.setCustomParameters({
  redirect_uri: redirectUrl,
  prompt: "select_account", // This ensures Google will ask for user profile info
});

// Get current user's display name
const getCurrentUserName = () => {
  return auth.currentUser?.displayName || null;
};

// Function to get the user's name from their email
const getCurrentUserEmailName = () => {
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.email) {
    // Assuming the email format is something like 'name@example.com'
    const name = currentUser.email.split("@")[0];
    return name;
  }
  return null;
};

export {
  app,
  auth,
  db,
  googleProvider,
  emailProvider,
  getCurrentUserName,
  getCurrentUserEmailName,
};
