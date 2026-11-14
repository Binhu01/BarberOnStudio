// =============================================================================
// Barber-On Studio — Tipos TypeScript para módulos de barbearia
// =============================================================================

// -----------------------------------------------------------------------------
// Barber Services
// -----------------------------------------------------------------------------
export type CommissionType = "percentage" | "fixed" | "none";

export interface BarberService {
 id: string;
 organization_id: string;
 category_id: string | null;
 name: string;
 description: string | null;
 duration_minutes: number;
 buffer_minutes: number;
 price: number;
 commission_type: CommissionType;
 commission_value: number;
 is_active: boolean;
 display_order: number;
 created_at: string;
 updated_at: string;
}

export interface BarberServiceWithCategory extends BarberService {
 category_name: string | null;
}

export interface CreateBarberServiceInput {
 name: string;
 description?: string;
 category_id?: string;
 duration_minutes: number;
 buffer_minutes?: number;
 price: number;
 commission_type?: CommissionType;
 commission_value?: number;
 is_active?: boolean;
 display_order?: number;
}

export interface UpdateBarberServiceInput {
 name?: string;
 description?: string | null;
 category_id?: string | null;
 duration_minutes?: number;
 buffer_minutes?: number;
 price?: number;
 commission_type?: CommissionType;
 commission_value?: number;
 is_active?: boolean;
 display_order?: number;
}

// -----------------------------------------------------------------------------
// Barber Schedules
// -----------------------------------------------------------------------------
export interface BarberSchedule {
 id: string;
 organization_id: string;
 membership_id: string;
 day_of_week: number; // 0 = Sunday, 6 = Saturday
 start_time: string;
 end_time: string;
 lunch_start: string | null;
 lunch_end: string | null;
 is_working_day: boolean;
 created_at: string;
 updated_at: string;
}

export interface BarberScheduleWithName extends BarberSchedule {
 member_name: string;
}

export interface UpsertBarberScheduleInput {
 membership_id: string;
 day_of_week: number;
 start_time: string;
 end_time: string;
 lunch_start?: string | null;
 lunch_end?: string | null;
 is_working_day?: boolean;
}

// -----------------------------------------------------------------------------
// Schedule Blocks
// -----------------------------------------------------------------------------
export type BlockType =
 | "holiday"
 | "day_off"
 | "vacation"
 | "personal"
 | "maintenance"
 | "other";

export interface ScheduleBlock {
 id: string;
 organization_id: string;
 membership_id: string | null;
 block_type: BlockType;
 title: string;
 description: string | null;
 start_at: string;
 end_at: string;
 is_recurring: boolean;
 recurrence_rule: string | null;
 created_at: string;
 updated_at: string;
}

export interface ScheduleBlockWithName extends ScheduleBlock {
 member_name: string | null;
}

export interface CreateScheduleBlockInput {
 membership_id?: string;
 block_type: BlockType;
 title: string;
 description?: string;
 start_at: string;
 end_at: string;
 is_recurring?: boolean;
 recurrence_rule?: string;
}

export interface UpdateScheduleBlockInput {
 membership_id?: string | null;
 block_type?: BlockType;
 title?: string;
 description?: string | null;
 start_at?: string;
 end_at?: string;
 is_recurring?: boolean;
 recurrence_rule?: string | null;
}

// -----------------------------------------------------------------------------
// Employee Profile Extensions (Barber-specific fields)
// -----------------------------------------------------------------------------
export interface BarberProfile {
 id: string;
 organization_id: string;
 membership_id: string;
 department_id: string | null;
 job_title: string | null;
 professional_phone: string | null;
 start_date: string | null;
 notes: string | null;
 specialties: string[] | null;
 commission_type: CommissionType;
 commission_rate: number;
 bio: string | null;
 is_available_for_booking: boolean;
 created_at: string;
 updated_at: string;
}

export interface BarberProfileWithUser extends BarberProfile {
 full_name: string;
 email: string;
 avatar_url: string | null;
 role: string;
}

export interface UpdateBarberProfileInput {
 specialties?: string[];
 commission_type?: CommissionType;
 commission_rate?: number;
 bio?: string | null;
 is_available_for_booking?: boolean;
 job_title?: string | null;
 professional_phone?: string | null;
}

// -----------------------------------------------------------------------------
// Calendar Event Extensions (Appointment-specific fields)
// -----------------------------------------------------------------------------
export type AppointmentStatus =
 | "scheduled"
 | "confirmed"
 | "arrived"
 | "in_progress"
 | "completed"
 | "cancelled"
 | "no_show";

export interface Appointment {
 id: string;
 organization_id: string;
 title: string;
 description: string | null;
 start_at: string;
 end_at: string;
 all_day: boolean;
 location: string | null;
 barber_service_id: string | null;
 assigned_barber_id: string | null;
 customer_id: string | null;
 status: AppointmentStatus;
 total_price: number;
 notes: string | null;
 created_by: string;
 color: string | null;
 created_at: string;
 updated_at: string;
}

export interface AppointmentWithDetails extends Appointment {
 service_name: string | null;
 service_duration: number | null;
 barber_name: string | null;
 customer_name: string | null;
 customer_phone: string | null;
}

// -----------------------------------------------------------------------------
// Available Slots
// -----------------------------------------------------------------------------
export interface AvailableSlot {
 start_time: string;
 end_time: string;
}

// -----------------------------------------------------------------------------
// Dashboard Stats
// -----------------------------------------------------------------------------
export interface BarberDashboardStats {
 today_revenue: number;
 month_revenue: number;
 today_appointments: number;
 upcoming_appointments: number;
 active_clients: number;
 active_subscriptions: number;
 expiring_subscriptions: number;
 pending_payables: number;
 top_services: Array<{ name: string; count: number; revenue: number }>;
 barber_performance: Array<{
 name: string;
 appointments: number;
 revenue: number;
 commission: number;
 }>;
}