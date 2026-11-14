import { z } from "zod";

// -----------------------------------------------------------------------------
// SUBSCRIPTION PLANS
// -----------------------------------------------------------------------------

export const createSubscriptionPlanSchema = z.object({
 name: z.string().min(1, "Nome é obrigatório").max(200),
 description: z.string().max(1000).nullable().optional(),
 price: z.number().min(0, "Preço não pode ser negativo"),
 billing_cycle: z.enum(["monthly", "quarterly", "annual"]).optional().default("monthly"),
 trial_days: z.number().int().min(0).max(365).optional().default(0),
 max_services_per_month: z.number().int().positive().nullable().optional(),
 included_services: z.array(z.string().uuid()).optional().default([]),
 discount_percentage: z.number().min(0).max(100).optional().default(0),
 priority_booking: z.boolean().optional().default(false),
 is_active: z.boolean().optional().default(true),
 display_order: z.number().int().min(0).optional().default(0),
});

export const updateSubscriptionPlanSchema = z.object({
 name: z.string().min(1).max(200).optional(),
 description: z.string().max(1000).nullable().optional(),
 price: z.number().min(0).optional(),
 billing_cycle: z.enum(["monthly", "quarterly", "annual"]).optional(),
 trial_days: z.number().int().min(0).max(365).optional(),
 max_services_per_month: z.number().int().positive().nullable().optional(),
 included_services: z.array(z.string().uuid()).optional(),
 discount_percentage: z.number().min(0).max(100).optional(),
 priority_booking: z.boolean().optional(),
 is_active: z.boolean().optional(),
 display_order: z.number().int().min(0).optional(),
});

// -----------------------------------------------------------------------------
// CLIENT SUBSCRIPTIONS
// -----------------------------------------------------------------------------

export const createClientSubscriptionSchema = z.object({
 customer_profile_id: z.string().uuid(),
 subscription_plan_id: z.string().uuid(),
 payment_method: z.enum(["cash", "pix", "debit", "credit", "other"]).nullable().optional(),
 auto_renew: z.boolean().optional().default(true),
 notes: z.string().max(500).nullable().optional(),
 start_date: z.string().optional(),
});

export const updateClientSubscriptionSchema = z.object({
 status: z.enum(["active", "paused", "cancelled", "expired", "trial"]).optional(),
 auto_renew: z.boolean().optional(),
 payment_method: z.enum(["cash", "pix", "debit", "credit", "other"]).nullable().optional(),
 cancellation_reason: z.string().max(500).nullable().optional(),
 notes: z.string().max(500).nullable().optional(),
});

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;
export type CreateClientSubscriptionInput = z.infer<typeof createClientSubscriptionSchema>;
export type UpdateClientSubscriptionInput = z.infer<typeof updateClientSubscriptionSchema>;