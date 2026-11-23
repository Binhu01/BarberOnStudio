"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Registrar service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.info("[PWA] Service worker registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err);
        });
    }

    // Capturar evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostrar banner após pequeno delay para não atrapalhar onboarding
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Verificar se já foi instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowBanner(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.info("[PWA] User accepted install prompt");
    } else {
      console.info("[PWA] User dismissed install prompt");
    }

    setDeferredPrompt(null);
    setShowBanner(false);
  }

  function handleDismiss() {
    setShowBanner(false);
    // Não mostrar novamente nesta sessão
    sessionStorage.setItem("pwa-install-dismissed", "true");
  }

  if (!showBanner || !deferredPrompt) return null;
  if (sessionStorage.getItem("pwa-install-dismissed") === "true") return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-4 rounded-xl border border-barber-gold/30 bg-barber-graphite/95 p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-barber-gold/20">
          <span className="text-2xl">💈</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-barber-white">
            Instalar Barber-On
          </p>
          <p className="text-xs text-barber-muted truncate">
            Acesse rápido como um app nativo
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleDismiss}
            className="rounded-lg px-3 py-2 text-xs font-medium text-barber-muted transition hover:text-barber-white"
          >
            Agora não
          </button>
          <button
            onClick={handleInstall}
            className="rounded-lg bg-barber-gold px-4 py-2 text-xs font-semibold text-barber-dark transition hover:bg-barber-copper"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}