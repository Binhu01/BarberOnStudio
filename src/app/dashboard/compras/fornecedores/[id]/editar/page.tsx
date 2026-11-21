// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSupplierById } from "../../../actions";
import { SupplierForm } from "../../_components/supplier-form";

export default async function EditarFornecedorPage(props: { params: Promise<{ id: string }> }) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();
  const { id } = await props.params;
  const supplier = await getSupplierById(id);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/compras/fornecedores/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para detalhes
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">Editar fornecedor</h1>
        <p className="mt-1 text-sm text-barber-muted">
          {supplier.trade_name || supplier.legal_name}
        </p>
      </div>

      <SupplierForm supplier={supplier} />
    </div>
  );
}