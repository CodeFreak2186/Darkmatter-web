import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Darkmatter — AI Security Engine",
  description:
    "Coordinated agents scan, correlate, and summarize findings—so your team moves faster. Autonomous AI-powered cybersecurity platform.",
  keywords: [
    "cybersecurity",
    "AI security",
    "threat detection",
    "red team",
    "penetration testing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* GSAP loaded via CDN for global scroll-trigger animations */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
