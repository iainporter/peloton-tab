import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SerwistProvider } from "./serwist";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PelotonTab",
  description: "Track shared expenses on group cycling rides",
  applicationName: "PelotonTab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PelotonTab",
  },
  icons: {
    apple: [{ url: "/icons/icon-192.png" }],
  },
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://dgalywyr863hv.cloudfront.net" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
