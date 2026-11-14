import { z } from "zod";

export const createBarberServiceSchema = z.object({
  name: z.string().min(2, "Nome do serviço é obrigatório").max(100),
  description: z.string().max(500).optional(),
  category_id: z.string().uuid().optional(),
  duration_minutes: z.coerce.number().int().positive("Duração deve ser maior que zero"),
  buffer_minutes: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().min(0, "Preço não pode ser negativo"),
  commission_type: z.enum(["percentage", "fixed", "none"]).default("percentage"),
  commission_value: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
  display_order: z.coerce.number().int().min(0).default(0),
});

export const updateBarberServiceSchema = createBarberServiceSchema.partial();

export type CreateBarberServiceInput = z.infer<typeof createBarberServiceSchema>;
export type UpdateBarberServiceInput = z.infer<typeof updateBarberServiceSchema>;

// Validação específica para comissão percentual (0-100)
export function validateCommission(type: string, value: number): boolean {
  if (type === "percentage") {
    return value >= 0 && value <= 100;
  }
  return value >= 0;
}