import type { Metadata } from "next";
import { Inter, Instrument_Serif, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// GetFluent editorial design system fonts (used by the marketing landing).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif"
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-hanken"
});

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
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${hankenGrotesk.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
