"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { INTERNAL_BETA_USERS_COLLECTION, parseInternalBetaAccessDocument } from "@/lib/firebase-access";
import {
  getFirebaseAuth,
  getFirestoreDb,
  isFirebaseAuthEnabled,
  signInWithGooglePopup,
  signOutFromFirebase
} from "@/lib/firebase";

type AuthGateState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "config-error"; message: string }
  | { status: "signed-out"; error: string | null }
  | { status: "unauthorized"; user: User; error: string }
  | { status: "authorized" };

export function FirebaseAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthGateState>(() =>
    isFirebaseAuthEnabled() ? { status: "loading" } : { status: "disabled" }
  );

  useEffect(() => {
    if (!isFirebaseAuthEnabled()) {
      setState({ status: "disabled" });
      return;
    }

    const auth = getFirebaseAuth();
    const firestore = getFirestoreDb();

    if (!auth || !firestore) {
      setState({
        status: "config-error",
        message: "Firebase Auth is enabled, but Firebase is not configured correctly for this app."
      });
      return;
    }

    let isActive = true;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!isActive) {
        return;
      }

      if (!user) {
        setState({ status: "signed-out", error: null });
        return;
      }

      setState({ status: "loading" });

      try {
        const accessSnapshot = await getDoc(doc(firestore, INTERNAL_BETA_USERS_COLLECTION, user.uid));

        if (!isActive) {
          return;
        }

        const accessRecord = accessSnapshot.exists()
          ? parseInternalBetaAccessDocument(accessSnapshot.data())
          : null;

        if (accessRecord?.enabled) {
          setState({ status: "authorized" });
          return;
        }

        setState({
          status: "unauthorized",
          user,
          error: accessSnapshot.exists()
            ? "This signed-in account is not enabled for the internal beta."
            : "This signed-in account has not been allowlisted for the internal beta."
        });
      } catch {
        if (!isActive) {
          return;
        }

        setState({
          status: "unauthorized",
          user,
          error: "CAPMA Ops could not verify internal beta access for this account."
        });
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  async function handleSignIn() {
    try {
      setState({ status: "loading" });
      await signInWithGooglePopup();
    } catch (error) {
      setState({
        status: "signed-out",
        error: error instanceof Error ? error.message : "Google sign-in failed."
      });
    }
  }

  async function handleSignOut(user?: User) {
    try {
      await signOutFromFirebase();
      setState({ status: "signed-out", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign-out failed.";
      setState(
        user
          ? { status: "unauthorized", user, error: message }
          : { status: "signed-out", error: message }
      );
    }
  }

  if (state.status === "disabled" || state.status === "authorized") {
    return <>{children}</>;
  }

  if (state.status === "loading") {
    return <div className="app-loading-state">Checking internal beta access...</div>;
  }

  if (state.status === "config-error") {
    return (
      <div className="app-loading-state">
        <div className="app-loading-title">Firebase Auth Unavailable</div>
        <p>{state.message}</p>
      </div>
    );
  }

  if (state.status === "signed-out") {
    return (
      <div className="app-loading-state">
        <div className="app-loading-title">Sign In Required</div>
        <p>CAPMA Ops is restricted to signed-in internal beta users.</p>
        {state.error ? <p>{state.error}</p> : null}
        <button className="topbar__button" onClick={handleSignIn} type="button">
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="app-loading-state">
      <div className="app-loading-title">Access Not Enabled</div>
      <p>{state.error}</p>
      <p>Signed in as {state.user.email ?? state.user.uid}.</p>
      <button className="button-link button-link--inline-secondary" onClick={() => handleSignOut(state.user)} type="button">
        Sign out
      </button>
    </div>
  );
}
