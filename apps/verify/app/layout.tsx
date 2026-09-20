import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Certificate verification · MoraSpirit",
  description: "Check that a MoraSpirit certificate is genuine.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="ms-verify-page">
          <div className="ms-verify-rule" />
          <header className="ms-verify-head">
            <div className="ms-verify-head-inner">
              <p className="ms-verify-org">MoraSpirit</p>
              <p className="ms-verify-kicker">Certificate verification</p>
            </div>
          </header>
          <main className="ms-verify-main">{children}</main>
          <footer className="ms-verify-foot">
            Issued by MoraSpirit, Colombo, Sri Lanka. This page checks the certificate against
            MoraSpirit&apos;s records each time it is opened.
          </footer>
        </div>
      </body>
    </html>
  );
}
