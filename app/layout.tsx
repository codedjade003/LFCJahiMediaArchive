import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Living Faith Church Jahi Media Archive",
  description: "Secure access to Living Faith Church Jahi media. Redeem coupon codes to view official images, videos, and audio resources.",
  applicationName: "LFC Jahi Media Archive",
  keywords: [
    "Living Faith Church Jahi",
    "LFC Jahi",
    "media archive",
    "church media",
    "images",
    "videos",
    "audio",
    "coupon access"
  ],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.png",
  },

  themeColor: "#0b0f1a",
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
      </body>
    </html>
  );
}




