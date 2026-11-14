import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("NEXT_PUBLIC_APP_URL") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pedido_id, retorno_url } = await req.json();

    if (!pedido_id || !retorno_url) {
      return new Response(
        JSON.stringify({ error: "pedido_id e retorno_url são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cliente autenticado como quem fez a chamada — assim, as regras de
    // segurança do banco (RLS) já garantem sozinhas que só dá pra criar
    // pagamento pra um pedido que seja realmente do próprio usuário.
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Tabela real: orders (migration 003_sales_schema.sql)
    const { data: pedido, error: erroPedido } = await supabaseUser
      .from("orders")
      .select("id, organization_id")
      .eq("id", pedido_id)
      .single();

    if (erroPedido || !pedido) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tabela real: order_items (migration 003_sales_schema.sql)
    // Colunas: product_name, unit_price, quantity
    const { data: itens, error: erroItens } = await supabaseUser
      .from("order_items")
      .select("product_name, unit_price, quantity")
      .eq("order_id", pedido_id);

    if (erroItens || !itens || itens.length === 0) {
      return new Response(
        JSON.stringify({ error: "Itens do pedido não encontrados" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const preferencia = {
      items: itens.map(
        (item: {
          product_name: string;
          unit_price: number;
          quantity: number;
        }) => ({
          title: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          currency_id: "BRL",
        }),
      ),
      external_reference: pedido_id,
      back_urls: {
        success: retorno_url,
        failure: retorno_url,
        pending: retorno_url,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/pagamento-webhook`,
    };

    const respostaMP = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
        },
        body: JSON.stringify(preferencia),
      },
    );

    const dadosMP = await respostaMP.json();

    if (!respostaMP.ok) {
      console.error("Erro do Mercado Pago:", dadosMP);
      return new Response(
        JSON.stringify({ error: "Não foi possível criar o pagamento" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ init_point: dadosMP.init_point }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (erro) {
    console.error(erro);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});