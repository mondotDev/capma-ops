import type { Metadata } from "next";
import { Antonio, Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { AppStateProvider } from "@/components/app-state";
import { AppShell } from "@/components/app-shell";
import { FirebaseAuthGate } from "@/components/firebase-auth-gate";

const antonio = Antonio({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-title"
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-heading"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body"
});

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
      <body className={`${antonio.variable} ${montserrat.variable} ${inter.variable}`}>
        <FirebaseAuthGate>
          <AppStateProvider>
            <AppShell>{children}</AppShell>
          </AppStateProvider>
        </FirebaseAuthGate>
      </body>
    </html>
  );
}
