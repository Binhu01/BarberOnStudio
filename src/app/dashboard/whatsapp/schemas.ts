import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const automationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  event_type: z.enum([
    "appointment_created", "appointment_confirmed", "appointment_cancelled",
    "appointment_reminder_24h", "appointment_reminder_1h",
    "subscription_expiring_7d", "subscription_expiring_3d", "subscription_expired",
    "payment_received", "payment_overdue",
    "customer_inactive_30d", "customer_inactive_60d", "customer_inactive_90d",
    "birthday", "custom",
  ]),
  channel: z.enum(["whatsapp", "email", "sms", "in_app"]),
  template_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  delay_minutes: z.number().int().min(0).default(0),
  max_per_day: z.number().int().positive().optional().nullable(),
});

export const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  campaign_type: z.enum(["reactivation", "promotion", "announcement", "survey", "seasonal", "custom"]),
  channel: z.enum(["whatsapp", "email", "sms"]),
  template_id: z.string().uuid().optional().nullable(),
  custom_body: z.string().max(5000).optional().nullable(),
  custom_subject: z.string().max(500).optional().nullable(),
  target_filter: z.record(z.any()).default({}),
  scheduled_at: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  channel: string;
  template_id: string | null;
  is_active: boolean;
  delay_minutes: number;
  max_per_day: number | null;
  last_triggered_at: string | null;
  trigger_count: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  channel: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  scheduled_at: string | null;
  created_at: string;
}

export interface NotificationLogEntry {
  id: string;
  channel: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  event_type: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface AutomationStats {
  today_notifications: number;
  today_sent: number;
  today_delivered: number;
  today_failed: number;
  pending_queue: number;
  active_rules_triggered: number;
  completed_campaigns: number;
  total_campaign_sends: number;
}