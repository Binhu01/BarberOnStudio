import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#08090B",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://barberon.com.br"),
  title: {
    default: "Barber-On Studio — Gestão Premium para Barbearias",
    template: "%s | Barber-On Studio",
  },
  description:
    "Sistema completo de gestão para barbearias: agendamentos online, comandas, caixa, comissões automáticas, fidelidade e assinaturas. Profissionalize sua barbearia.",
  keywords: [
    "barbearia",
    "gestão barbearia",
    "agendamento barbearia",
    "comanda barbearia",
    "sistema barbearia",
    "barber shop management",
    "barber scheduling",
  ],
  authors: [{ name: "Barber-On Studio" }],
  creator: "Barber-On Studio",
  publisher: "Barber-On Studio",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://barberon.com.br",
    siteName: "Barber-On Studio",
    title: "Barber-On Studio — Gestão Premium para Barbearias",
    description:
      "Agendamentos, comandas, caixa, comissões e fidelidade em um só lugar. Profissionalize a gestão da sua barbearia.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Barber-On Studio — Gestão Premium para Barbearias",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barber-On Studio — Gestão Premium para Barbearias",
    description:
      "Agendamentos, comandas, caixa, comissões e fidelidade em um só lugar.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://barberon.com.br",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Barber-On",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn(inter.variable, montserrat.variable, "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Barber-On" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-bo-black font-sans text-bo-white antialiased">
        {children}
      </body>
    </html>
  );
}