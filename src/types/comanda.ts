// =============================================================================
// Barber-On Studio — Tipos para Comandas, Caixa e Comissões
// =============================================================================

// -----------------------------------------------------------------------------
// COMANDAS (Orders adaptadas para barbearia)
// -----------------------------------------------------------------------------

export type ComandaStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface ComandaItem {
  id: string;
  order_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  notes: string | null;
  created_at: string;
}

export interface Comanda {
  id: string;
  organization_id: string;
  customer_id: string | null;
  assigned_barber_id: string | null;
  cash_session_id: string | null;
  appointment_id: string | null;
  status: ComandaStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  issued_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  customer_name?: string | null;
  barber_name?: string | null;
  items?: ComandaItem[];
}

export interface CreateComandaInput {
  customer_id?: string | null;
  assigned_barber_id?: string | null;
  appointment_id?: string | null;
  notes?: string | null;
}

export interface AddComandaItemInput {
  order_id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  notes?: string | null;
}

export interface UpdateComandaItemInput {
  quantity?: number;
  unit_price?: number;
  discount?: number;
  notes?: string | null;
}

export interface CompleteComandaInput {
  order_id: string;
  payment_method: string;
  discount?: number;
  notes?: string | null;
}

// -----------------------------------------------------------------------------
// BARBER COMMISSIONS
// -----------------------------------------------------------------------------

export type CommissionStatus = "pending" | "paid" | "cancelled";
export type CommissionType = "percentage" | "fixed" | "none";

export interface BarberCommission {
  id: string;
  organization_id: string;
  order_id: string;
  order_item_id: string | null;
  membership_id: string;
  barber_service_id: string | null;
  service_name: string;
  service_price: number;
  commission_type: CommissionType;
  commission_value: number;
  commission_amount: number;
  status: CommissionStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  barber_name?: string | null;
}

export interface MarkCommissionPaidInput {
  commission_ids: string[];
}

// -----------------------------------------------------------------------------
// CASH REGISTER & SESSIONS
// -----------------------------------------------------------------------------

export type CashSessionStatus = "open" | "closed" | "cancelled";
export type CashMovementType = "sale" | "refund" | "withdrawal" | "deposit" | "adjustment";
export type PaymentMethod = "cash" | "pix" | "debit" | "credit" | "other";

export interface CashRegister {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashSession {
  id: string;
  organization_id: string;
  cash_register_id: string;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: CashSessionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  register_name?: string | null;
  opened_by_name?: string | null;
  closed_by_name?: string | null;
}

export interface CashMovement {
  id: string;
  organization_id: string;
  cash_session_id: string;
  movement_type: CashMovementType;
  amount: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  payment_method: PaymentMethod | null;
  created_by: string;
  created_at: string;
  // Joins
  created_by_name?: string | null;
}

export interface OpenCashSessionInput {
  cash_register_id: string;
  opening_amount: number;
  notes?: string | null;
}

export interface CloseCashSessionInput {
  cash_session_id: string;
  closing_amount: number;
  notes?: string | null;
}

export interface CreateCashMovementInput {
  cash_session_id: string;
  movement_type: CashMovementType;
  amount: number;
  description?: string | null;
  payment_method?: PaymentMethod | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

// -----------------------------------------------------------------------------
// DAILY CASH SUMMARY
// -----------------------------------------------------------------------------

export interface DailyCashSummary {
  total_sales: number;
  total_refunds: number;
  total_withdrawals: number;
  total_deposits: number;
  net_amount: number;
  orders_count: number;
  commissions_pending: number;
  commissions_paid: number;
}

// -----------------------------------------------------------------------------
// STATS
// -----------------------------------------------------------------------------

export interface ComandaStats {
  total_open: number;
  total_completed_today: number;
  revenue_today: number;
  avg_ticket: number;
}

export interface CommissionStats {
  total_pending: number;
  total_pending_amount: number;
  total_paid_this_month: number;
  top_barber_name: string | null;
  top_barber_amount: number;
}