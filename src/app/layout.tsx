import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "./providers";
import { TopBar } from "@/components/TopBar";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OSE Management | Pricing",
  description: "Tariff, landed cost, and pricing calculator for OSE Management.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <TopBar />
          {children}
          <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-xs text-slate-400 bg-transparent pointer-events-none print:hidden">
            brought to you by kadie ☺
          </footer>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
