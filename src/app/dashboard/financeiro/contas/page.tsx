import { Plus, Landmark, Wallet, CreditCard, Smartphone } from "lucide-react";
import Link from "next/link";
import { getAccounts, getAccountBalance } from "../actions";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const typeLabels: Record<string, string> = {
  bank_account: "Conta Bancária",
  cash: "Caixa",
  digital_wallet: "Carteira Digital",
  payment_account: "Conta de Pagamento",
  other: "Outra",
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  bank_account: Landmark,
  cash: Wallet,
  digital_wallet: Smartphone,
  payment_account: CreditCard,
  other: Wallet,
};

export default async function ContasPage() {
  const accounts = await getAccounts();

  const accountsWithBalance = await Promise.all(
    accounts.map(async (acc) => ({
      ...acc,
      balance: await getAccountBalance(acc.id),
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-barber-white">Contas Financeiras</h1>
        <button className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-opacity hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nova Conta
        </button>
      </div>

      {accountsWithBalance.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-barber-border bg-barber-graphite py-16">
          <Landmark className="mb-4 h-12 w-12 text-barber-muted/50" />
          <p className="text-lg font-medium text-barber-white">Nenhuma conta cadastrada</p>
          <p className="text-sm text-barber-muted">Adicione suas contas bancárias, caixa e carteiras digitais.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accountsWithBalance.map((account) => {
            const Icon = typeIcons[account.account_type] ?? Wallet;
            return (
              <div
                key={account.id}
                className={`rounded-xl border bg-barber-graphite p-5 transition-shadow hover:shadow-sm ${
                  account.is_active ? "border-barber-border" : "border-barber-border opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-barber-gold/10">
                      <Icon className="h-5 w-5 text-barber-gold" />
                    </div>
                    <div>
                      <p className="font-semibold text-barber-white">{account.name}</p>
                      <p className="text-xs text-barber-muted">
                        {typeLabels[account.account_type] ?? account.account_type}
                        {account.institution_name && ` · ${account.institution_name}`}
                      </p>
                    </div>
                  </div>
                  {!account.is_active && (
                    <span className="rounded bg-barber-muted/10 px-2 py-0.5 text-xs font-medium text-barber-muted">Inativa</span>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-xs text-barber-muted">Saldo atual</p>
                  <p className={`text-2xl font-bold ${account.balance >= 0 ? "text-barber-white" : "text-barber-error"}`}>
                    {brl.format(account.balance)}
                  </p>
                </div>

                {account.description && (
                  <p className="mt-3 text-xs text-barber-muted line-clamp-2">{account.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}