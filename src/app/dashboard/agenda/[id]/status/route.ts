import { NextRequest, NextResponse } from "next/server";
import { changeAppointmentStatus } from "../../actions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const newStatus = formData.get("new_status") as string;
  const reason = formData.get("reason") as string | null;

  if (!newStatus) {
    return NextResponse.json(
      { error: "Status é obrigatório" },
      { status: 400 }
    );
  }

  try {
    await changeAppointmentStatus({
      event_id: id,
      new_status: newStatus as any,
      reason: reason ?? null,
    });

    // Redirect back to the appointment detail page
    const referer = request.headers.get("referer");
    return NextResponse.redirect(
      referer ?? `/dashboard/agenda/${id}`
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Erro ao alterar status" },
      { status: 500 }
    );
  }
}