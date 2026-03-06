import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

/**
 * Sign in with Google via popup.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Create a new account with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign the current user out.
 * @returns {Promise<void>}
 */
export function logOut() {
  return signOut(auth);
}

/**
 * Subscribe to auth-state changes.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {import('firebase/auth').Unsubscribe} unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Map Firebase auth error codes to user-friendly messages.
 * @param {Error & { code?: string }} error
 * @returns {string}
 */
export function friendlyError(error) {
  const map = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing. Please try again.',
    'auth/cancelled-popup-request': 'Only one sign-in popup can be open at a time.',
    'auth/popup-blocked': 'Sign-in popup was blocked by the browser. Please allow popups and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    'auth/requires-recent-login': 'Please sign in again to complete this action.',
    'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
  };

  return map[error.code] || error.message || 'An unexpected error occurred. Please try again.';
}
