"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TrialBannerProps {
  trialEnd: string;
  planName: string;
  status: string;
}

export function TrialBanner({ trialEnd, planName, status }: TrialBannerProps) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!trialEnd || status !== "trialing") return;

    const update = () => {
      const now = new Date();
      const end = new Date(trialEnd);
      const diffMs = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      setDaysLeft(Math.max(0, diffDays));
    };

    update();
    const interval = setInterval(update, 60_000); // atualizar a cada minuto
    return () => clearInterval(interval);
  }, [trialEnd, status]);

  if (status !== "trialing" || daysLeft === null || daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7 && !isUrgent;

  const bgClass = isUrgent
    ? "bg-red-900/30 border-red-500/50"
    : isWarning
      ? "bg-amber-900/30 border-amber-500/50"
      : "bg-emerald-900/30 border-emerald-500/50";

  const textClass = isUrgent
    ? "text-red-200"
    : isWarning
      ? "text-amber-200"
      : "text-emerald-200";

  const badgeClass = isUrgent
    ? "bg-red-500/20 text-red-300"
    : isWarning
      ? "bg-amber-500/20 text-amber-300"
      : "bg-emerald-500/20 text-emerald-300";

  return (
    <div className={`rounded-lg border px-4 py-3 mb-6 ${bgClass}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏱️</span>
          <div>
            <p className={`font-medium ${textClass}`}>
              Trial do plano {planName} — {daysLeft} {daysLeft === 1 ? "dia" : "dias"} restante{daysLeft !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-white/60 mt-0.5">
              Seu acesso gratuito termina em{" "}
              {new Date(trialEnd).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass}`}>
            TRIAL ATIVO
          </span>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            Assinar agora →
          </Link>
        </div>
      </div>
    </div>
  );
}