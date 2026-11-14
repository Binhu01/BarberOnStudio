import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export const createAppointmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  start_at: z.string().min(1), // ISO string
  end_at: z.string().min(1), // ISO string
  barber_service_id: z.string().uuid().optional().nullable(),
  assigned_barber_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  total_price: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
});

export const changeStatusSchema = z.object({
  event_id: z.string().uuid(),
  new_status: appointmentStatusSchema,
  reason: z.string().max(500).optional().nullable(),
});

export const rescheduleAppointmentSchema = z.object({
  event_id: z.string().uuid(),
  new_start_at: z.string().min(1),
  new_end_at: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export interface AppointmentWithDetails {
  event_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  origin: string;
  total_price: number | null;
  notes: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  barber_name: string | null;
  barber_avatar: string | null;
  service_name: string | null;
  service_duration: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  creator_name: string | null;
}

export interface AppointmentStatusHistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
  changed_by_name: string | null;
}