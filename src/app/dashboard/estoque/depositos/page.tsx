"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Warehouse,
  MapPin,
  Check,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../actions";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
} from "../schemas";
import type { Warehouse as WarehouseType } from "@/types/inventory";

// --- Skeleton ---

function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-barber-border bg-barber-graphite p-5"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-barber-border" />
              <div className="h-4 w-20 animate-pulse rounded bg-barber-border" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded-full bg-barber-border" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-barber-border" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-barber-border" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Confirmation Dialog ---

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-lg">
        <h3 className="font-display text-lg font-semibold text-barber-white">
          {title}
        </h3>
        <p className="mt-2 text-sm text-barber-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-light hover:bg-barber-dark/50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Create/Edit Modal ---

function WarehouseModal({
  open,
  mode,
  warehouse,
  onSave,
  onCancel,
  saving,
}: {
  open: boolean;
  mode: "create" | "edit";
  warehouse: WarehouseType | null;
  onSave: (data: CreateWarehouseInput | UpdateWarehouseInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const isEdit = mode === "edit";

  const form = useForm<CreateWarehouseInput | UpdateWarehouseInput>({
    resolver: zodResolver(
      isEdit ? updateWarehouseSchema : createWarehouseSchema
    ) as never,
    defaultValues:
      isEdit && warehouse
        ? {
            name: warehouse.name,
            code: warehouse.code,
            address: warehouse.address ?? "",
            description: warehouse.description ?? "",
            is_default: warehouse.is_default,
            is_active: warehouse.is_active,
          }
        : {
            name: "",
            code: "",
            address: "",
            description: "",
            is_default: false,
          },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && warehouse) {
        form.reset({
          name: warehouse.name,
          code: warehouse.code,
          address: warehouse.address ?? "",
          description: warehouse.description ?? "",
          is_default: warehouse.is_default,
          is_active: warehouse.is_active,
        });
      } else {
        form.reset({
          name: "",
          code: "",
          address: "",
          description: "",
          is_default: false,
        });
      }
    }
  }, [open, isEdit, warehouse, form]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-barber-white">
            {isEdit ? "Editar Depósito" : "Novo Depósito"}
          </h3>
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-1.5 text-barber-muted hover:bg-barber-dark/50 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSave)} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Nome *
              </label>
              <input
                {...form.register("name")}
                placeholder="Ex: Depósito Central"
                className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm text-barber-white outline-none focus:border-barber-primary focus:ring-1 focus:ring-barber-primary"
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-barber-muted">
                Código *
              </label>
              <input
                {...form.register("code")}
                placeholder="Ex: DEP-01"
                className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm text-barber-white outline-none focus:border-barber-primary focus:ring-1 focus:ring-barber-primary"
              />
              {form.formState.errors.code && (
                <p className="mt-1 text-xs text-red-500">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">
              Endereço
            </label>
            <input
              {...form.register("address")}
              placeholder="Endereço completo do depósito"
              className="w-full rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm text-barber-white outline-none focus:border-barber-primary focus:ring-1 focus:ring-barber-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-barber-muted">
              Descrição
            </label>
            <textarea
              {...form.register("description")}
              rows={3}
              placeholder="Descrição opcional do depósito"
              className="w-full resize-none rounded-lg border border-barber-border bg-barber-graphite px-3 py-2 text-sm text-barber-white outline-none focus:border-barber-primary focus:ring-1 focus:ring-barber-primary"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                {...form.register("is_default")}
                className="rounded border-barber-border text-barber-primary focus:ring-barber-primary"
              />
              <span className="text-sm text-barber-light">Depósito padrão</span>
            </label>

            {isEdit && (
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  {...(
                    form as ReturnType<typeof useForm<UpdateWarehouseInput>>
                  ).register("is_active")}
                  className="rounded border-barber-border text-barber-primary focus:ring-barber-primary"
                />
                <span className="text-sm text-barber-light">Ativo</span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-light hover:bg-barber-dark/50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-barber-primary px-4 py-2 text-sm font-medium text-white hover:bg-barber-primary/90 disabled:opacity-50"
            >
              {saving ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Main Page Component ---

export default function DepositosPage() {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseType | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<WarehouseType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWarehouses = useCallback(async () => {
    try {
      const data = await getWarehouses();
      setWarehouses(data);
    } catch (err) {
      console.error("Erro ao carregar depósitos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — use a ref guard to avoid setState-in-effect lint error
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      void fetchWarehouses();
    }
  }, [fetchWarehouses]);

  // --- Handlers ---

  function openCreateModal() {
    setModalMode("create");
    setEditingWarehouse(null);
    setModalOpen(true);
  }

  function openEditModal(warehouse: WarehouseType) {
    setModalMode("edit");
    setEditingWarehouse(warehouse);
    setModalOpen(true);
  }

  async function handleSave(
    data: CreateWarehouseInput | UpdateWarehouseInput
  ) {
    setSaving(true);
    try {
      if (modalMode === "edit" && editingWarehouse) {
        await updateWarehouse(
          editingWarehouse.id,
          data as UpdateWarehouseInput
        );
      } else {
        await createWarehouse(data as CreateWarehouseInput);
      }
      setModalOpen(false);
      setEditingWarehouse(null);
      await fetchWarehouses();
    } catch (err) {
      console.error("Erro ao salvar depósito:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao salvar depósito."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWarehouse(deleteTarget.id);
      setDeleteTarget(null);
      await fetchWarehouses();
    } catch (err) {
      console.error("Erro ao excluir depósito:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao excluir depósito."
      );
    } finally {
      setDeleting(false);
    }
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-barber-white">
            Depósitos
          </h1>
          <p className="mt-1 text-sm text-barber-muted">
            Gerencie os depósitos e locais de armazenamento da sua organização.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-barber-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-barber-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Depósito
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <CardSkeleton />
      ) : warehouses.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-barber-border bg-barber-graphite py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-barber-dark">
            <Warehouse className="h-7 w-7 text-barber-muted" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-barber-white">
            Nenhum depósito cadastrado
          </h3>
          <p className="mt-1 max-w-xs text-sm text-barber-muted">
            Crie depósitos para organizar o controle de estoque por local físico
            ou centro de distribuição.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-barber-primary px-4 py-2 text-sm font-medium text-white hover:bg-barber-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Criar primeiro depósito
          </button>
        </div>
      ) : (
        /* Warehouses Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="group relative rounded-xl border border-barber-border bg-barber-graphite p-5 shadow-sm transition-colors hover:border-barber-primary/30 hover:shadow-md"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-barber-white">
                      {warehouse.name}
                    </h3>
                    {warehouse.is_default && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        <Check className="h-3 w-3" />
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-barber-muted">
                    {warehouse.code}
                  </p>
                </div>

                {/* Status Badge */}
                {warehouse.is_active ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-barber-dark px-2.5 py-0.5 text-xs font-medium text-barber-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-barber-text-secondary" />
                    Inativo
                  </span>
                )}
              </div>

              {/* Address */}
              {warehouse.address && (
                <div className="mt-3 flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-barber-muted" />
                  <p className="text-sm text-barber-muted line-clamp-2">
                    {warehouse.address}
                  </p>
                </div>
              )}

              {/* Description */}
              {warehouse.description && (
                <p className="mt-2 text-sm text-barber-muted line-clamp-2">
                  {warehouse.description}
                </p>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center justify-end gap-1 border-t border-barber-border pt-3 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => openEditModal(warehouse)}
                  title="Editar"
                  className="rounded-lg p-1.5 text-barber-muted hover:bg-barber-dark/50 hover:text-barber-primary"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(warehouse)}
                  title="Excluir"
                  className="rounded-lg p-1.5 text-barber-muted hover:bg-barber-error/10 hover:text-barber-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <WarehouseModal
        open={modalOpen}
        mode={modalMode}
        warehouse={editingWarehouse}
        onSave={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setEditingWarehouse(null);
        }}
        saving={saving}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir depósito"
        message={`Tem certeza que deseja excluir o depósito "${deleteTarget?.name}"? Esta ação não pode ser desfeita. Depósitos com saldo ou movimentações não podem ser excluídos.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}