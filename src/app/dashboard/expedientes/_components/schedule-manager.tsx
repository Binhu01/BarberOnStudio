"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpsertBarberSchedules, deleteBarberSchedule } from "../actions";
import { DAYS_OF_WEEK } from "../schemas";
import type { BarberScheduleWithName } from "@/types/barber";
import { Save, Trash2, Clock, Coffee } from "lucide-react";

interface ScheduleManagerProps {
 membershipId: string;
 barberName: string;
 initialSchedules: BarberScheduleWithName[];
}

interface DaySchedule {
 day_of_week: number;
 start_time: string;
 end_time: string;
 lunch_start: string;
 lunch_end: string;
 is_working_day: boolean;
}

const DEFAULT_SCHEDULE: Omit<DaySchedule, "day_of_week"> = {
 start_time: "09:00",
 end_time: "18:00",
 lunch_start: "12:00",
 lunch_end: "13:00",
 is_working_day: true,
};

export function ScheduleManager({
 membershipId,
 barberName,
 initialSchedules,
}: ScheduleManagerProps) {
 const router = useRouter();
 const [isSaving, setIsSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 // Build schedule map from initial data
 const scheduleMap = new Map<number, DaySchedule>();
 for (const s of initialSchedules) {
 scheduleMap.set(s.day_of_week, {
 day_of_week: s.day_of_week,
 start_time: s.start_time?.slice(0, 5) ?? "09:00",
 end_time: s.end_time?.slice(0, 5) ?? "18:00",
 lunch_start: s.lunch_start?.slice(0, 5) ?? "",
 lunch_end: s.lunch_end?.slice(0, 5) ?? "",
 is_working_day: s.is_working_day,
 });
 }

 // Initialize all 7 days
 const [schedules, setSchedules] = useState<DaySchedule[]>(
 DAYS_OF_WEEK.map((day) => ({
 day_of_week: day.value,
 ...(scheduleMap.get(day.value) ?? { ...DEFAULT_SCHEDULE, is_working_day: day.value !== 0 }),
 }))
 );

 function updateDay(dayOfWeek: number, field: keyof DaySchedule, value: any) {
 setSchedules((prev) =>
 prev.map((s) => (s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s))
 );
 setSuccess(null);
 setError(null);
 }

 async function handleSave() {
 setIsSaving(true);
 setError(null);
 setSuccess(null);

 try {
 const workingDays = schedules.filter((s) => s.is_working_day);

 if (workingDays.length === 0) {
 setError("Configure pelo menos um dia de trabalho");
 setIsSaving(false);
 return;
 }

 await bulkUpsertBarberSchedules(membershipId, workingDays);

 // Remove non-working days that were previously configured
 const previousWorkingDays = initialSchedules
 .filter((s) => s.is_working_day)
 .map((s) => s.day_of_week);
 const currentWorkingDays = new Set(workingDays.map((s) => s.day_of_week));

 for (const day of previousWorkingDays) {
 if (!currentWorkingDays.has(day)) {
 await deleteBarberSchedule(membershipId, day);
 }
 }

 setSuccess("Expediente salvo com sucesso!");
 router.refresh();
 } catch (err) {
 setError(err instanceof Error ? err.message : "Erro ao salvar expediente");
 } finally {
 setIsSaving(false);
 }
 }

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between rounded-xl border border-barber-border bg-barber-graphite p-4">
 <div>
 <h2 className="font-display text-lg font-bold text-barber-white">{barberName}</h2>
 <p className="text-sm text-barber-muted">Configure os horários de trabalho semanais</p>
 </div>
 <button
 onClick={handleSave}
 disabled={isSaving}
 className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-dark transition-colors hover:bg-barber-copper disabled:opacity-50"
 >
 <Save className="h-4 w-4" />
 {isSaving ? "Salvando..." : "Salvar Expediente"}
 </button>
 </div>

 {/* Messages */}
 {error && (
 <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 px-4 py-3 text-sm text-barber-error">
 {error}
 </div>
 )}
 {success && (
 <div className="rounded-lg border border-barber-success/30 bg-barber-success/10 px-4 py-3 text-sm text-barber-success">
 {success}
 </div>
 )}

 {/* Days Grid */}
 <div className="space-y-2">
 {schedules.map((schedule) => {
 const dayLabel = DAYS_OF_WEEK.find((d) => d.value === schedule.day_of_week)?.label ?? "";

 return (
 <div
 key={schedule.day_of_week}
 className={`rounded-xl border p-4 transition-colors ${
 schedule.is_working_day
 ? "border-barber-border bg-barber-graphite"
 : "border-barber-border/50 bg-barber-dark/50 opacity-60"
 }`}
 >
 <div className="flex items-center justify-between">
 {/* Day toggle */}
 <label className="flex cursor-pointer items-center gap-3">
 <input
 type="checkbox"
 checked={schedule.is_working_day}
 onChange={(e) => updateDay(schedule.day_of_week, "is_working_day", e.target.checked)}
 className="h-4 w-4 rounded border-barber-border accent-barber-gold"
 />
 <span
 className={`text-sm font-medium ${
 schedule.is_working_day ? "text-barber-white" : "text-barber-muted"
 }`}
 >
 {dayLabel}
 </span>
 </label>

 {!schedule.is_working_day && (
 <span className="text-xs text-barber-muted">Folga</span>
 )}
 </div>

 {/* Time inputs (only when working) */}
 {schedule.is_working_day && (
 <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <div className="space-y-1">
 <label className="flex items-center gap-1 text-xs text-barber-muted">
 <Clock className="h-3 w-3" />
 Entrada
 </label>
 <input
 type="time"
 value={schedule.start_time}
 onChange={(e) => updateDay(schedule.day_of_week, "start_time", e.target.value)}
 className="w-full rounded border border-barber-border bg-barber-dark px-2 py-1.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>

 <div className="space-y-1">
 <label className="flex items-center gap-1 text-xs text-barber-muted">
 <Clock className="h-3 w-3" />
 Saída
 </label>
 <input
 type="time"
 value={schedule.end_time}
 onChange={(e) => updateDay(schedule.day_of_week, "end_time", e.target.value)}
 className="w-full rounded border border-barber-border bg-barber-dark px-2 py-1.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>

 <div className="space-y-1">
 <label className="flex items-center gap-1 text-xs text-barber-muted">
 <Coffee className="h-3 w-3" />
 Almoço início
 </label>
 <input
 type="time"
 value={schedule.lunch_start}
 onChange={(e) => updateDay(schedule.day_of_week, "lunch_start", e.target.value)}
 className="w-full rounded border border-barber-border bg-barber-dark px-2 py-1.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>

 <div className="space-y-1">
 <label className="flex items-center gap-1 text-xs text-barber-muted">
 <Coffee className="h-3 w-3" />
 Almoço fim
 </label>
 <input
 type="time"
 value={schedule.lunch_end}
 onChange={(e) => updateDay(schedule.day_of_week, "lunch_end", e.target.value)}
 className="w-full rounded border border-barber-border bg-barber-dark px-2 py-1.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none"
 />
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
}