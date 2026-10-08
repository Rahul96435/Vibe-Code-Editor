import type { Metadata } from "next";
import "./globals.css";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-providers";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "VibeCode Editor",
  description:
    "An intelligent Next.js code editor with AI-assisted suggestions, project playgrounds, and WebContainer previews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="flex flex-col min-h-screen">
              <Toaster />
              <div className="flex-1">{children}</div>
            </div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
