// =============================================================================
// Barber-On Studio — Email Sender via Resend
// =============================================================================
// Envia emails transacionais via Resend API.
// Atualiza notification_logs com status de envio.
// =============================================================================

import { Resend } from "resend";

export interface EmailSendResult {
 success: boolean;
 messageId?: string;
 error?: string;
}

/**
 * Envia um email via Resend API.
 */
export async function sendEmail(
 apiKey: string,
 to: string,
 subject: string,
 body: string,
 fromName: string = "Barber-On Studio"
): Promise<EmailSendResult> {
 try {
 const resend = new Resend(apiKey);

 // Converter texto simples em HTML básico
 const htmlBody = body
 .replace(/\n/g, "<br>")
 .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

 const { data, error } = await resend.emails.send({
 from: `${fromName} <noreply@barberon.com.br>`,
 to: [to],
 subject,
 html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">${htmlBody}</div>`,
 });

 if (error) {
 return { success: false, error: error.message };
 }

 return { success: true, messageId: data?.id };
 } catch (error) {
 return {
 success: false,
 error: error instanceof Error ? error.message : String(error),
 };
 }
}

/**
 * Processa uma entrada de email da fila notification_logs.
 */
export async function processEmailNotification(
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 supabase: any,
 logEntry: {
 id: string;
 organization_id: string;
 recipient_email: string | null;
 metadata: Record<string, unknown> | null;
 retry_count: number;
 max_retries: number;
 }
): Promise<{ success: boolean; error?: string }> {
 const logId = logEntry.id;

 if (!logEntry.recipient_email) {
 await supabase
 .from("notification_logs")
 .update({
 status: "failed",
 error_message: "No recipient email",
 failed_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 })
 .eq("id", logId);
 return { success: false, error: "No recipient email" };
 }

 // Buscar chave API do Resend da organização (integrações table ou env var)
 const { data: integration } = await supabase
 .from("integration_connections")
 .select("config")
 .eq("organization_id", logEntry.organization_id)
 .eq("provider", "resend")
 .eq("is_active", true)
 .maybeSingle();

 let apiKey: string | undefined;

 if (integration?.config?.api_key) {
 apiKey = integration.config.api_key as string;
 } else {
 // Fallback para variável de ambiente global
 apiKey = process.env.RESEND_API_KEY;
 }

 if (!apiKey) {
 await supabase
 .from("notification_logs")
 .update({
 status: "failed",
 error_message: "Resend API key not configured",
 retry_count: logEntry.retry_count + 1,
 failed_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 })
 .eq("id", logId);
 return { success: false, error: "Resend API key not configured" };
 }

 const messageBody =
 (logEntry.metadata as Record<string, unknown>)?.message_body as string ??
 "Você tem uma nova mensagem.";

 const subject =
 (logEntry.metadata as Record<string, unknown>)?.email_subject as string ??
 "Barber-On Studio — Notificação";

 const result = await sendEmail(apiKey, logEntry.recipient_email, subject, messageBody);

 if (result.success) {
 await supabase
 .from("notification_logs")
 .update({
 status: "sent",
 provider_message_id: result.messageId ?? null,
 sent_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 })
 .eq("id", logId);
 return { success: true };
 } else {
 await supabase
 .from("notification_logs")
 .update({
 status: "failed",
 error_message: result.error ?? "Unknown email send error",
 retry_count: logEntry.retry_count + 1,
 failed_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 })
 .eq("id", logId);
 return { success: false, error: result.error };
 }
}