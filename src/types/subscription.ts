// =============================================================================
// Barber-On Studio — Tipos para Assinaturas e Recorrências
// =============================================================================

// -----------------------------------------------------------------------------
// SUBSCRIPTION PLANS
// -----------------------------------------------------------------------------

export type BillingCycle = "monthly" | "quarterly" | "annual";

export interface SubscriptionPlan {
 id: string;
 organization_id: string;
 name: string;
 description: string | null;
 price: number;
 billing_cycle: BillingCycle;
 trial_days: number;
 max_services_per_month: number | null;
 included_services: string[];
 discount_percentage: number;
 priority_booking: boolean;
 is_active: boolean;
 display_order: number;
 created_at: string;
 updated_at: string;
}

export interface CreateSubscriptionPlanInput {
 name: string;
 description?: string | null;
 price: number;
 billing_cycle?: BillingCycle;
 trial_days?: number;
 max_services_per_month?: number | null;
 included_services?: string[];
 discount_percentage?: number;
 priority_booking?: boolean;
 is_active?: boolean;
 display_order?: number;
}

export interface UpdateSubscriptionPlanInput {
 name?: string;
 description?: string | null;
 price?: number;
 billing_cycle?: BillingCycle;
 trial_days?: number;
 max_services_per_month?: number | null;
 included_services?: string[];
 discount_percentage?: number;
 priority_booking?: boolean;
 is_active?: boolean;
 display_order?: number;
}

// -----------------------------------------------------------------------------
// CLIENT SUBSCRIPTIONS
// -----------------------------------------------------------------------------

export type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired" | "trial";

export interface ClientSubscription {
 id: string;
 organization_id: string;
 customer_profile_id: string;
 subscription_plan_id: string;
 status: SubscriptionStatus;
 current_period_start: string;
 current_period_end: string;
 services_used_this_period: number;
 auto_renew: boolean;
 payment_method: string | null;
 last_payment_at: string | null;
 next_billing_date: string | null;
 cancelled_at: string | null;
 cancellation_reason: string | null;
 notes: string | null;
 created_at: string;
 updated_at: string;
 // Joins
 customer_name?: string | null;
 plan_name?: string | null;
 plan_price?: number | null;
 plan_billing_cycle?: BillingCycle | null;
 plan_max_services?: number | null;
}

export interface CreateClientSubscriptionInput {
 customer_profile_id: string;
 subscription_plan_id: string;
 payment_method?: string | null;
 auto_renew?: boolean;
 notes?: string | null;
 start_date?: string;
}

export interface UpdateClientSubscriptionInput {
 status?: SubscriptionStatus;
 auto_renew?: boolean;
 payment_method?: string | null;
 cancellation_reason?: string | null;
 notes?: string | null;
}

// -----------------------------------------------------------------------------
// SUBSCRIPTION HISTORY
// -----------------------------------------------------------------------------

export type SubscriptionEventType =
 | "created"
 | "renewed"
 | "paused"
 | "resumed"
 | "cancelled"
 | "payment_received"
 | "service_used"
 | "plan_changed";

export interface SubscriptionHistoryEntry {
 id: string;
 organization_id: string;
 client_subscription_id: string;
 event_type: SubscriptionEventType;
 amount: number | null;
 payment_method: string | null;
 period_start: string | null;
 period_end: string | null;
 services_count: number | null;
 notes: string | null;
 created_by: string | null;
 created_at: string;
 // Joins
 created_by_name?: string | null;
}

// -----------------------------------------------------------------------------
// SUMMARY / STATS
// -----------------------------------------------------------------------------

export interface SubscriptionSummary {
 total_active: number;
 total_paused: number;
 total_cancelled: number;
 monthly_revenue: number;
 upcoming_renewals_7d: number;
 avg_services_used: number;
}

export interface RenewalResult {
 renewed_count: number;
 expired_count: number;
}