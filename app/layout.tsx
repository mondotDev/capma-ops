import type { Metadata } from "next";
import "./globals.css";
import { FirebaseAuthGate } from "@/components/firebase-auth-gate";
import { AppStateProvider } from "@/components/app-state";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "CAPMA Ops Hub",
  description: "Internal operations dashboard for CAPMA"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <FirebaseAuthGate>
          <AppStateProvider>
            <AppShell>{children}</AppShell>
          </AppStateProvider>
        </FirebaseAuthGate>
      </body>
    </html>
  );
}
