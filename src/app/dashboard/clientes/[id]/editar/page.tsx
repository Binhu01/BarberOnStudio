// This page uses dynamic server data

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CustomerForm from "../../_components/customer-form";
import { getCustomerById, updateCustomer } from "../../actions";
import type { CreateCustomerInput } from "../../schemas";

interface EditarClientePageProps {
 params: Promise<{ id: string }>;
}

export default async function EditarClientePage({
 params,
}: EditarClientePageProps) {
 const { id } = await params;
 const customer = await getCustomerById(id);

 if (!customer) {
 notFound();
 }

 async function handleSubmit(data: CreateCustomerInput) {
 "use server";
 const result = await updateCustomer(id, data);
 if (result.error) {
 return { error: result.error };
 }
 return {};
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center gap-3">
 <Link
 href={`/dashboard/clientes/${id}`}
 className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-barber-border text-barber-muted transition-colors hover:bg-barber-dark/50 hover:text-barber-white"
 >
 <ArrowLeft className="h-4 w-4" />
 </Link>
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-white">
 Editar Cliente
 </h1>
 <p className="mt-0.5 text-sm text-barber-muted">
 Atualize os dados de {customer.name}
 </p>
 </div>
 </div>

 {/* Form */}
 <div className="max-w-3xl">
 <CustomerForm
 initialData={customer}
 onSubmit={handleSubmit}
 submitLabel="Salvar alterações"
 />
 </div>
 </div>
 );
}