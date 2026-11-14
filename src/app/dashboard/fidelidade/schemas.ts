import { z } from "zod";

// -----------------------------------------------------------------------------
// LOYALTY PROGRAMS
// -----------------------------------------------------------------------------

export const createLoyaltyProgramSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).nullable().optional(),
  points_per_real: z.number().min(0.01, "Mínimo 0.01").optional().default(1),
  points_per_visit: z.number().int().min(0).optional().default(0),
  redemption_threshold: z.number().int().positive("Deve ser maior que zero").optional().default(100),
  reward_type: z.enum(["discount", "free_service", "product", "cashback"]).optional().default("discount"),
  reward_value: z.number().min(0).optional().default(0),
  reward_service_id: z.string().uuid().nullable().optional(),
  expiry_days: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateLoyaltyProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  points_per_real: z.number().min(0.01).optional(),
  points_per_visit: z.number().int().min(0).optional(),
  redemption_threshold: z.number().int().positive().optional(),
  reward_type: z.enum(["discount", "free_service", "product", "cashback"]).optional(),
  reward_value: z.number().min(0).optional(),
  reward_service_id: z.string().uuid().nullable().optional(),
  expiry_days: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

// -----------------------------------------------------------------------------
// LOYALTY CARDS
// -----------------------------------------------------------------------------

export const createLoyaltyCardSchema = z.object({
  customer_profile_id: z.string().uuid(),
  loyalty_program_id: z.string().uuid(),
  notes: z.string().max(500).nullable().optional(),
});

// -----------------------------------------------------------------------------
// LOYALTY TRANSACTIONS (manual adjustments)
// -----------------------------------------------------------------------------

export const addPointsSchema = z.object({
  card_id: z.string().uuid(),
  points: z.number().int().positive("Pontos devem ser positivos"),
  description: z.string().max(500).optional(),
  reference_type: z.enum(["manual", "bonus", "campaign"]).optional().default("manual"),
});

export const redeemPointsSchema = z.object({
  card_id: z.string().uuid(),
  points: z.number().int().positive("Pontos devem ser positivos"),
  description: z.string().max(500).optional(),
});

// -----------------------------------------------------------------------------
// REACTIVATION CAMPAIGNS
// -----------------------------------------------------------------------------

export const createReactivationCampaignSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).nullable().optional(),
  campaign_type: z.enum(["inactive_clients", "birthday", "custom_segment", "win_back"]).optional().default("inactive_clients"),
  inactive_days_threshold: z.number().int().positive().optional().default(30),
  message_template: z.string().min(1, "Mensagem é obrigatória").max(2000),
  channel: z.enum(["whatsapp", "sms", "email", "push"]).optional().default("whatsapp"),
  scheduled_at: z.string().nullable().optional(),
});

export const updateReactivationCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  campaign_type: z.enum(["inactive_clients", "birthday", "custom_segment", "win_back"]).optional(),
  inactive_days_threshold: z.number().int().positive().optional(),
  message_template: z.string().min(1).max(2000).optional(),
  channel: z.enum(["whatsapp", "sms", "email", "push"]).optional(),
  scheduled_at: z.string().nullable().optional(),
  status: z.enum(["draft", "scheduled", "sending", "completed", "cancelled"]).optional(),
});

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

export type CreateLoyaltyProgramInput = z.infer<typeof createLoyaltyProgramSchema>;
export type UpdateLoyaltyProgramInput = z.infer<typeof updateLoyaltyProgramSchema>;
export type CreateLoyaltyCardInput = z.infer<typeof createLoyaltyCardSchema>;
export type AddPointsInput = z.infer<typeof addPointsSchema>;
export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;
export type CreateReactivationCampaignInput = z.infer<typeof createReactivationCampaignSchema>;
export type UpdateReactivationCampaignInput = z.infer<typeof updateReactivationCampaignSchema>;