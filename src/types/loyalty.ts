// =============================================================================
// Barber-On Studio — Tipos para Fidelidade e Reativação
// =============================================================================

// -----------------------------------------------------------------------------
// LOYALTY PROGRAMS
// -----------------------------------------------------------------------------

export type RewardType = "discount" | "free_service" | "product" | "cashback";

export interface LoyaltyProgram {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  points_per_real: number;
  points_per_visit: number;
  redemption_threshold: number;
  reward_type: RewardType;
  reward_value: number;
  reward_service_id: string | null;
  expiry_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLoyaltyProgramInput {
  name: string;
  description?: string | null;
  points_per_real?: number;
  points_per_visit?: number;
  redemption_threshold?: number;
  reward_type?: RewardType;
  reward_value?: number;
  reward_service_id?: string | null;
  expiry_days?: number | null;
  is_active?: boolean;
}

export interface UpdateLoyaltyProgramInput {
  name?: string;
  description?: string | null;
  points_per_real?: number;
  points_per_visit?: number;
  redemption_threshold?: number;
  reward_type?: RewardType;
  reward_value?: number;
  reward_service_id?: string | null;
  expiry_days?: number | null;
  is_active?: boolean;
}

// -----------------------------------------------------------------------------
// LOYALTY CARDS
// -----------------------------------------------------------------------------

export type CardStatus = "active" | "inactive" | "expired" | "blocked";

export interface LoyaltyCard {
  id: string;
  organization_id: string;
  customer_profile_id: string;
  loyalty_program_id: string;
  current_points: number;
  lifetime_points: number;
  total_visits: number;
  last_visit_at: string | null;
  card_status: CardStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  customer_name?: string | null;
  program_name?: string | null;
  redemption_threshold?: number | null;
}

export interface CreateLoyaltyCardInput {
  customer_profile_id: string;
  loyalty_program_id: string;
  notes?: string | null;
}

// -----------------------------------------------------------------------------
// LOYALTY TRANSACTIONS
// -----------------------------------------------------------------------------

export type LoyaltyTransactionType =
  | "earn_purchase"
  | "earn_visit"
  | "earn_bonus"
  | "redeem"
  | "expire"
  | "adjustment";

export interface LoyaltyTransaction {
  id: string;
  organization_id: string;
  loyalty_card_id: string;
  transaction_type: LoyaltyTransactionType;
  points_change: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  // Joins
  created_by_name?: string | null;
}

// -----------------------------------------------------------------------------
// REACTIVATION CAMPAIGNS
// -----------------------------------------------------------------------------

export type CampaignType =
  | "inactive_clients"
  | "birthday"
  | "custom_segment"
  | "win_back";

export type CampaignChannel = "whatsapp" | "sms" | "email" | "push";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "cancelled";

export interface ReactivationCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  inactive_days_threshold: number;
  target_count: number | null;
  sent_count: number;
  response_count: number;
  conversion_count: number;
  message_template: string;
  channel: CampaignChannel;
  scheduled_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  status: CampaignStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReactivationCampaignInput {
  name: string;
  description?: string | null;
  campaign_type?: CampaignType;
  inactive_days_threshold?: number;
  message_template: string;
  channel?: CampaignChannel;
  scheduled_at?: string | null;
}

export interface UpdateReactivationCampaignInput {
  name?: string;
  description?: string | null;
  campaign_type?: CampaignType;
  inactive_days_threshold?: number;
  message_template?: string;
  channel?: CampaignChannel;
  scheduled_at?: string | null;
  status?: CampaignStatus;
}

// -----------------------------------------------------------------------------
// REACTIVATION RECIPIENTS
// -----------------------------------------------------------------------------

export type RecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "responded"
  | "converted"
  | "failed";

export interface ReactivationRecipient {
  id: string;
  campaign_id: string;
  customer_profile_id: string;
  phone: string | null;
  email: string | null;
  last_visit_at: string | null;
  days_inactive: number | null;
  status: RecipientStatus;
  sent_at: string | null;
  responded_at: string | null;
  converted_at: string | null;
  error_message: string | null;
  created_at: string;
  // Joins
  customer_name?: string | null;
}

// -----------------------------------------------------------------------------
// INACTIVE CUSTOMER (from RPC)
// -----------------------------------------------------------------------------

export interface InactiveCustomer {
  customer_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  last_visit_at: string | null;
  days_inactive: number;
  total_visits: number;
  total_spent: number;
}

// -----------------------------------------------------------------------------
// POINTS ADJUSTMENT INPUTS
// -----------------------------------------------------------------------------

export interface AddPointsInput {
  card_id: string;
  points: number;
  description?: string;
  reference_type?: "manual" | "bonus" | "campaign";
}

export interface RedeemPointsInput {
  card_id: string;
  points: number;
  description?: string;
}

// -----------------------------------------------------------------------------
// SUMMARY / STATS
// -----------------------------------------------------------------------------

export interface LoyaltySummary {
  total_programs: number;
  active_cards: number;
  total_points_issued: number;
  avg_points_per_card: number;
  redemptions_this_month: number;
}