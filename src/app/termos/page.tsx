import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
 title: "Termos de Uso",
 description: "Termos de uso do Barber-On Studio — plataforma de gestão para barbearias.",
};

export default function TermosPage() {
 return (
 <div className="min-h-screen bg-barber-dark px-6 py-16">
 <div className="mx-auto max-w-3xl">
 <Link
 href="/"
 className="mb-8 inline-block text-sm font-medium text-barber-muted hover:text-barber-gold"
 >
 ← Voltar ao início
 </Link>

 <h1 className="font-display text-3xl font-bold text-barber-white">
 Termos de Uso
 </h1>
 <p className="mt-2 text-sm text-barber-muted">
 Última atualização: 13 de novembro de 2026
 </p>

 <div className="mt-10 space-y-8 text-sm leading-relaxed text-barber-muted">
 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 1. Aceitação dos Termos
 </h2>
 <p>
 Ao acessar ou utilizar o Barber-On Studio ("Plataforma"), você concorda com estes Termos de Uso.
 Caso não concorde, não utilize a Plataforma. Reservamo-nos o direito de alterar estes termos a qualquer momento,
 sendo sua responsabilidade revisá-los periodicamente.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 2. Descrição do Serviço
 </h2>
 <p>
 O Barber-On Studio é uma plataforma SaaS de gestão para barbearias que oferece funcionalidades de agendamento,
 comandas, controle financeiro, gestão de equipe, fidelidade e comunicação com clientes. O serviço é fornecido
 mediante assinatura conforme planos disponíveis.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 3. Cadastro e Conta
 </h2>
 <p>
 Para utilizar a Plataforma, é necessário criar uma conta com informações verdadeiras e completas.
 Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades
 realizadas em sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 4. Uso Aceitável
 </h2>
 <p>
 Você se compromete a utilizar a Plataforma apenas para fins legítimos relacionados à gestão de sua barbearia.
 É proibido: (a) violar leis aplicáveis; (b) infringir direitos de terceiros; (c) tentar acessar áreas restritas
 do sistema; (d) utilizar a Plataforma para enviar spam ou conteúdo malicioso; (e) realizar engenharia reversa
 do software.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 5. Propriedade Intelectual
 </h2>
 <p>
 Todo o conteúdo, software, design e marcas da Plataforma são de propriedade exclusiva do Barber-On Studio
 ou de seus licenciadores. Nenhuma licença ou direito de propriedade intelectual é concedido além do direito
 limitado de uso da Plataforma conforme estes termos.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 6. Limitação de Responsabilidade
 </h2>
 <p>
 A Plataforma é fornecida "como está". Não garantimos que o serviço será ininterrupto, livre de erros ou
 completamente seguro. Em nenhuma hipótese seremos responsáveis por danos indiretos, incidentais ou
 consequenciais decorrentes do uso da Plataforma. Nossa responsabilidade total limita-se ao valor pago
 nos últimos 12 meses de assinatura.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 7. Rescisão
 </h2>
 <p>
 Podemos suspender ou encerrar sua conta a qualquer momento por violação destes termos ou por inatividade
 prolongada. Você pode cancelar sua assinatura a qualquer momento através das configurações da conta.
 Após o cancelamento, seus dados serão mantidos por 90 dias antes da exclusão definitiva.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 8. Lei Aplicável e Foro
 </h2>
 <p>
 Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida
 no foro da comarca de São Paulo/SP, com exclusão de qualquer outro.
 </p>
 </section>

 <section>
 <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
 9. Contato
 </h2>
 <p>
 Dúvidas sobre estes termos podem ser enviadas para{" "}
 <a href="mailto:legal@barberon.com.br" className="text-barber-gold hover:underline">
 legal@barberon.com.br
 </a>.
 </p>
 </section>
 </div>
 </div>
 </div>
 );
}