import { z } from "zod";

// -----------------------------------------------------------------------------
// COMANDAS
// -----------------------------------------------------------------------------

export const createComandaSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  assigned_barber_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const addComandaItemSchema = z.object({
  order_id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
  unit_price: z.number().min(0, "Preço não pode ser negativo"),
  discount: z.number().min(0).optional().default(0),
  notes: z.string().max(300).nullable().optional(),
});

export const updateComandaItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  unit_price: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().max(300).nullable().optional(),
});

export const completeComandaSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(["cash", "pix", "debit", "credit", "other"]),
  discount: z.number().min(0).optional().default(0),
  notes: z.string().max(500).nullable().optional(),
});

// -----------------------------------------------------------------------------
// CAIXA
// -----------------------------------------------------------------------------

export const openCashSessionSchema = z.object({
  cash_register_id: z.string().uuid(),
  opening_amount: z.number().min(0, "Valor de abertura não pode ser negativo"),
  notes: z.string().max(500).nullable().optional(),
});

export const closeCashSessionSchema = z.object({
  cash_session_id: z.string().uuid(),
  closing_amount: z.number().min(0, "Valor de fechamento não pode ser negativo"),
  notes: z.string().max(500).nullable().optional(),
});

export const createCashMovementSchema = z.object({
  cash_session_id: z.string().uuid(),
  movement_type: z.enum(["sale", "refund", "withdrawal", "deposit", "adjustment"]),
  amount: z.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória").max(300),
  payment_method: z.enum(["cash", "pix", "debit", "credit", "other"]).nullable().optional(),
  reference_type: z.string().max(50).nullable().optional(),
  reference_id: z.string().uuid().nullable().optional(),
});

// -----------------------------------------------------------------------------
// COMISSÕES
// -----------------------------------------------------------------------------

export const markCommissionPaidSchema = z.object({
  commission_ids: z.array(z.string().uuid()).min(1, "Selecione pelo menos uma comissão"),
});

// -----------------------------------------------------------------------------
// EXPORTS DE TIPOS INFERIDOS
// -----------------------------------------------------------------------------

export type CreateComandaInput = z.infer<typeof createComandaSchema>;
export type AddComandaItemInput = z.infer<typeof addComandaItemSchema>;
export type UpdateComandaItemInput = z.infer<typeof updateComandaItemSchema>;
export type CompleteComandaInput = z.infer<typeof completeComandaSchema>;
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type CreateCashMovementInput = z.infer<typeof createCashMovementSchema>;
export type MarkCommissionPaidInput = z.infer<typeof markCommissionPaidSchema>;