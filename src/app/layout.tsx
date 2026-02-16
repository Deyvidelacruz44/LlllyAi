import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://lilly-ia.netlify.app'),
  title: {
    default: "Lilly AI",
    template: "%s | Lilly AI",
  },
  description: "Asistente personal inteligente con IA, gestión de tareas, calendario y análisis de productividad. Organiza tu vida con inteligencia artificial.",
  manifest: "/manifest.json",
  keywords: ["lilly", "productividad", "IA", "tareas", "calendario", "organización", "inteligencia artificial"],
  authors: [{ name: "Lilly AI Team" }],
  creator: "Lilly AI",
  publisher: "Lilly AI",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://lilly-ia.netlify.app",
    siteName: "Lilly AI",
    title: "Lilly AI - Tu asistente inteligente",
    description: "Organiza tu vida con inteligencia artificial. Gestión de tareas, calendario y análisis de productividad.",
    images: [
      {
        url: "/icon-192.svg",
        width: 192,
        height: 192,
        alt: "Lilly AI Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Lilly AI",
    description: "Asistente personal inteligente con IA",
    images: ["/icon-192.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lilly AI",
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
