"use client";

import { useState } from "react";
import {
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Shield,
  ExternalLink,
} from "lucide-react";

interface WhatsappSetupWizardProps {
  initialConfig: {
    phone_number_id: string | null;
    waba_id: string | null;
    is_active: boolean;
    reminder_hours_before: number;
    expiry_reminder_days: number;
  } | null;
}

type WizardStep = "credentials" | "test" | "settings" | "done";

interface TestResult {
  success: boolean;
  phone_number?: string;
  display_name?: string;
  quality_rating?: string;
  error?: string;
}

export function WhatsappSetupWizard({ initialConfig }: WhatsappSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>(
    initialConfig?.is_active ? "done" : "credentials"
  );
  const [phoneNumberId, setPhoneNumberId] = useState(initialConfig?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(initialConfig?.waba_id ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [reminderHours, setReminderHours] = useState(initialConfig?.reminder_hours_before ?? 24);
  const [expiryDays, setExpiryDays] = useState(initialConfig?.expiry_reminder_days ?? 3);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleTestConnection() {
    if (!phoneNumberId || !accessToken) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/whatsapp/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number_id: phoneNumberId, access_token: accessToken }),
      });
      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        // Auto-advance after short delay
        setTimeout(() => setStep("settings"), 1500);
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Erro de conexão",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          access_token: accessToken,
          is_active: true,
          reminder_hours_before: reminderHours,
          expiry_reminder_days: expiryDays,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao salvar");
      }

      setStep("done");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  // Step indicators
  const steps: { key: WizardStep; label: string }[] = [
    { key: "credentials", label: "Credenciais" },
    { key: "test", label: "Teste" },
    { key: "settings", label: "Ajustes" },
    { key: "done", label: "Concluído" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i <= currentStepIndex
                  ? "bg-barber-gold text-barber-white"
                  : "bg-barber-border text-barber-muted"
              }`}
            >
              {i < currentStepIndex ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                i <= currentStepIndex ? "text-barber-white" : "text-barber-muted"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 ${
                  i < currentStepIndex ? "bg-barber-gold" : "bg-barber-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-barber-border bg-barber-graphite p-6 shadow-sm">
        {/* STEP 1: Credentials */}
        {step === "credentials" && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-barber-white">
                Credenciais da Meta Cloud API
              </h2>
              <p className="mt-1 text-sm text-barber-muted">
                Insira os dados da sua conta WhatsApp Business
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-white">
                  Phone Number ID *
                </label>
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="Ex: 1234567890"
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-white">
                  WABA ID
                </label>
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="Ex: 987654321"
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-barber-white">
                  Access Token Permanente *
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Token permanente da API"
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white placeholder:text-barber-muted focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
                <p className="mt-1 text-[10px] text-barber-muted">
                  Gere no Meta Developer Portal → System Users → Generate Token
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep("test")}
                disabled={!phoneNumberId || !accessToken}
                className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-5 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper disabled:opacity-50"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Test Connection */}
        {step === "test" && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-barber-white">
                Testar Conexão
              </h2>
              <p className="mt-1 text-sm text-barber-muted">
                Verificando credenciais na API da Meta...
              </p>
            </div>

            {!testResult && !testing && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Shield className="h-12 w-12 text-barber-muted" />
                <p className="text-sm text-barber-muted">
                  Clique abaixo para validar suas credenciais
                </p>
                <button
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-6 py-3 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
                >
                  <MessageCircle className="h-4 w-4" />
                  Testar Conexão
                </button>
              </div>
            )}

            {testing && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-barber-gold" />
                <p className="text-sm text-barber-muted">Conectando à API da Meta...</p>
              </div>
            )}

            {testResult?.success && (
              <div className="rounded-lg border border-barber-success/30 bg-barber-success/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-barber-success" />
                  <div>
                    <p className="text-sm font-semibold text-barber-success">Conexão bem-sucedida!</p>
                    <div className="mt-2 space-y-1 text-xs text-barber-success/80">
                      {testResult.phone_number && (
                        <p>📱 Número: {testResult.phone_number}</p>
                      )}
                      {testResult.display_name && (
                        <p>🏢 Nome: {testResult.display_name}</p>
                      )}
                      {testResult.quality_rating && (
                        <p>⭐ Qualidade: {testResult.quality_rating}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {testResult && !testResult.success && (
              <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-barber-error" />
                  <div>
                    <p className="text-sm font-semibold text-barber-error">Falha na conexão</p>
                    <p className="mt-1 text-xs text-barber-error/80">{testResult.error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={() => { setStep("credentials"); setTestResult(null); }}
                className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              {testResult?.success && (
                <button
                  onClick={() => setStep("settings")}
                  className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-5 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {testResult && !testResult.success && (
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-5 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper disabled:opacity-50"
                >
                  Tentar Novamente
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Settings */}
        {step === "settings" && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-barber-white">
                Configurações de Envio
              </h2>
              <p className="mt-1 text-sm text-barber-muted">
                Ajuste quando as notificações automáticas devem ser enviadas
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-white">
                  Lembretes de agendamento (horas antes)
                </label>
                <input
                  type="number"
                  value={reminderHours}
                  onChange={(e) => setReminderHours(Number(e.target.value))}
                  min={1}
                  max={168}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
                <p className="mt-1 text-[10px] text-barber-muted">
                  Horas antes do horário para enviar lembrete ao cliente
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-barber-white">
                  Aviso de vencimento de assinatura (dias antes)
                </label>
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  min={1}
                  max={30}
                  className="w-full rounded-lg border border-barber-border bg-barber-dark px-3 py-2.5 text-sm text-barber-white focus:border-barber-gold focus:outline-none focus:ring-1 focus:ring-barber-gold"
                />
                <p className="mt-1 text-[10px] text-barber-muted">
                  Dias antes do vencimento para avisar o cliente
                </p>
              </div>
            </div>

            {saveError && (
              <div className="rounded-lg border border-barber-error/30 bg-barber-error/10 p-3">
                <p className="text-xs text-barber-error">{saveError}</p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep("test")}
                className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-5 py-2.5 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Ativar WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === "done" && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-barber-success/20">
                <CheckCircle2 className="h-8 w-8 text-barber-success" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-barber-white">
                  WhatsApp Configurado!
                </h2>
                <p className="mt-2 text-sm text-barber-muted">
                  As notificações automáticas estão ativas. Seus clientes receberão
                  lembretes de agendamento e avisos de vencimento de assinatura.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-barber-border bg-barber-dark p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-barber-muted">
                O que acontece agora
              </h3>
              <ul className="space-y-2 text-sm text-barber-light">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
                  Lembretes de agendamento enviados automaticamente
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
                  Avisos de vencimento de assinatura para clientes
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
                  Campanhas em massa disponíveis
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-barber-success" />
                  Histórico completo de mensagens enviadas
                </li>
              </ul>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <a
                href="/dashboard/whatsapp"
                className="inline-flex items-center gap-2 rounded-lg border border-barber-border px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-dark/50"
              >
                Ir para Central
              </a>
              <button
                onClick={() => {
                  setStep("settings");
                  setTestResult(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-barber-gold px-4 py-2 text-sm font-medium text-barber-white transition-colors hover:bg-barber-copper"
              >
                Editar Configurações
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Card — only show on credentials step */}
      {step === "credentials" && (
        <div className="rounded-xl border border-barber-border bg-barber-gold/10 p-5">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-barber-gold" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-barber-white">
                Como obter as credenciais
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1.5 text-xs text-barber-muted">
                <li>
                  Acesse{" "}
                  <a
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline hover:text-barber-gold"
                  >
                    developers.facebook.com <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Crie ou selecione um app do tipo <strong>Business</strong></li>
                <li>Adicione o produto <strong>WhatsApp Business Platform</strong></li>
                <li>
                  Em <strong>System Users</strong>, gere um token permanente com a permissão{" "}
                  <code className="rounded bg-barber-dark px-1 text-[10px]">
                    whatsapp_business_messaging
                  </code>
                </li>
                <li>
                  Copie o <strong>Phone Number ID</strong> e <strong>WABA ID</strong> da página do número
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}