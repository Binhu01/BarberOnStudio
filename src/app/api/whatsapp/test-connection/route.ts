import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const instant = false;

// =============================================================================
// API: Testar conexão WhatsApp Business Cloud API
// Endpoint: POST /api/whatsapp/test-connection
// Body: { phone_number_id, access_token }
// Retorna: { success, phone_number, display_name, quality_rating }
// =============================================================================

export async function POST(request: Request) {
  await connection();

  try {
    const body = await request.json();
    const { phone_number_id, access_token } = body as {
      phone_number_id?: string;
      access_token?: string;
    };

    if (!phone_number_id || !access_token) {
      return NextResponse.json(
        { error: "phone_number_id e access_token são obrigatórios" },
        { status: 400 }
      );
    }

    // Testar conexão buscando dados do número via Graph API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}?fields=display_phone_number,verified_name,quality_rating,is_official_business_account`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg =
        errorData?.error?.message ??
        `HTTP ${response.status}: ${response.statusText}`;
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      phone_number: data.display_phone_number,
      display_name: data.verified_name,
      quality_rating: data.quality_rating,
      is_official: data.is_official_business_account,
    });
  } catch (error) {
    console.error("[api/whatsapp/test-connection] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}