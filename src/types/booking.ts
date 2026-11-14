// =============================================================================
// Barber-On Studio — Tipos para Bookings Públicos, Bloqueios e Configurações
// =============================================================================

// -----------------------------------------------------------------------------
// PUBLIC BOOKINGS
// -----------------------------------------------------------------------------

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface PublicBooking {
  id: string;
  organization_id: string;
  barber_service_id: string;
  assigned_barber_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: BookingStatus;
  notes: string | null;
  confirmation_token: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  service_name?: string | null;
  barber_name?: string | null;
}

export interface CreatePublicBookingInput {
  barber_service_id: string;
  assigned_barber_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  scheduled_at: string;
  notes?: string | null;
}

export interface AvailableSlot {
  slot_start: string;
  slot_end: string;
}

// -----------------------------------------------------------------------------
// SCHEDULE BLOCKS
// -----------------------------------------------------------------------------

export interface ScheduleBlock {
  id: string;
  organization_id: string;
  membership_id: string | null;
  title: string;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  is_recurring: boolean;
  recurring_days: number[] | null;
  recurring_until: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joins
  member_name?: string | null;
  created_by_name?: string | null;
}

export interface CreateScheduleBlockInput {
  membership_id?: string | null;
  title: string;
  reason?: string | null;
  starts_at: string;
  ends_at: string;
  is_recurring?: boolean;
  recurring_days?: number[];
  recurring_until?: string | null;
}

export interface UpdateScheduleBlockInput {
  title?: string;
  reason?: string | null;
  starts_at?: string;
  ends_at?: string;
  is_recurring?: boolean;
  recurring_days?: number[];
  recurring_until?: string | null;
}

// -----------------------------------------------------------------------------
// BARBERSHOP SETTINGS
// -----------------------------------------------------------------------------

export interface BarbershopSettings {
  id: string;
  organization_id: string;
  public_slug: string | null;
  shop_name: string;
  shop_description: string | null;
  shop_address: string | null;
  shop_phone: string | null;
  shop_logo_url: string | null;
  booking_enabled: boolean;
  advance_booking_days: number;
  min_advance_hours: number;
  auto_confirm: boolean;
  allow_barber_selection: boolean;
  whatsapp_reminder_hours: number;
  primary_color: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateBarbershopSettingsInput {
  public_slug?: string | null;
  shop_name?: string;
  shop_description?: string | null;
  shop_address?: string | null;
  shop_phone?: string | null;
  shop_logo_url?: string | null;
  booking_enabled?: boolean;
  advance_booking_days?: number;
  min_advance_hours?: number;
  auto_confirm?: boolean;
  allow_barber_selection?: boolean;
  whatsapp_reminder_hours?: number;
  primary_color?: string;
}