"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 // Log estruturado do erro no cliente
 const entry = {
 timestamp: new Date().toISOString(),
 level: "error",
 message: "Unhandled UI error",
 error: {
 name: error.name,
 message: error.message,
 stack: error.stack,
 digest: error.digest,
 },
 url: window.location.href,
 userAgent: navigator.userAgent,
 };

 console.error(JSON.stringify(entry));

 // TODO: enviar para serviço externo (Sentry, etc.) quando configurado
 }, [error]);

 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-barber-dark px-6 text-center">
 <div className="max-w-md space-y-6">
 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
 <span className="text-3xl">⚠️</span>
 </div>

 <h1 className="text-2xl font-bold text-barber-white">
 Algo deu errado
 </h1>

 <p className="text-barber-muted">
 Ocorreu um erro inesperado. Nossa equipe já foi notificada.
 Tente novamente ou volte mais tarde.
 </p>

 {error.digest && (
 <p className="font-mono text-xs text-barber-muted/60">
 Ref: {error.digest}
 </p>
 )}

 <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
 <button
 onClick={reset}
 className="rounded-lg bg-barber-gold px-6 py-3 text-sm font-semibold text-barber-dark transition hover:bg-barber-copper"
 >
 Tentar novamente
 </button>
 <Link
 href="/dashboard"
 className="rounded-lg border border-barber-border px-6 py-3 text-sm font-semibold text-barber-white transition hover:bg-barber-graphite"
 >
 Ir para Dashboard
 </Link>
 </div>
 </div>
 </div>
 );
}