import type { Metadata } from "next";
import { Antonio, Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { AmcAppShell } from "@/components/amc-app-shell";
import { PRODUCT_NAME } from "@/lib/amc-domain";

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
  title: PRODUCT_NAME,
  description: "Multi-client operations hub for association management companies"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${antonio.variable} ${montserrat.variable} ${inter.variable}`}>
        <AmcAppShell>{children}</AmcAppShell>
      </body>
    </html>
  );
}
