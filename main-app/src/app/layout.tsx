import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/hooks/useTheme";
import PrivyProviderWrapper from "@/components/PrivyProviderWrapper";

export const metadata: Metadata = {
  title: "Polymarket Leverage Simulator",
  description: "Paper trading with leverage on Polymarket prediction markets",
};

// Script to set theme before React hydrates (prevents flash)
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute('data-theme', theme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script to prevent theme flash on load */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <PrivyProviderWrapper>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
