import { useState, useEffect } from 'react';
import {
  onAuthChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  logOut,
} from '../services/auth.js';

/**
 * React hook that wraps Firebase auth state.
 *
 * Subscribes to onAuthChange on mount and unsubscribes on unmount.
 *
 * @returns {{
 *   user: import('firebase/auth').User | null,
 *   loading: boolean,
 *   signIn: (email: string, password: string) => Promise<import('firebase/auth').UserCredential>,
 *   signUp: (email: string, password: string) => Promise<import('firebase/auth').UserCredential>,
 *   signInWithGoogle: () => Promise<import('firebase/auth').UserCredential>,
 *   logOut: () => Promise<void>,
 * }}
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    signInWithGoogle,
    logOut,
  };
}
