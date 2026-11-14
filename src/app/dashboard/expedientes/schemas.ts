import { z } from "zod";

export const upsertBarberScheduleSchema = z.object({
 membership_id: z.string().uuid(),
 day_of_week: z.coerce.number().int().min(0).max(6),
 start_time: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
 end_time: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
 lunch_start: z
 .string()
 .regex(/^\d{2}:\d{2}$/, "Formato HH:MM")
 .optional()
 .nullable(),
 lunch_end: z
 .string()
 .regex(/^\d{2}:\d{2}$/, "Formato HH:MM")
 .optional()
 .nullable(),
 is_working_day: z.boolean().default(true),
});

export const bulkUpsertBarberScheduleSchema = z.object({
 membership_id: z.string().uuid(),
 schedules: z.array(upsertBarberScheduleSchema.omit({ membership_id: true })),
});

export type UpsertBarberScheduleInput = z.infer<typeof upsertBarberScheduleSchema>;
export type BulkUpsertBarberScheduleInput = z.infer<
 typeof bulkUpsertBarberScheduleSchema
>;

// Nomes dos dias da semana em português
export const DAYS_OF_WEEK = [
 { value: 0, label: "Domingo" },
 { value: 1, label: "Segunda-feira" },
 { value: 2, label: "Terça-feira" },
 { value: 3, label: "Quarta-feira" },
 { value: 4, label: "Quinta-feira" },
 { value: 5, label: "Sexta-feira" },
 { value: 6, label: "Sábado" },
] as const;