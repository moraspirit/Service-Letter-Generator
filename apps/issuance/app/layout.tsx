import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// One family carries headings, labels, buttons, body and table data. Product UI
// does not need a display/body pairing, and a second family would only add a
// request. `--font-inter` is what the design system's --ms-font-sans resolves to.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MoraSpirit Certificates",
  description: "Certificate issuance admin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
