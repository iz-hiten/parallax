"use client";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { clientAuth, firebaseEnabled, googleProvider } from "@/lib/firebase/client";

interface AuthCtx {
  enabled: boolean;
  ready: boolean;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** fetch() that attaches the signed-in user's ID token */
  authed: (url: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AuthCtx>({
  enabled: false,
  ready: true,
  user: null,
  signIn: async () => {},
  signOut: async () => {},
  authed: (u, i) => fetch(u, i),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);
  useEffect(() => {
    const auth = clientAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);
  const value: AuthCtx = {
    enabled: firebaseEnabled,
    ready,
    user,
    signIn: async () => {
      const auth = clientAuth();
      if (auth) await signInWithPopup(auth, googleProvider());
    },
    signOut: async () => {
      const auth = clientAuth();
      if (auth) await signOut(auth);
    },
    authed: async (url, init = {}) => {
      const token = user ? await user.getIdToken() : null;
      return fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function AuthLink() {
  const { enabled, ready, user, signIn, signOut } = useAuth();
  if (!enabled || !ready) return null;
  return user ? (
    <button className="plain" onClick={() => signOut()} title={user.email ?? ""}>
      {user.displayName?.split(" ")[0] ?? "Account"} · Sign out
    </button>
  ) : (
    <button className="plain" onClick={() => signIn()}>
      Sign in
    </button>
  );
}
