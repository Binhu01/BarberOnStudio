// This page uses dynamic server data

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import LeadForm from "../../_components/lead-form";
import { getLeadById, getPipelineAndStages, updateLead } from "../../actions";
import type { CreateLeadInput } from "../../schemas";

interface EditarLeadPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarLeadPage({
  params,
}: EditarLeadPageProps) {
  const { id } = await params;
  const [lead, pipelineData] = await Promise.all([
    getLeadById(id),
    getPipelineAndStages(),
  ]);

  if (!lead) {
    notFound();
  }

  async function handleSubmit(data: CreateLeadInput) {
    "use server";
    const result = await updateLead(id, data);
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
          href={`/dashboard/leads/${id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-barber-border text-barber-muted transition-colors hover:bg-barber-dark/50 hover:text-barber-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">
            Editar Lead
          </h1>
          <p className="mt-0.5 text-sm text-barber-muted">
            Atualize os dados de {lead.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <LeadForm
          initialData={lead}
          stages={pipelineData.stages}
          onSubmit={handleSubmit}
          submitLabel="Salvar alterações"
        />
      </div>
    </div>
  );
}