import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme-2.css";
import "./design-kit.css";
import "./shell-kit.css";
import "./staff-kit.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#753b50",
};

export const metadata: Metadata = {
  title: { default: "ShePlates", template: "%s · ShePlates" },
  description: "Local food and essentials, planned around you.",
  applicationName: "ShePlates",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ShePlates",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
