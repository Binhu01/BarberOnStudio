import { z } from "zod";

export const updateBarberProfileSchema = z.object({
  specialties: z.array(z.string().min(1)).optional(),
  commission_type: z.enum(["percentage", "fixed", "none"]).default("percentage"),
  commission_rate: z.coerce.number().min(0).max(100).default(0),
  bio: z.string().max(500).optional().nullable(),
  is_available_for_booking: z.boolean().default(true),
  job_title: z.string().max(100).optional().nullable(),
  professional_phone: z.string().max(20).optional().nullable(),
});

export type UpdateBarberProfileInput = z.infer<typeof updateBarberProfileSchema>;