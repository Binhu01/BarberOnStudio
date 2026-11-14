import { z } from "zod";

// -----------------------------------------------------------------------------
// SCHEDULE BLOCKS
// -----------------------------------------------------------------------------

export const createScheduleBlockSchema = z.object({
  membership_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  reason: z.string().max(500).nullable().optional(),
  starts_at: z.string().min(1, "Data/hora início é obrigatória"),
  ends_at: z.string().min(1, "Data/hora fim é obrigatória"),
  is_recurring: z.boolean().optional().default(false),
  recurring_days: z.array(z.number().int().min(0).max(6)).optional(),
  recurring_until: z.string().nullable().optional(),
});

export const updateScheduleBlockSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  reason: z.string().max(500).nullable().optional(),
  starts_at: z.string().min(1).optional(),
  ends_at: z.string().min(1).optional(),
  is_recurring: z.boolean().optional(),
  recurring_days: z.array(z.number().int().min(0).max(6)).optional(),
  recurring_until: z.string().nullable().optional(),
});

// -----------------------------------------------------------------------------
// BARBERSHOP SETTINGS
// -----------------------------------------------------------------------------

export const updateBarbershopSettingsSchema = z.object({
  public_slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens").nullable().optional(),
  shop_name: z.string().min(1).max(200).optional(),
  shop_description: z.string().max(1000).nullable().optional(),
  shop_address: z.string().max(500).nullable().optional(),
  shop_phone: z.string().max(20).nullable().optional(),
  shop_logo_url: z.string().url().nullable().optional(),
  booking_enabled: z.boolean().optional(),
  advance_booking_days: z.number().int().min(1).max(365).optional(),
  min_advance_hours: z.number().int().min(0).max(168).optional(),
  auto_confirm: z.boolean().optional(),
  allow_barber_selection: z.boolean().optional(),
  whatsapp_reminder_hours: z.number().int().min(1).max(168).optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// -----------------------------------------------------------------------------
// PUBLIC BOOKING (sem auth — validação mais restrita)
// -----------------------------------------------------------------------------

export const createPublicBookingSchema = z.object({
  barber_service_id: z.string().uuid(),
  assigned_barber_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  customer_phone: z.string().min(10, "Telefone inválido").max(20),
  customer_email: z.string().email("E-mail inválido").nullable().optional(),
  scheduled_at: z.string().min(1, "Horário é obrigatório"),
  notes: z.string().max(500).nullable().optional(),
});

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

export type CreateScheduleBlockInput = z.infer<typeof createScheduleBlockSchema>;
export type UpdateScheduleBlockInput = z.infer<typeof updateScheduleBlockSchema>;
export type UpdateBarbershopSettingsInput = z.infer<typeof updateBarbershopSettingsSchema>;
export type CreatePublicBookingInput = z.infer<typeof createPublicBookingSchema>;