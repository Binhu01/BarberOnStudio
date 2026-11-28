// This page uses dynamic server data

import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "../_components/task-form";
import { getActiveMembers } from "../actions";

export default async function NovaTarefaPage() {
  // Opt out of static prerendering — required when cacheComponents: true

  await connection();
  const members = await getActiveMembers();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/tarefas"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para tarefas
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">Nova tarefa</h1>
        <p className="mt-1 text-sm text-barber-muted">
          Crie uma tarefa e atribua a um membro da equipe.
        </p>
      </div>

      <TaskForm members={members} />
    </div>
  );
}