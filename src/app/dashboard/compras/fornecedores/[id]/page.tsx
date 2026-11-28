// This page uses dynamic server data
// With cacheComponents: true, instant=false allows blocking render + connection() opts out of prerender

import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Package,
  Globe,
  FileText,
  Building2,
  User,
  ShoppingCart,
} from "lucide-react";
import { getSupplierById } from "../../actions";
import type { SupplierStatus, SupplierType } from "@/types/purchases";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_BADGE: Record<SupplierStatus, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-barber-success/10 text-barber-success" },
  inactive: { label: "Inativo", color: "bg-barber-dark text-barber-muted" },
};

const TYPE_LABEL: Record<SupplierType, string> = {
  company: "Pessoa jurídica",
  individual: "Pessoa física",
};

export default async function FornecedorDetailPage(props: { params: Promise<{ id: string }> }) {
  // Opt out of static prerendering — required when cacheComponents: true
  await connection();
  const { id } = await props.params;
  const supplier = await getSupplierById(id);

  if (!supplier) {
    notFound();
  }

  const badge = STATUS_BADGE[supplier.status];
  const addresses = supplier.addresses ?? [];
  const contacts = supplier.contacts ?? [];
  const products = supplier.products ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Back */}
      <Link
        href="/dashboard/compras/fornecedores"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fornecedores
      </Link>

      {/* Header Card */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="truncate font-display text-2xl font-bold text-barber-white">
                {supplier.trade_name || supplier.legal_name}
              </h1>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            {supplier.trade_name && (
              <p className="mt-1 text-sm text-barber-muted">{supplier.legal_name}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-barber-muted">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-barber-gold" />
                {TYPE_LABEL[supplier.supplier_type]}
              </span>
              {supplier.document && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-barber-gold" />
                  {supplier.document}
                </span>
              )}
              {supplier.category && (
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-barber-gold" />
                  {supplier.category}
                </span>
              )}
              {supplier.state_registration && (
                <span>Insc. Estadual: {supplier.state_registration}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/dashboard/compras/fornecedores/${id}/editar`}
              className="rounded-lg border border-barber-border bg-barber-graphite px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
            >
              Editar
            </Link>
            <Link
              href={`/dashboard/compras/ordens/novo?supplier_id=${id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-barber-gold/90"
            >
              <ShoppingCart className="h-4 w-4" />
              Nova ordem
            </Link>
          </div>
        </div>

        {/* Contact Summary */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {supplier.email && (
            <div className="flex items-center gap-3 rounded-lg border border-barber-border/50 bg-barber-dark/30 p-3">
              <Mail className="h-4 w-4 text-barber-gold" />
              <div className="min-w-0">
                <p className="text-xs text-barber-muted">Email</p>
                <p className="truncate text-sm font-medium text-barber-white">{supplier.email}</p>
              </div>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-3 rounded-lg border border-barber-border/50 bg-barber-dark/30 p-3">
              <Phone className="h-4 w-4 text-barber-gold" />
              <div className="min-w-0">
                <p className="text-xs text-barber-muted">Telefone</p>
                <p className="truncate text-sm font-medium text-barber-white">{supplier.phone}</p>
              </div>
            </div>
          )}
          {supplier.whatsapp && (
            <div className="flex items-center gap-3 rounded-lg border border-barber-border/50 bg-barber-dark/30 p-3">
              <Phone className="h-4 w-4 text-barber-success" />
              <div className="min-w-0">
                <p className="text-xs text-barber-muted">WhatsApp</p>
                <p className="truncate text-sm font-medium text-barber-white">{supplier.whatsapp}</p>
              </div>
            </div>
          )}
          {supplier.website && (
            <div className="flex items-center gap-3 rounded-lg border border-barber-border/50 bg-barber-dark/30 p-3">
              <Globe className="h-4 w-4 text-barber-gold" />
              <div className="min-w-0">
                <p className="text-xs text-barber-muted">Website</p>
                <p className="truncate text-sm font-medium text-barber-white">{supplier.website}</p>
              </div>
            </div>
          )}
        </div>

        {supplier.notes && (
          <div className="mt-4 rounded-lg border border-barber-border/50 bg-barber-warning/10 p-4">
            <p className="text-xs font-medium text-barber-warning">Observações</p>
            <p className="mt-1 text-sm text-barber-white whitespace-pre-line">{supplier.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs Content — stacked sections for simplicity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Addresses */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-barber-white">
              <MapPin className="h-5 w-5 text-barber-gold" />
              Endereços
            </h2>
            <span className="text-xs font-medium text-barber-muted">{addresses.length} registrados</span>
          </div>
          {addresses.length === 0 ? (
            <p className="mt-4 text-sm text-barber-muted">Nenhum endereço cadastrado.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="rounded-lg border border-barber-border/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-barber-dark px-1.5 py-0.5 text-[10px] font-bold uppercase text-barber-muted">
                      {addr.address_type}
                    </span>
                    {addr.city && (
                      <span className="text-sm font-medium text-barber-white">
                        {addr.city}{addr.state ? ` / ${addr.state}` : ""}
                      </span>
                    )}
                  </div>
                  {(addr.street || addr.postal_code) && (
                    <p className="mt-1 text-xs text-barber-muted">
                      {[addr.street, addr.number, addr.complement].filter(Boolean).join(", ")}
                      {addr.postal_code ? ` · CEP ${addr.postal_code}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-barber-white">
              <User className="h-5 w-5 text-barber-gold" />
              Contatos
            </h2>
            <span className="text-xs font-medium text-barber-muted">{contacts.length} registrados</span>
          </div>
          {contacts.length === 0 ? (
            <p className="mt-4 text-sm text-barber-muted">Nenhum contato cadastrado.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-barber-border/50 p-3">
                  <p className="font-medium text-barber-white">{contact.name}</p>
                  {contact.job_title && (
                    <p className="text-xs text-barber-muted">{contact.job_title}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-barber-muted">
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                    {contact.whatsapp && <span className="text-barber-success">WA: {contact.whatsapp}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Linked Products */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-barber-white">
            <Package className="h-5 w-5 text-barber-gold" />
            Produtos vinculados
          </h2>
          <span className="text-xs font-medium text-barber-muted">{products.length} produtos</span>
        </div>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-barber-muted">
            Nenhum produto vinculado a este fornecedor. Vincule produtos para rastrear preços de compra.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-barber-border bg-barber-dark/50">
                <tr>
                  <th className="px-4 py-2 font-semibold text-barber-white">Produto</th>
                  <th className="px-4 py-2 font-semibold text-barber-white">Código fornecedor</th>
                  <th className="px-4 py-2 text-right font-semibold text-barber-white">Preço compra</th>
                  <th className="px-4 py-2 text-right font-semibold text-barber-white">Lead time</th>
                  <th className="px-4 py-2 text-right font-semibold text-barber-white">Qtd. mínima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-barber-border">
                {products.map((sp) => (
                  <tr key={sp.id} className={!sp.is_active ? "opacity-50" : ""}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-barber-white">{sp.product_name ?? sp.product_id}</p>
                      {sp.variant_name && (
                        <p className="text-xs text-barber-muted">{sp.variant_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-barber-muted">
                      {sp.supplier_product_code ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-barber-white">
                      {sp.purchase_price != null ? brl.format(sp.purchase_price) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-barber-muted">
                      {sp.lead_time_days != null ? `${sp.lead_time_days} dias` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-barber-muted">
                      {sp.minimum_order_quantity != null ? sp.minimum_order_quantity : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Metadata Footer */}
      <div className="rounded-lg border border-barber-border/50 bg-barber-dark/30 px-4 py-3 text-xs text-barber-muted">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>Criado em: {new Date(supplier.created_at).toLocaleDateString("pt-BR")}</span>
          <span>Atualizado em: {new Date(supplier.updated_at).toLocaleDateString("pt-BR")}</span>
          {supplier.archived_at && (
            <span className="text-barber-error">Arquivado em: {new Date(supplier.archived_at).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>
    </div>
  );
}