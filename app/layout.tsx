import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Fluent",
    template: "%s | Fluent"
  },
  description: "Practice English conversation with Alex, an adaptive AI speaking partner.",
  openGraph: {
    title: "Fluent",
    description: "Practice natural English conversations with an adaptive AI speaking partner.",
    url: "/",
    siteName: "Fluent",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
