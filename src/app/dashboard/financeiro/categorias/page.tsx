import { Plus, Tags, TrendingUp, TrendingDown } from "lucide-react";
import { getCategories } from "../actions";

export default async function CategoriasPage() {
  const [incomeCategories, expenseCategories] = await Promise.all([
    getCategories("income"),
    getCategories("expense"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Categorias Financeiras
        </h1>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income Categories */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite">
          <div className="flex items-center gap-2 border-b border-barber-border px-5 py-4">
            <TrendingUp className="h-5 w-5 text-barber-success" />
            <h2 className="text-lg font-semibold text-barber-white">Receitas</h2>
            <span className="ml-auto rounded-full bg-barber-success/10 px-2.5 py-0.5 text-xs font-medium text-barber-success">
              {incomeCategories.length}
            </span>
          </div>
          <div className="divide-y divide-barber-border">
            {incomeCategories.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-barber-muted">
                Nenhuma categoria de receita cadastrada.
              </p>
            ) : (
              incomeCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-barber-muted" />
                    <span className={`text-sm ${!cat.is_active ? "text-barber-muted line-through" : "text-barber-white"}`}>
                      {cat.name}
                    </span>
                  </div>
                  {!cat.is_active && (
                    <span className="rounded bg-barber-muted/10 px-2 py-0.5 text-xs text-barber-muted">Inativa</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expense Categories */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite">
          <div className="flex items-center gap-2 border-b border-barber-border px-5 py-4">
            <TrendingDown className="h-5 w-5 text-barber-error" />
            <h2 className="text-lg font-semibold text-barber-white">Despesas</h2>
            <span className="ml-auto rounded-full bg-barber-error/10 px-2.5 py-0.5 text-xs font-medium text-barber-error">
              {expenseCategories.length}
            </span>
          </div>
          <div className="divide-y divide-barber-border">
            {expenseCategories.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-barber-muted">
                Nenhuma categoria de despesa cadastrada.
              </p>
            ) : (
              expenseCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-barber-muted" />
                    <span className={`text-sm ${!cat.is_active ? "text-barber-muted line-through" : "text-barber-white"}`}>
                      {cat.name}
                    </span>
                  </div>
                  {!cat.is_active && (
                    <span className="rounded bg-barber-muted/10 px-2 py-0.5 text-xs text-barber-muted">Inativa</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}