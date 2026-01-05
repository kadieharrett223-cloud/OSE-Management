import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  title: "OSE | Management",
  description: "Tariff, landed cost, and pricing calculator for OSE Management.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%23991b1b;stop-opacity:1' /><stop offset='100%' style='stop-color:%23661616;stop-opacity:1' /></linearGradient></defs><rect fill='url(%23grad)' rx='6' width='32' height='32'/><rect fill='none' stroke='%23000' stroke-width='1.5' rx='6' width='32' height='32'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' fill='%23ffffff' font-size='18' font-weight='900' font-family='system-ui,Arial,sans-serif' letter-spacing='-1'>OSE</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
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
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
