import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Certificate verification · MoraSpirit",
  description: "Check that a MoraSpirit certificate is genuine.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="brand">MoraSpirit · Certificate verification</header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
