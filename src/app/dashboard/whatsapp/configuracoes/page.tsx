export const instant = false;

import { connection } from "next/server";
import { getWhatsappConfig } from "../actions";
import { WhatsappSetupWizard } from "./_components/whatsapp-setup-wizard";

export default async function WhatsappConfiguracoesPage() {
  await connection();

  const config = await getWhatsappConfig().catch(() => null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-barber-white">
          Configurações WhatsApp
        </h1>
        <p className="mt-1 text-sm text-barber-muted">
          Configure a integração com WhatsApp Business Cloud API
        </p>
      </div>

      <WhatsappSetupWizard initialConfig={config} />
    </div>
  );
}