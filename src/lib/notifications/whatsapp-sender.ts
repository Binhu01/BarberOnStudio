// =============================================================================
// Barber-On Studio — WhatsApp Business Cloud API Sender
// =============================================================================
// Envia mensagens via WhatsApp Business Cloud API (Meta).
// Usa fetch nativo (sem dependências externas).
// Atualiza notification_logs com status de envio.
// =============================================================================

const WHATSAPP_API_VERSION = "v21.0";
const WHATSAPP_BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

export interface WhatsappSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envia uma mensagem de texto via WhatsApp Business Cloud API.
 */
export async function sendWhatsappMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string
): Promise<WhatsappSendResult> {
  // Normalizar número: remover caracteres não numéricos, garantir código do país
  const cleanPhone = to.replace(/\D/g, "");
  const phoneWithCountry = cleanPhone.startsWith("55")
    ? cleanPhone
    : `55${cleanPhone}`;

  try {
    const response = await fetch(
      `${WHATSAPP_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneWithCountry,
          type: "text",
          text: { body },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg =
        errorData?.error?.message ??
        `HTTP ${response.status}: ${response.statusText}`;
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;

    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Processa uma entrada da fila notification_logs: envia a mensagem e atualiza o status.
 * Usa `any` para o cliente Supabase para evitar incompatibilidades de generics
 * entre diferentes versões/instâncias do @supabase/supabase-js.
 */
export async function processNotificationLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  logEntry: {
    id: string;
    organization_id: string;
    channel: string;
    recipient_phone: string | null;
    recipient_email: string | null;
    metadata: Record<string, unknown> | null;
    retry_count: number;
    max_retries: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const logId = logEntry.id;

  // Verificar se já excedeu tentativas
  if (logEntry.retry_count >= logEntry.max_retries) {
    await supabase
      .from("notification_logs")
      .update({
        status: "failed",
        error_message: `Exceeded max retries (${logEntry.max_retries})`,
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);
    return { success: false, error: "Max retries exceeded" };
  }

  // Marcar como "sending"
  await supabase
    .from("notification_logs")
    .update({
      status: "sending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (logEntry.channel === "whatsapp") {
    if (!logEntry.recipient_phone) {
      await supabase
        .from("notification_logs")
        .update({
          status: "failed",
          error_message: "No recipient phone number",
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
      return { success: false, error: "No recipient phone" };
    }

    // Buscar config do WhatsApp da organização
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("access_token_encrypted, phone_number_id, is_active")
      .eq("organization_id", logEntry.organization_id)
      .maybeSingle();

    if (configError || !config || !config.is_active) {
      const errorMsg = !config
        ? "WhatsApp config not found"
        : !config.is_active
          ? "WhatsApp integration is disabled"
          : configError?.message ?? "Unknown config error";

      await supabase
        .from("notification_logs")
        .update({
          status: "failed",
          error_message: errorMsg,
          retry_count: logEntry.retry_count + 1,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
      return { success: false, error: errorMsg };
    }

    // O token é armazenado como texto simples (ver actions.ts:517)
    const accessToken = config.access_token_encrypted as string;
    const phoneNumberId = config.phone_number_id as string;
    const messageBody =
      (logEntry.metadata as Record<string, unknown>)?.message_body as string ??
      "Você tem uma nova mensagem.";

    const result = await sendWhatsappMessage(
      accessToken,
      phoneNumberId,
      logEntry.recipient_phone,
      messageBody
    );

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
          error_message: result.error ?? "Unknown send error",
          retry_count: logEntry.retry_count + 1,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
      return { success: false, error: result.error };
    }
  }

  if (logEntry.channel === "email") {
    // Importar dinamicamente para evitar dependência circular
    const { processEmailNotification } = await import("./email-sender");
    return processEmailNotification(supabase, logEntry);
  }

  // Canal não suportado ainda (sms)
  await supabase
    .from("notification_logs")
    .update({
      status: "failed",
      error_message: `Channel "${logEntry.channel}" not yet implemented`,
      retry_count: logEntry.retry_count + 1,
      failed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);
  return {
    success: false,
    error: `Channel "${logEntry.channel}" not yet implemented`,
  };
}