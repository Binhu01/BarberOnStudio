"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, X, Plus, Trash2 } from "lucide-react";
import type { SupplierWithDetails, SupplierType, SupplierStatus } from "@/types/purchases";
import {
  createSupplier,
  updateSupplier,
  addSupplierAddress,
  deleteSupplierAddress,
  addSupplierContact,
  deleteSupplierContact,
} from "../../actions";

interface SupplierFormProps {
  supplier?: SupplierWithDetails;
}

export function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local state for dynamic sub-resource lists
  const [addresses, setAddresses] = useState(supplier?.addresses ?? []);
  const [contacts, setContacts] = useState(supplier?.contacts ?? []);
  const [newAddr, setNewAddr] = useState({ address_type: "main" as const, postal_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [newContact, setNewContact] = useState({ name: "", job_title: "", email: "", phone: "", whatsapp: "" });
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);

  const isEditing = !!supplier;

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const data = {
          supplier_type: formData.get("supplier_type") as SupplierType,
          legal_name: formData.get("legal_name") as string,
          trade_name: (formData.get("trade_name") as string) || undefined,
          document: (formData.get("document") as string) || undefined,
          state_registration: (formData.get("state_registration") as string) || undefined,
          email: (formData.get("email") as string) || undefined,
          phone: (formData.get("phone") as string) || undefined,
          whatsapp: (formData.get("whatsapp") as string) || undefined,
          website: (formData.get("website") as string) || undefined,
          category: (formData.get("category") as string) || undefined,
          notes: (formData.get("notes") as string) || undefined,
        };

        if (isEditing && supplier) {
          await updateSupplier(supplier.id, data);
        } else {
          await createSupplier(data);
        }
        router.push("/dashboard/compras/fornecedores");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar fornecedor.");
      }
    });
  }

  async function handleAddAddress() {
    if (!supplier || !newAddr.street) return;
    try {
      await addSupplierAddress(supplier.id, newAddr);
      router.refresh();
      setNewAddr({ address_type: "main", postal_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
      setShowAddrForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar endereço.");
    }
  }

  async function handleDeleteAddress(addressId: string) {
    if (!supplier) return;
    try {
      await deleteSupplierAddress(addressId);
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover endereço.");
    }
  }

  async function handleAddContact() {
    if (!supplier || !newContact.name) return;
    try {
      await addSupplierContact(supplier.id, newContact);
      router.refresh();
      setNewContact({ name: "", job_title: "", email: "", phone: "", whatsapp: "" });
      setShowContactForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar contato.");
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!supplier) return;
    try {
      await deleteSupplierContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover contato.");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-dark">Dados do fornecedor</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Tipo *</label>
              <select
                name="supplier_type"
                defaultValue={supplier?.supplier_type ?? "company"}
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              >
                <option value="company">Pessoa jurídica</option>
                <option value="individual">Pessoa física</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Categoria</label>
              <input
                name="category"
                defaultValue={supplier?.category ?? ""}
                placeholder="Ex: Alimentos, Embalagens, Serviços…"
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Razão social / Nome *</label>
              <input
                name="legal_name"
                required
                defaultValue={supplier?.legal_name ?? ""}
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Nome fantasia</label>
              <input
                name="trade_name"
                defaultValue={supplier?.trade_name ?? ""}
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">CPF / CNPJ</label>
              <input
                name="document"
                defaultValue={supplier?.document ?? ""}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Inscrição estadual</label>
              <input
                name="state_registration"
                defaultValue={supplier?.state_registration ?? ""}
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-dark">Contato principal</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={supplier?.email ?? ""}
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Telefone</label>
              <input
                name="phone"
                defaultValue={supplier?.phone ?? ""}
                placeholder="(00) 0000-0000"
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">WhatsApp</label>
              <input
                name="whatsapp"
                defaultValue={supplier?.whatsapp ?? ""}
                placeholder="(00) 00000-0000"
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-barber-dark">Website</label>
              <input
                name="website"
                defaultValue={supplier?.website ?? ""}
                placeholder="https://"
                className="w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-barber-dark">Observações</h2>
          <textarea
            name="notes"
            rows={3}
            defaultValue={supplier?.notes ?? ""}
            placeholder="Informações adicionais sobre este fornecedor…"
            className="mt-4 w-full rounded-lg border border-barber-border bg-white px-3 py-2.5 text-sm focus:border-barber-blue focus:outline-none focus:ring-1 focus:ring-barber-blue"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-barber-blue px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-barber-blue/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar fornecedor"}
          </button>
          <a
            href="/dashboard/compras/fornecedores"
            className="inline-flex items-center gap-2 rounded-lg border border-barber-border bg-white px-6 py-2.5 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-bg-secondary"
          >
            <X className="h-4 w-4" />
            Cancelar
          </a>
        </div>
      </form>

      {/* Addresses Section (edit mode only) */}
      {isEditing && supplier && (
        <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-barber-dark">Endereços</h2>
            {!showAddrForm && (
              <button
                onClick={() => setShowAddrForm(true)}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-barber-blue hover:bg-barber-blue/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            )}
          </div>

          {showAddrForm && (
            <div className="mt-4 rounded-lg border border-barber-border/50 bg-barber-bg-secondary/30 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Tipo</label>
                  <select
                    value={newAddr.address_type}
                    onChange={(e) => setNewAddr({ ...newAddr, address_type: e.target.value as typeof newAddr.address_type })}
                    className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="main">Principal</option>
                    <option value="billing">Cobrança</option>
                    <option value="shipping">Entrega</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">CEP</label>
                  <input value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Logradouro *</label>
                  <input value={newAddr.street} onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Número</label>
                  <input value={newAddr.number} onChange={(e) => setNewAddr({ ...newAddr, number: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Complemento</label>
                  <input value={newAddr.complement} onChange={(e) => setNewAddr({ ...newAddr, complement: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Bairro</label>
                  <input value={newAddr.neighborhood} onChange={(e) => setNewAddr({ ...newAddr, neighborhood: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Cidade</label>
                  <input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">UF</label>
                  <input value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} maxLength={2} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm uppercase" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleAddAddress} className="rounded-md bg-barber-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-barber-blue/90">Adicionar</button>
                <button onClick={() => setShowAddrForm(false)} className="rounded-md border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-dark hover:bg-barber-bg-secondary">Cancelar</button>
              </div>
            </div>
          )}

          {addresses.length > 0 && (
            <div className="mt-4 space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="flex items-center justify-between rounded-lg border border-barber-border/50 p-3">
                  <div>
                    <span className="rounded bg-barber-bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-barber-text-secondary">{addr.address_type}</span>
                    <p className="mt-1 text-sm text-barber-dark">{[addr.street, addr.number, addr.complement].filter(Boolean).join(", ")}</p>
                    <p className="text-xs text-barber-text-secondary">{[addr.neighborhood, addr.city, addr.state, addr.postal_code].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button onClick={() => handleDeleteAddress(addr.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts Section (edit mode only) */}
      {isEditing && supplier && (
        <div className="rounded-xl border border-barber-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-barber-dark">Contatos adicionais</h2>
            {!showContactForm && (
              <button
                onClick={() => setShowContactForm(true)}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-barber-blue hover:bg-barber-blue/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            )}
          </div>

          {showContactForm && (
            <div className="mt-4 rounded-lg border border-barber-border/50 bg-barber-bg-secondary/30 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Nome *</label>
                  <input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Cargo</label>
                  <input value={newContact.job_title} onChange={(e) => setNewContact({ ...newContact, job_title: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Email</label>
                  <input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">Telefone</label>
                  <input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-barber-dark">WhatsApp</label>
                  <input value={newContact.whatsapp} onChange={(e) => setNewContact({ ...newContact, whatsapp: e.target.value })} className="w-full rounded-md border border-barber-border bg-white px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleAddContact} className="rounded-md bg-barber-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-barber-blue/90">Adicionar</button>
                <button onClick={() => setShowContactForm(false)} className="rounded-md border border-barber-border px-3 py-1.5 text-xs font-medium text-barber-dark hover:bg-barber-bg-secondary">Cancelar</button>
              </div>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="mt-4 space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between rounded-lg border border-barber-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium text-barber-dark">{contact.name}</p>
                    {contact.job_title && <p className="text-xs text-barber-text-secondary">{contact.job_title}</p>}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-barber-text-secondary">
                      {contact.email && <span>{contact.email}</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteContact(contact.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}