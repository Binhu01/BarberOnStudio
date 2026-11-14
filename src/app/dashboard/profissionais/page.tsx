import { getBarbers, getBarberStats } from "./actions";
import Link from "next/link";
import { UserCog, Users, TrendingUp, DollarSign, Scissors } from "lucide-react";

export default async function ProfissionaisPage() {
 const [barbers, stats] = await Promise.all([
 getBarbers(),
 getBarberStats(),
 ]);

 const formatCurrency = (value: number) =>
 new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="font-display text-2xl font-bold text-barber-white">Profissionais</h1>
 <p className="mt-1 text-sm text-barber-muted">
 Gerencie a equipe de barbeiros e suas configurações
 </p>
 </div>
 </div>

 {/* Stats Cards */}
 <div className="grid gap-4 sm:grid-cols-3">
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-gold/10 text-barber-gold">
 <Users className="h-5 w-5" />
 </div>
 <div>
 <p className="text-sm text-barber-muted">Total de Profissionais</p>
 <p className="text-xl font-bold text-barber-white">{stats.total}</p>
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-success/10 text-barber-success">
 <TrendingUp className="h-5 w-5" />
 </div>
 <div>
 <p className="text-sm text-barber-muted">Disponíveis para Agenda</p>
 <p className="text-xl font-bold text-barber-white">{stats.active}</p>
 </div>
 </div>
 </div>

 <div className="rounded-xl border border-barber-border bg-barber-graphite p-5">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-barber-copper/10 text-barber-copper">
 <DollarSign className="h-5 w-5" />
 </div>
 <div>
 <p className="text-sm text-barber-muted">Comissão Média</p>
 <p className="text-xl font-bold text-barber-white">
 {stats.avg_commission > 0 ? `${stats.avg_commission.toFixed(1)}%` : "—"}
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Barbers Grid */}
 {barbers.length === 0 ? (
 <div className="rounded-xl border border-barber-border bg-barber-graphite p-12 text-center">
 <UserCog className="mx-auto mb-3 h-10 w-10 text-barber-muted opacity-50" />
 <p className="text-barber-muted">Nenhum profissional cadastrado na equipe</p>
 <p className="mt-2 text-sm text-barber-muted">
 Adicione membros à equipe em{" "}
 <Link href="/dashboard/equipe/funcionarios" className="text-barber-gold hover:text-barber-copper">
 Equipe → Funcionários
 </Link>{" "}
 e configure seus perfis aqui.
 </p>
 </div>
 ) : (
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {barbers.map((barber) => (
 <div
 key={barber.id}
 className="group rounded-xl border border-barber-border bg-barber-graphite p-5 transition-colors hover:border-barber-gold/30"
 >
 <div className="flex items-start gap-4">
 {/* Avatar */}
 <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-barber-gold/10 text-lg font-bold text-barber-gold">
 {barber.avatar_url ? (
 <img
 src={barber.avatar_url}
 alt={barber.full_name}
 className="h-14 w-14 rounded-full object-cover"
 />
 ) : (
 barber.full_name.charAt(0).toUpperCase()
 )}
 </div>

 {/* Info */}
 <div className="min-w-0 flex-1">
 <h3 className="truncate font-medium text-barber-white">{barber.full_name}</h3>
 <p className="truncate text-xs text-barber-muted">{barber.job_title ?? "Barbeiro"}</p>

 <div className="mt-3 flex flex-wrap gap-2">
 {/* Status */}
 <span
 className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
 barber.is_available_for_booking
 ? "bg-barber-success/10 text-barber-success"
 : "bg-barber-muted/10 text-barber-muted"
 }`}
 >
 {barber.is_available_for_booking ? "Disponível" : "Indisponível"}
 </span>

 {/* Comissão */}
 {barber.commission_rate > 0 && (
 <span className="inline-flex rounded-full bg-barber-gold/10 px-2 py-0.5 text-[10px] font-medium text-barber-gold">
 {barber.commission_type === "percentage"
 ? `${barber.commission_rate}%`
 : formatCurrency(barber.commission_rate)}
 </span>
 )}
 </div>

 {/* Especialidades */}
 {barber.specialties && barber.specialties.length > 0 && (
 <div className="mt-3 flex flex-wrap gap-1">
 {barber.specialties.slice(0, 3).map((spec) => (
 <span
 key={spec}
 className="inline-flex items-center gap-1 rounded bg-barber-dark px-1.5 py-0.5 text-[10px] text-barber-light"
 >
 <Scissors className="h-2.5 w-2.5" />
 {spec}
 </span>
 ))}
 {barber.specialties.length > 3 && (
 <span className="text-[10px] text-barber-muted">
 +{barber.specialties.length - 3}
 </span>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Bio preview */}
 {barber.bio && (
 <p className="mt-3 line-clamp-2 text-xs text-barber-muted">{barber.bio}</p>
 )}

 {/* Actions */}
 <div className="mt-4 flex items-center gap-2 border-t border-barber-border pt-3">
 <Link
 href={`/dashboard/profissionais/${barber.id}`}
 className="text-xs font-medium text-barber-gold hover:text-barber-copper"
 >
 Editar perfil
 </Link>
 <span className="text-barber-border">|</span>
 <Link
 href={`/dashboard/expedientes?barber=${barber.membership_id}`}
 className="text-xs font-medium text-barber-muted hover:text-barber-white"
 >
 Expediente
 </Link>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}