import { getBarbershopBySlug, getPublicServices, getPublicBarbers } from "@/app/dashboard/bloqueios/public-booking-actions";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingForm } from "./_components/booking-form";

// This page is fully dynamic (depends on barbershop slug + DB data)

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const settings = await getBarbershopBySlug(slug);

  if (!settings) {
    return { title: "Agendamento não encontrado" };
  }

  return {
    title: `Agendar — ${settings.shop_name}`,
    description:
      settings.shop_description ??
      `Agende seu horário na ${settings.shop_name}. Rápido, fácil e sem cadastro.`,
    openGraph: {
      title: `Agendar — ${settings.shop_name}`,
      description:
        settings.shop_description ??
        `Agende seu horário na ${settings.shop_name}.`,
      images: settings.shop_logo_url ? [settings.shop_logo_url] : [],
    },
  };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  const settings = await getBarbershopBySlug(slug);

  if (!settings || !settings.booking_enabled) {
    notFound();
  }

  const [services, barbers] = await Promise.all([
    getPublicServices(settings.organization_id),
    settings.allow_barber_selection
      ? getPublicBarbers(settings.organization_id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-barber-dark">
      {/* Header */}
      <header className="border-b border-barber-border bg-barber-graphite px-6 py-5">
        <div className="mx-auto max-w-2xl text-center">
          {settings.shop_logo_url && (
            <img
              src={settings.shop_logo_url}
              alt={settings.shop_name}
              className="mx-auto mb-3 h-16 w-16 rounded-full object-cover"
            />
          )}
          <h1 className="font-display text-2xl font-bold text-barber-white">
            {settings.shop_name}
          </h1>
          {settings.shop_description && (
            <p className="mt-1 text-sm text-barber-muted">
              {settings.shop_description}
            </p>
          )}
          {settings.shop_address && (
            <p className="mt-1 text-xs text-barber-muted">
              📍 {settings.shop_address}
            </p>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BookingForm
          orgId={settings.organization_id}
          services={services}
          barbers={barbers}
          allowBarberSelection={settings.allow_barber_selection}
          minAdvanceHours={settings.min_advance_hours}
          advanceBookingDays={settings.advance_booking_days}
          primaryColor={settings.primary_color}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-barber-border px-6 py-6 text-center">
        <p className="text-xs text-barber-muted">
          Agendamento via Barber-On Studio ·{" "}
          <a href="/" className="hover:text-barber-gold">
            barberon.com.br
          </a>
        </p>
      </footer>
    </div>
  );
}