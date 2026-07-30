import type { Metadata } from "next";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shield Her — Professional Protection & Peace of Mind",
  description:
    "Shield Her provides AI-powered safety analysis, companion networks, and rapid response systems designed specifically for modern women's peace of mind.",
  keywords: ["women safety", "personal protection", "AI safety", "safety network", "threat detection"],
};

import { LanguageProvider } from "@/components/LanguageProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
