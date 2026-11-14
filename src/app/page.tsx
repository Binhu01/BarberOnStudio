// This page uses dynamic server data
export const instant = false;

import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Scissors,
  CalendarDays,
  MapPin,
  Instagram,
  Box,
  ChevronRight,
  Star,
  ShieldCheck,
  Gem,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { LandingBookingWidget } from "./_components/landing-booking-widget";
import { getLandingData } from "./actions";

export const metadata: Metadata = {
  title: "Barber On Studio | Estilo, Confiança e Atitude",
  description:
    "Na Barber On Studio, cuidamos do seu visual com excelência, em um ambiente moderno e feito para você se sentir bem. Agende online.",
  openGraph: {
    title: "Barber On Studio | Estilo, Confiança e Atitude",
    description:
      "Agende seu horário online. Profissionais especializados, qualidade em cada detalhe e experiência única.",
    type: "website",
  },
};

export default async function HomePage() {
  const data = await getLandingData();

  return (
    <div className="min-h-screen bg-bo-black text-bo-white font-sans selection:bg-bo-blue/30">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-bo-border/50 bg-bo-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/logo-bo.svg"
              alt="Barber On Studio"
              width={120}
              height={36}
              className="h-9 w-auto transition-opacity group-hover:opacity-90"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {[
              { label: "Início", href: "#inicio", icon: null },
              { label: "Barbeiros", href: "#barbeiros", icon: null },
              { label: "Agendar", href: "#agendar", icon: null },
              { label: "Produtos", href: "#produtos", icon: null },
              { label: "Localização", href: "#localizacao", icon: null },
              { label: "Instagram", href: "#instagram", icon: null },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-bo-gray transition-colors hover:text-bo-blue-bright"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:block">
            <a
              href="#agendar"
              className="inline-flex items-center gap-2 rounded-full bg-bo-blue px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-bo-blue-bright hover:shadow-[0_0_20px_rgba(8,102,232,0.3)]"
            >
              Agendar Agora
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* Mobile menu button */}
          <button className="rounded-lg p-2 text-bo-gray hover:bg-bo-graphite lg:hidden">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* HERO SECTION */}
      {/* ================================================================== */}
      <section
        id="inicio"
        className="relative flex min-h-screen items-center overflow-hidden pt-20"
      >
        {/* Background gradient effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(8,102,232,0.15)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(22,132,255,0.08)_0%,_transparent_50%)]" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:gap-20">
          {/* Left content */}
          <div className="flex flex-col justify-center space-y-8">
            <h1 className="font-display text-5xl font-bold italic leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              ESTILO,{" "}
              <span className="text-bo-blue-bright">CONFIANÇA</span>
              <br />E ATITUDE EM UM
              <br />
              SÓ LUGAR.
            </h1>

            <p className="max-w-lg text-lg leading-relaxed text-bo-gray">
              Na Barber On Studio, cuidamos do seu visual com excelência, em um
              ambiente moderno e feito para você se sentir bem.
            </p>

            <div>
              <a
                href="#agendar"
                className="inline-flex items-center gap-3 rounded-full bg-bo-blue px-8 py-4 text-base font-semibold text-white transition-all hover:bg-bo-blue-bright hover:shadow-[0_0_30px_rgba(8,102,232,0.4)]"
              >
                Agendar seu horário
                <ChevronRight className="h-5 w-5" />
              </a>
            </div>

            {/* Differentials */}
            <div className="flex flex-wrap gap-8 pt-4">
              {[
                { icon: Gem, label: "Qualidade", sub: "em cada detalhe" },
                { icon: ShieldCheck, label: "Profissionais", sub: "especializados" },
                { icon: Star, label: "Experiência", sub: "única" },
              ].map((diff) => (
                <div key={diff.label} className="flex items-start gap-3">
                  <diff.icon className="mt-1 h-5 w-5 text-bo-silver" />
                  <div>
                    <p className="text-sm font-semibold text-bo-white">
                      {diff.label}
                    </p>
                    <p className="text-xs text-bo-gray">{diff.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Logo showcase */}
          <div className="relative flex items-center justify-center">
            <div className="relative z-10">
              <Image
                src="/logo-bo.svg"
                alt="Barber On Studio Logo"
                width={500}
                height={150}
                className="w-full max-w-[500px] drop-shadow-[0_0_40px_rgba(8,102,232,0.2)]"
              />
            </div>
            {/* Decorative light beams */}
            <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-bo-blue/10 blur-[100px]" />
            <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-bo-blue-bright/5 blur-[80px]" />
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* TAB NAVIGATION BAR */}
      {/* ================================================================== */}
      <div className="border-y border-bo-border/50 bg-bo-graphite/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 overflow-x-auto px-6 py-4 scrollbar-hide">
          {[
            { label: "Barbeiros", icon: Scissors, active: true },
            { label: "Horários", icon: Clock, active: false },
            { label: "Localização", icon: MapPin, active: false },
            { label: "Instagram", icon: Instagram, active: false },
            { label: "Produtos e Serviços", icon: Box, active: false },
          ].map((tab) => (
            <a
              key={tab.label}
              href={`#${tab.label.toLowerCase().replace(/ /g, "-")}`}
              className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                tab.active
                  ? "bg-bo-blue text-white shadow-[0_0_15px_rgba(8,102,232,0.3)]"
                  : "border border-bo-border bg-bo-card text-bo-gray hover:border-bo-blue/50 hover:text-bo-white"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* BARBEIROS SECTION */}
      {/* ================================================================== */}
      <section id="barbeiros" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
            {/* Section header */}
            <div className="space-y-4">
              <h2 className="font-display text-4xl font-bold">
                Nossos
                <br />
                <span className="text-bo-blue-bright">Barbeiros</span>
              </h2>
              <div className="h-1 w-12 bg-bo-blue" />
              <p className="text-sm leading-relaxed text-bo-gray">
                Profissionais experientes, prontos para oferecer o melhor
                atendimento.
              </p>
            </div>

            {/* Barber cards */}
            <div className="lg:col-span-3">
              {data.barbers.length === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-bo-border bg-bo-card/50">
                  <p className="text-bo-gray">
                    Equipe sendo cadastrada. Em breve nossos profissionais estarão disponíveis.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data.barbers.map((barber: { id: string; full_name: string | null; avatar_url: string | null; phone: string | null; role: string; instagram: string | null }) => (
                    <div
                      key={barber.id}
                      className="group relative overflow-hidden rounded-2xl border border-bo-border bg-bo-card p-6 text-center transition-all hover:border-bo-blue/50 hover:shadow-[0_0_30px_rgba(8,102,232,0.1)]"
                    >
                      <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-bo-border bg-bo-graphite">
                        {barber.avatar_url ? (
                          <img
                            src={barber.avatar_url}
                            alt={barber.full_name ?? "Barbeiro"}
                            className="h-full w-full object-cover grayscale transition-all group-hover:grayscale-0"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-bo-silver">
                            {(barber.full_name ?? "B").charAt(0)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-bo-white">
                        {barber.full_name ?? "Profissional"}
                      </h3>
                      <p className="mb-4 text-sm text-bo-gray">
                        {barber.role ?? "Barbeiro"}
                      </p>
                      {barber.instagram && (
                        <a
                          href={barber.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-bo-blue-bright transition-colors hover:text-bo-blue"
                        >
                          <Instagram className="h-3.5 w-3.5" />
                          {barber.instagram.replace("https://instagram.com/", "@")}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* AGENDAMENTO SECTION */}
      {/* ================================================================== */}
      <section id="agendar" className="border-y border-bo-border/50 bg-bo-graphite/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="overflow-hidden rounded-3xl border border-bo-border bg-bo-card p-8 shadow-2xl lg:p-12">
            <LandingBookingWidget
              services={data.services}
              barbers={data.barbers}
              settings={data.settings}
            />
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PRODUTOS E SERVIÇOS SECTION */}
      {/* ================================================================== */}
      <section id="produtos" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
            {/* Section header */}
            <div className="space-y-4">
              <h2 className="font-display text-4xl font-bold">
                Nossos
                <br />
                <span className="text-bo-blue-bright">Produtos e</span>
                <br />
                <span className="text-bo-blue-bright">Serviços</span>
              </h2>
              <div className="h-1 w-12 bg-bo-blue" />
              <p className="text-sm leading-relaxed text-bo-gray">
                Tudo o que você precisa para um visual impecável.
              </p>
            </div>

            {/* Products & Services grid */}
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Services */}
                {data.services.map((service: { id: string; name: string; description: string | null; price: number; duration_minutes: number; image_url: string | null }) => (
                  <div
                    key={service.id}
                    className="group overflow-hidden rounded-2xl border border-bo-border bg-bo-card transition-all hover:border-bo-blue/50"
                  >
                    <div className="aspect-square bg-bo-graphite">
                      {service.image_url ? (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Scissors className="h-12 w-12 text-bo-border" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-bo-white">
                        {service.name}
                      </h3>
                      <p className="mt-1 text-lg font-bold text-bo-blue-bright">
                        R$ {Number(service.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Products placeholder */}
                {data.products.map((product: { id: string; name: string; description: string | null; price: number; image_url: string | null }) => (
                  <div
                    key={product.id}
                    className="group overflow-hidden rounded-2xl border border-bo-border bg-bo-card transition-all hover:border-bo-blue/50"
                  >
                    <div className="aspect-square bg-bo-graphite">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Box className="h-12 w-12 text-bo-border" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-bo-white">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-lg font-bold text-bo-blue-bright">
                        R$ {Number(product.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}

                {data.services.length === 0 && data.products.length === 0 && (
                  <div className="col-span-full flex h-40 items-center justify-center rounded-2xl border border-dashed border-bo-border bg-bo-card/50">
                    <p className="text-bo-gray">
                      Catálogo sendo configurado pelo administrador.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* LOCALIZAÇÃO + INSTAGRAM SECTION */}
      {/* ================================================================== */}
      <section id="localizacao" className="border-t border-bo-border/50 bg-bo-graphite/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Location */}
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="mt-1 h-8 w-8 text-bo-blue-bright" />
                <div>
                  <h2 className="font-display text-3xl font-bold text-bo-white">
                    Nossa Localização
                  </h2>
                  <p className="mt-2 text-bo-gray">
                    Rua Celina Sacramento da Silva, 20,
                    <br />
                    Quadra B1 - Cidade Universitária,
                    <br />
                    Maceió - AL, 57073-200
                  </p>
                </div>
              </div>

              <a
                href="https://www.google.com/maps/search/?api=1&query=Rua+Celina+Sacramento+da+Silva+20+Cidade+Universitaria+Maceio+AL"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-bo-border bg-bo-card px-6 py-3 text-sm font-medium text-bo-white transition-all hover:border-bo-blue/50 hover:bg-bo-graphite"
              >
                Ver no Google Maps
                <ChevronRight className="h-4 w-4" />
              </a>

              {/* Embedded map */}
              <div className="overflow-hidden rounded-2xl border border-bo-border">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3933.5!2d-35.73!3d-9.55!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOcKwMzMnMDAuMCJTIDM1wrA0Myc0OC4wIlc!5e0!3m2!1spt-BR!2sbr!4v1"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização Barber On Studio"
                  className="invert-[0.85] hue-rotate-180 brightness-90 contrast-110"
                />
              </div>
            </div>

            {/* Instagram */}
            <div
              id="instagram"
              className="flex flex-col justify-center rounded-3xl border border-bo-border bg-bo-card p-8 lg:p-12"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-bo-blue/10">
                <Instagram className="h-7 w-7 text-bo-blue-bright" />
              </div>

              <h2 className="font-display text-3xl font-bold text-bo-white">
                Siga-nos no Instagram
              </h2>
              <p className="mt-3 text-bo-gray">
                Acompanhe nosso trabalho, novidades e inspirações.
              </p>

              <a
                href="https://instagram.com/barberonstudio"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-bo-border bg-bo-graphite px-6 py-3 text-sm font-medium text-bo-white transition-all hover:border-bo-blue/50 hover:bg-bo-blue/10"
              >
                <Instagram className="h-4 w-4 text-bo-blue-bright" />
                @barberonstudio
              </a>

              {/* QR Code placeholder */}
              <div className="mt-8 flex justify-end">
                <div className="h-32 w-32 rounded-xl border border-bo-border bg-bo-white p-2">
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-bo-black">
                    <span className="text-[10px] text-bo-gray">QR Code</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FOOTER */}
      {/* ================================================================== */}
      <footer className="border-t border-bo-border/50 bg-bo-black py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-bo.svg"
              alt="Barber On Studio"
              width={100}
              height={30}
              className="h-8 w-auto opacity-80"
            />
          </div>

          <p className="text-sm text-bo-gray">
            Barber On Studio • Estilo, confiança e atitude.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="https://instagram.com/barberonstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-bo-border p-2 text-bo-gray transition-all hover:border-bo-blue/50 hover:text-bo-white"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>

          <p className="text-xs text-bo-gray/60">
            © {new Date().getFullYear()} Barber On Studio. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}