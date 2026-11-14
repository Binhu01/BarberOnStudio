// This page uses dynamic server data
export const instant = false;

import { getComandaById } from "../actions";
import { ComandaDetailClient } from "./_components/comanda-detail-client";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ComandaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const comanda = await getComandaById(id);

  if (!comanda) notFound();

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/comandas"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Comandas
      </Link>

      <ComandaDetailClient comanda={comanda} />
    </div>
  );
}