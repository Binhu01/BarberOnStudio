import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de privacidade do Barber-On Studio — como tratamos seus dados pessoais em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
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
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-barber-muted">
          Última atualização: 13 de novembro de 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-barber-muted">
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              1. Introdução
            </h2>
            <p>
              O Barber-On Studio ("nós", "nosso") respeita sua privacidade e está comprometido em proteger
              seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              Esta política descreve como coletamos, usamos, armazenamos e protegemos suas informações.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              2. Dados Coletados
            </h2>
            <p className="mb-2">Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, CPF/CNPJ</li>
              <li><strong>Dados da barbearia:</strong> nome comercial, endereço, horários de funcionamento</li>
              <li><strong>Dados de clientes:</strong> nome, telefone, histórico de serviços (fornecidos por você)</li>
              <li><strong>Dados financeiros:</strong> transações, pagamentos, notas fiscais</li>
              <li><strong>Dados de uso:</strong> logs de acesso, funcionalidades utilizadas, dispositivo e navegador</li>
              <li><strong>Dados de comunicação:</strong> mensagens enviadas via WhatsApp/e-mail através da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              3. Finalidade do Tratamento
            </h2>
            <p className="mb-2">Seus dados são utilizados para:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Fornecer e melhorar os serviços da plataforma</li>
              <li>Processar agendamentos, comandas e transações financeiras</li>
              <li>Enviar notificações e lembretes aos seus clientes</li>
              <li>Gerar relatórios e análises de desempenho</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Comunicar atualizações, novidades e suporte</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              4. Base Legal
            </h2>
            <p>
              O tratamento de dados pessoais é realizado com base em: (a) execução de contrato;
              (b) cumprimento de obrigação legal; (c) legítimo interesse do controlador;
              (d) consentimento do titular, quando aplicável.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              5. Compartilhamento de Dados
            </h2>
            <p>
              Seus dados podem ser compartilhados com: (a) provedores de infraestrutura (hospedagem, banco de dados);
              (b) gateways de pagamento; (c) serviços de comunicação (WhatsApp Business API, e-mail);
              (d) autoridades públicas, quando exigido por lei. Todos os parceiros estão sujeitos a acordos
              de confidencialidade e conformidade com a LGPD.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              6. Armazenamento e Segurança
            </h2>
            <p>
              Seus dados são armazenados em servidores seguros com criptografia em repouso e em trânsito.
              Adotamos medidas técnicas e administrativas para proteger contra acesso não autorizado,
              perda ou alteração. Os dados são mantidos pelo período necessário à finalidade do tratamento
              ou conforme exigência legal.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              7. Direitos do Titular
            </h2>
            <p className="mb-2">Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Confirmação e acesso aos dados tratados</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados a outro fornecedor</li>
              <li>Eliminação dos dados tratados com consentimento</li>
              <li>Revogação do consentimento</li>
              <li>Informação sobre compartilhamento com terceiros</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, entre em contato pelo e-mail{" "}
              <a href="mailto:privacidade@barberon.com.br" className="text-barber-gold hover:underline">
                privacidade@barberon.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              8. Cookies e Tecnologias Similares
            </h2>
            <p>
              Utilizamos cookies essenciais para autenticação e funcionamento da plataforma.
              Cookies analíticos podem ser utilizados para melhorar a experiência. Você pode gerenciar
              as preferências de cookies nas configurações do seu navegador.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              9. Alterações nesta Política
            </h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações significativas serão comunicadas
              através da plataforma ou por e-mail. A data da última atualização consta no topo desta página.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-barber-white">
              10. Contato
            </h2>
            <p>
              Dúvidas sobre privacidade e proteção de dados podem ser enviadas para{" "}
              <a href="mailto:privacidade@barberon.com.br" className="text-barber-gold hover:underline">
                privacidade@barberon.com.br
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}