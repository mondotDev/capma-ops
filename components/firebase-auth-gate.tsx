"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  getFirebaseAuth,
  getFirestoreDb,
  isAnyFirebaseDataModeEnabled,
  isFirebaseConfigured
} from "@/lib/firebase";

type AuthGateStatus =
  | "checking"
  | "pass-through"
  | "configuration-error"
  | "signed-out"
  | "checking-access"
  | "authorized"
  | "unauthorized"
  | "error";

export function FirebaseAuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthGateStatus>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAnyFirebaseDataModeEnabled()) {
      setStatus("pass-through");
      return;
    }

    if (!isFirebaseConfigured()) {
      setStatus("configuration-error");
      setErrorMessage("Firebase data mode is enabled, but Firebase is not configured for this environment.");
      return;
    }

    const auth = getFirebaseAuth();

    if (!auth) {
      setStatus("configuration-error");
      setErrorMessage("Firebase Auth could not be initialized.");
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setErrorMessage("");
      setStatus(nextUser ? "checking-access" : "signed-out");
    });
  }, []);

  useEffect(() => {
    if (status !== "checking-access" || !user) {
      return;
    }

    let cancelled = false;
    const signedInUser = user;

    async function verifyAccess() {
      const db = getFirestoreDb();

      if (!db) {
        setStatus("configuration-error");
        setErrorMessage("Firestore could not be initialized for access verification.");
        return;
      }

      try {
        const accessSnapshot = await getDoc(doc(db, "internalBetaUsers", signedInUser.uid));
        const accessData = accessSnapshot.exists() ? accessSnapshot.data() : null;

        if (cancelled) {
          return;
        }

        setStatus(accessData?.enabled === true ? "authorized" : "unauthorized");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isPermissionDeniedError(error)) {
          setStatus("unauthorized");
          return;
        }

        setStatus("error");
        setErrorMessage(
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "CAPMA Ops Hub could not verify Firebase access."
        );
      }
    }

    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [status, user]);

  async function handleSignIn() {
    const auth = getFirebaseAuth();

    if (!auth) {
      setStatus("configuration-error");
      setErrorMessage("Firebase Auth could not be initialized.");
      return;
    }

    setErrorMessage("");

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "CAPMA Ops Hub could not complete Google sign-in."
      );
    }
  }

  async function handleSignOut() {
    const auth = getFirebaseAuth();

    if (auth) {
      await signOut(auth);
    }
  }

  if (status === "pass-through" || status === "authorized") {
    return <>{children}</>;
  }

  if (status === "signed-out") {
    return (
      <AuthGateShell title="Sign In Required" copy="Sign in with an enabled CAPMA Ops account to load Firestore-backed data.">
        <button className="topbar__button" onClick={handleSignIn} type="button">
          Sign in with Google
        </button>
        {errorMessage ? <p className="app-loading-copy">{errorMessage}</p> : null}
      </AuthGateShell>
    );
  }

  if (status === "unauthorized") {
    return (
      <AuthGateShell
        title="Access Not Enabled"
        copy="Your Google account is signed in, but it is not enabled for CAPMA Ops Hub."
      >
        <button className="button-link button-link--inline-secondary" onClick={handleSignOut} type="button">
          Sign out
        </button>
      </AuthGateShell>
    );
  }

  if (status === "configuration-error" || status === "error") {
    return (
      <AuthGateShell title="Firebase Auth Unavailable" copy={errorMessage || "CAPMA Ops Hub could not initialize Firebase Auth."}>
        <button className="button-link button-link--inline-secondary" onClick={handleSignOut} type="button">
          Sign out
        </button>
      </AuthGateShell>
    );
  }

  return (
    <AuthGateShell
      title={status === "checking-access" ? "Checking Access" : "Loading CAPMA Ops"}
      copy={status === "checking-access" ? "Verifying your internal beta access..." : "Preparing the app..."}
    />
  );
}

function isPermissionDeniedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "permission-denied"
  );
}

function AuthGateShell({
  children,
  copy,
  title
}: {
  children?: React.ReactNode;
  copy: string;
  title: string;
}) {
  return (
    <div className="app-loading-state">
      <div className="app-loading-title">{title}</div>
      <p>{copy}</p>
      {children ? <div className="auth-gate__actions">{children}</div> : null}
    </div>
  );
}
