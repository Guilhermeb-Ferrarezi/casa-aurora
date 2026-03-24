import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Casa Aurora",
  description: "Um espaco acolhedor para entrar, respirar e continuar no seu ritmo.",
  icons: {
    icon: [
      { url: "/casa-aurora.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "64x64" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/casa-aurora.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("h-full antialiased", jetbrainsMono.variable)}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-background font-sans text-foreground"
      >
        {children}
      </body>
    </html>
  );
}
