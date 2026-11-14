import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("NEXT_PUBLIC_APP_URL") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature",
};

/**
 * Valida a assinatura HMAC-SHA256 do webhook do Mercado Pago.
 * O header `x-signature` contém o HMAC calculado com o MP_WEBHOOK_SECRET.
 * Se o secret não estiver configurado, rejeita por segurança.
 */
async function verifySignature(
  req: Request,
  body: string,
): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    console.error("MP_WEBHOOK_SECRET não configurado — rejeitando webhook");
    return false;
  }

  const signature = req.headers.get("x-signature");
  if (!signature) {
    console.warn("Webhook recebido sem header x-signature");
    return false;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  // Mercado Pago envia a assinatura como hex string
  const sigBytes = new Uint8Array(
    signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );

  return await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    sigBytes,
    encoder.encode(body),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Ler o body como texto para validação de assinatura
    const bodyText = await req.text();
    let body: Record<string, unknown> | null = null;

    try {
      body = JSON.parse(bodyText);
    } catch {
      // Body não é JSON válido — pode ser health check do MP
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Validar assinatura do Mercado Pago
    const isValid = await verifySignature(req, bodyText);
    if (!isValid) {
      console.warn("Assinatura inválida — rejeitando webhook");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extrair payment ID do payload
    let paymentId: string | null = null;

    if (body?.data && typeof body.data === "object") {
      const data = body.data as Record<string, unknown>;
      if (data.id) paymentId = String(data.id);
    }

    if (!paymentId && body?.resource) {
      // Formato antigo de webhook do Mercado Pago (.../payments/123456)
      const partes = String(body.resource).split("/");
      paymentId = partes[partes.length - 1];
    }

    if (!paymentId) {
      // Não é uma notificação de pagamento — só confirma o recebimento
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Nunca confiamos no status que vem dentro da notificação em si —
    // sempre confirmamos consultando direto na API do Mercado Pago,
    // usando o ID do pagamento.
    const respostaMP = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
        },
      },
    );

    if (!respostaMP.ok) {
      console.error(
        "Não foi possível consultar o pagamento:",
        await respostaMP.text(),
      );
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const pagamento = await respostaMP.json();
    const pedidoId = pagamento.external_reference;

    if (!pedidoId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Mapear status do MP para status interno
    let statusInterno: string | null = null;
    if (pagamento.status === "approved") {
      statusInterno = "completed";
    } else if (
      ["rejected", "cancelled", "refunded", "charged_back"].includes(
        pagamento.status,
      )
    ) {
      statusInterno = "failed";
    }

    // Status intermediário (pending, in_process, authorized): ainda não é
    // definitivo — só confirma o recebimento e espera a próxima notificação.
    if (!statusInterno) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Chave de serviço: só esta função de servidor de confiança pode
    // gravar em order_payments — o navegador não tem permissão
    // nenhuma de inserir aqui direto.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert em order_payments (tabela real da migration 020)
    // mp_payment_id evita gravar duas vezes caso o Mercado
    // Pago reenvie a mesma notificação (o que é comum e esperado).
    const { error } = await supabaseAdmin.from("order_payments").upsert(
      {
        order_id: pedidoId,
        status: statusInterno,
        payment_method: "mercado_pago",
        external_payment_id: String(paymentId),
        amount: Number(pagamento.transaction_amount) || 0,
        paid_at:
          statusInterno === "completed"
            ? pagamento.date_approved || new Date().toISOString()
            : null,
      },
      { onConflict: "external_payment_id", ignoreDuplicates: true },
    );

    if (error) {
      console.error("Erro ao gravar pagamento:", error);
    }

    // Se aprovado, atualizar também o status do pedido
    if (statusInterno === "completed") {
      await supabaseAdmin
        .from("orders")
        .update({ status: "completed", paid_at: new Date().toISOString() })
        .eq("id", pedidoId);
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (erro) {
    console.error(erro);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});