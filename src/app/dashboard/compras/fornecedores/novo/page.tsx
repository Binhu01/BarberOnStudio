// This page uses dynamic server data
export const instant = false;

import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupplierForm } from "../_components/supplier-form";

export default async function NovoFornecedorPage() {
  await headers();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/compras/fornecedores"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fornecedores
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">Novo fornecedor</h1>
        <p className="mt-1 text-sm text-barber-muted">
          Cadastre um novo fornecedor para vincular a ordens de compra.
        </p>
      </div>

      <SupplierForm />
    </div>
  );
}