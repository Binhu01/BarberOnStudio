import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const integrationConnectionSchema = z.object({
  provider: z.enum([
    "whatsapp_meta", "resend", "mercadopago", "stripe", "google_calendar",
    "instagram", "tiktok", "webhook_custom",
  ]),
  name: z.string().min(1).max(200),
  config: z.record(z.any()).default({}),
  is_active: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrationConnection {
  id: string;
  provider: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string;
  processed: boolean;
  processing_error: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface DashboardKPIs {
  today_appointments: number;
  week_appointments: number;
  month_revenue: number;
  month_new_customers: number;
  pending_receivables: number;
  overdue_receivables: number;
  low_stock_products: number;
  active_subscriptions: number;
}