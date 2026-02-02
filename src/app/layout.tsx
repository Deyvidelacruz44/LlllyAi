import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://agenda-ai.vercel.app'),
  title: {
    default: "Agenda AI Personal",
    template: "%s | Agenda AI",
  },
  description: "Agenda personal inteligente con asistente IA, gestión de tareas, calendario y análisis de productividad. Organiza tu vida con inteligencia artificial.",
  manifest: "/manifest.json",
  keywords: ["agenda", "productividad", "IA", "tareas", "calendario", "organización", "inteligencia artificial"],
  authors: [{ name: "Agenda AI Team" }],
  creator: "Agenda AI",
  publisher: "Agenda AI",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://agenda-ai.vercel.app",
    siteName: "Agenda AI Personal",
    title: "Agenda AI Personal - Tu asistente inteligente",
    description: "Organiza tu vida con inteligencia artificial. Gestión de tareas, calendario y análisis de productividad.",
    images: [
      {
        url: "/icon-192.svg",
        width: 192,
        height: 192,
        alt: "Agenda AI Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Agenda AI Personal",
    description: "Agenda personal inteligente con asistente IA",
    images: ["/icon-192.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agenda AI",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
