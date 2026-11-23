# -*- coding: utf-8 -*-
"""Generate WhatsApp Setup Guide PDF for Barber-On Studio barbers."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import os

# Colors: azul, preto e prata (identidade da barbearia)
AZUL = HexColor("#1E40AF")
AZUL_CLARO = HexColor("#3B82F6")
AZUL_DESTAQUE = HexColor("#60A5FA")
PRETO = HexColor("#0A0A0A")
GRAFITE = HexColor("#1F2937")
PRATA = HexColor("#D1D5DB")
PRATA_ESCURO = HexColor("#9CA3AF")
BRANCO = HexColor("#F9FAFB")
VERMELHO = HexColor("#EF4444")
AMBAR = HexColor("#F59E0B")

# Styles
styles = {
    "title": ParagraphStyle(
        "Title", fontName="Helvetica-Bold", fontSize=28,
        textColor=AZUL_DESTAQUE, alignment=TA_CENTER, spaceAfter=6*mm,
        leading=34
    ),
    "subtitle": ParagraphStyle(
        "Subtitle", fontName="Helvetica", fontSize=14,
        textColor=PRATA_ESCURO, alignment=TA_CENTER, spaceAfter=12*mm,
        leading=18
    ),
    "h1": ParagraphStyle(
        "H1", fontName="Helvetica-Bold", fontSize=20,
        textColor=AZUL_DESTAQUE, spaceBefore=10*mm, spaceAfter=5*mm,
        leading=24
    ),
    "h2": ParagraphStyle(
        "H2", fontName="Helvetica-Bold", fontSize=15,
        textColor=BRANCO, spaceBefore=6*mm, spaceAfter=3*mm,
        leading=19
    ),
    "h3": ParagraphStyle(
        "H3", fontName="Helvetica-Bold", fontSize=12,
        textColor=HexColor("#E5E7EB"), spaceBefore=4*mm, spaceAfter=2*mm,
        leading=15
    ),
    "body": ParagraphStyle(
        "Body", fontName="Helvetica", fontSize=10.5,
        textColor=PRATA, alignment=TA_JUSTIFY,
        spaceAfter=3*mm, leading=15
    ),
    "bullet": ParagraphStyle(
        "Bullet", fontName="Helvetica", fontSize=10.5,
        textColor=PRATA, leftIndent=12*mm,
        bulletIndent=5*mm, spaceAfter=2*mm, leading=14,
        bulletFontName="Helvetica", bulletFontSize=10.5
    ),
    "step_num": ParagraphStyle(
        "StepNum", fontName="Helvetica-Bold", fontSize=22,
        textColor=AZUL_DESTAQUE, alignment=TA_CENTER, leading=26
    ),
    "step_title": ParagraphStyle(
        "StepTitle", fontName="Helvetica-Bold", fontSize=13,
        textColor=BRANCO, leading=17
    ),
    "step_body": ParagraphStyle(
        "StepBody", fontName="Helvetica", fontSize=10.5,
        textColor=PRATA, leading=15, spaceAfter=2*mm
    ),
    "code": ParagraphStyle(
        "Code", fontName="Courier", fontSize=9,
        textColor=AZUL_CLARO, backColor=HexColor("#111827"),
        borderPadding=(3*mm, 3*mm, 3*mm, 3*mm),
        spaceAfter=3*mm, leading=13, leftIndent=5*mm, rightIndent=5*mm
    ),
    "tip": ParagraphStyle(
        "Tip", fontName="Helvetica-Oblique", fontSize=10,
        textColor=AZUL_CLARO, leftIndent=8*mm, spaceAfter=3*mm, leading=14
    ),
    "warning": ParagraphStyle(
        "Warning", fontName="Helvetica-Bold", fontSize=10,
        textColor=VERMELHO, leftIndent=8*mm, spaceAfter=3*mm, leading=14
    ),
    "footer": ParagraphStyle(
        "Footer", fontName="Helvetica", fontSize=8,
        textColor=PRATA_ESCURO, alignment=TA_CENTER
    ),
    "table_header": ParagraphStyle(
        "TableHeader", fontName="Helvetica-Bold", fontSize=9.5,
        textColor=PRETO, alignment=TA_CENTER, leading=12
    ),
    "table_cell": ParagraphStyle(
        "TableCell", fontName="Helvetica", fontSize=9,
        textColor=PRATA, leading=12
    ),
}


def make_step_box(number, title, body_paragraphs):
    """Create a styled step box with number badge."""
    num_para = Paragraph(str(number), styles["step_num"])
    title_para = Paragraph(title, styles["step_title"])

    inner_content = [[num_para, title_para]]
    for bp in body_paragraphs:
        inner_content.append(["", bp])

    col_widths = [18*mm, 148*mm]
    t = Table(inner_content, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2*mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2*mm),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, -1), 3*mm),
        ("BACKGROUND", (0, 0), (-1, -1), GRAFITE),
        ("ROUNDEDCORNERS", [3*mm, 3*mm, 3*mm, 3*mm]),
        ("BOX", (0, 0), (-1, -1), 0.5, AZUL),
    ]))
    return KeepTogether([t, Spacer(1, 4*mm)])


def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=20*mm,
        bottomMargin=20*mm,
        leftMargin=18*mm,
        rightMargin=18*mm,
        title="Guia de Configuração WhatsApp — Barber-On Studio",
        author="Barber-On Studio",
        subject="Configuração do WhatsApp Business para barbeiros",
    )

    story = []

    # ── COVER ──────────────────────────────────────────────
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("💈", ParagraphStyle(
        "Emoji", fontName="Helvetica", fontSize=48,
        alignment=TA_CENTER, spaceAfter=8*mm
    )))
    story.append(Paragraph("Guia de Configuração<br/>WhatsApp Business", styles["title"]))
    story.append(Paragraph("Barber-On Studio", ParagraphStyle(
        "Brand", fontName="Helvetica-Bold", fontSize=16,
        textColor=AZUL_DESTAQUE, alignment=TA_CENTER, spaceAfter=4*mm
    )))
    story.append(Paragraph(
        "Passo a passo completo para conectar seu WhatsApp<br/>"
        "e começar a enviar notificações automáticas aos clientes",
        styles["subtitle"]
    ))
    story.append(HRFlowable(width="60%", thickness=2, color=AZUL, spaceAfter=10*mm))

    # Quick info table
    info_data = [
        [Paragraph("<b>Tempo estimado</b>", styles["table_header"]),
         Paragraph("<b>Dificuldade</b>", styles["table_header"]),
         Paragraph("<b>Pré-requisitos</b>", styles["table_header"])],
        [Paragraph("15–20 minutos", styles["table_cell"]),
         Paragraph("Fácil (sem código)", styles["table_cell"]),
         Paragraph("Conta Meta + WhatsApp Business", styles["table_cell"])],
    ]
    info_table = Table(info_data, colWidths=[55*mm, 55*mm, 56*mm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("BACKGROUND", (0, 1), (-1, 1), GRAFITE),
        ("GRID", (0, 0), (-1, -1), 0.5, AZUL),
        ("TOPPADDING", (0, 0), (-1, -1), 3*mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3*mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3*mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3*mm),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(info_table)

    story.append(PageBreak())

    # ── TABLE OF CONTENTS ──────────────────────────────────
    story.append(Paragraph("Índice", styles["h1"]))
    toc_items = [
        "1. Pré-requisitos",
        "2. Passo 1 — Criar conta no Meta Business Suite",
        "3. Passo 2 — Criar app no Meta Developer Portal",
        "4. Passo 3 — Adicionar WhatsApp ao app",
        "5. Passo 4 — Gerar Access Token permanente",
        "6. Passo 5 — Configurar no Barber-On Studio",
        "7. Passo 6 — Testar a conexão",
        "8. Solução de Problemas",
        "9. Perguntas Frequentes",
        "10. Suporte e Contato",
    ]
    for item in toc_items:
        story.append(Paragraph(item, ParagraphStyle(
            "TOC", fontName="Helvetica", fontSize=11,
            textColor=PRATA, leftIndent=10*mm,
            spaceAfter=2.5*mm, leading=15
        )))
    story.append(PageBreak())

    # ── SECTION 1: PREREQUISITES ───────────────────────────
    story.append(Paragraph("1. Pré-requisitos", styles["h1"]))
    story.append(Paragraph(
        "Antes de começar, certifique-se de que você tem tudo abaixo:",
        styles["body"]
    ))

    prereqs = [
        ("<b>Conta no Facebook</b> — necessária para acessar o Meta Business Suite.",),
        ("<b>WhatsApp Business App</b> instalado no celular da barbearia.<br/>"
         "<i>Não use o WhatsApp pessoal.</i> Baixe na Play Store ou App Store.",),
        ("<b>Número de telefone dedicado</b> para a barbearia (chip separado ou número fixo).",),
        ("<b>Computador com navegador</b> (Chrome, Edge ou Firefox recomendado).",),
        ("<b>Sua conta no Barber-On Studio</b> já criada em barber-on-studio.vercel.app.",),
    ]
    for p in prereqs:
        story.append(Paragraph(f"• {p[0]}", styles["bullet"]))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "⚠️ IMPORTANTE: O número usado no WhatsApp Business NÃO pode estar "
        "vinculado a um WhatsApp pessoal ativo. Se estiver, faça backup e "
        "migre para o WhatsApp Business antes de continuar.",
        styles["warning"]
    ))

    story.append(PageBreak())

    # ── SECTION 2: META BUSINESS SUITE ─────────────────────
    story.append(Paragraph("2. Passo 1 — Criar conta no Meta Business Suite", styles["h1"]))

    story.append(make_step_box("1", "Acesse o Meta Business Suite", [
        Paragraph(
            "Abra o navegador e vá para:<br/>"
            "<b>https://business.facebook.com</b>",
            styles["step_body"]
        ),
        Paragraph(
            "Se já tem uma conta vinculada à sua barbearia, faça login. "
            "Se não tem, clique em <b>'Criar conta'</b> e siga o cadastro.",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("2", "Configure sua empresa", [
        Paragraph(
            "Preencha os dados da barbearia:<br/>"
            "• Nome da empresa (ex: 'Barbearia do João')<br/>"
            "• Seu nome completo<br/>"
            "• E-mail profissional da barbearia",
            styles["step_body"]
        ),
        Paragraph(
            "💡 Dica: Use o mesmo e-mail que você usou para criar sua conta "
            "no Barber-On Studio. Isso facilita a gestão.",
            styles["tip"]
        ),
    ]))

    story.append(make_step_box("3", "Verifique seu e-mail", [
        Paragraph(
            "O Meta enviará um código de verificação para o e-mail informado. "
            "Digite o código na tela para confirmar a conta.",
            styles["step_body"]
        ),
    ]))

    story.append(PageBreak())

    # ── SECTION 3: META DEVELOPER PORTAL ───────────────────
    story.append(Paragraph("3. Passo 2 — Criar app no Meta Developer Portal", styles["h1"]))

    story.append(make_step_box("1", "Acesse o Developer Portal", [
        Paragraph(
            "Abra uma nova aba e vá para:<br/>"
            "<b>https://developers.facebook.com</b><br/><br/>"
            "Faça login com a <b>mesma conta do Facebook</b> que você usou "
            "no Meta Business Suite.",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("2", "Crie um novo aplicativo", [
        Paragraph(
            "No painel, clique em <b>'Meus Apps'</b> → <b>'Criar app'</b>.<br/><br/>"
            "Selecione o tipo de app: <b>'Negócios' (Business)</b>.<br/>"
            "Nomeie o app (ex: 'Barber-On WhatsApp').<br/>"
            "Vincule à conta Business que você criou no passo anterior.",
            styles["step_body"]
        ),
        Paragraph(
            "💡 O nome do app é interno — só você vê. Pode colocar qualquer nome.",
            styles["tip"]
        ),
    ]))

    story.append(make_step_box("3", "Anote o App ID", [
        Paragraph(
            "Após criar, você verá o painel do app. No topo da página, "
            "anote o <b>App ID</b> (número). Você pode precisar dele depois.",
            styles["step_body"]
        ),
    ]))

    story.append(PageBreak())

    # ── SECTION 4: ADD WHATSAPP ────────────────────────────
    story.append(Paragraph("4. Passo 3 — Adicionar WhatsApp ao app", styles["h1"]))

    story.append(make_step_box("1", "Adicione o produto WhatsApp", [
        Paragraph(
            "No painel lateral esquerdo do seu app, clique em<br/>"
            "<b>'Adicionar produtos ao app'</b>.<br/><br/>"
            "Encontre <b>'WhatsApp'</b> na lista e clique em <b>'Configurar'</b>.",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("2", "Configure o número de telefone", [
        Paragraph(
            "Na seção <b>'API do WhatsApp'</b> → <b>'Configuração da API'</b>:<br/><br/>"
            "• Clique em <b>'Adicionar número de telefone'</b><br/>"
            "• Selecione ou adicione o número da barbearia<br/>"
            "• Verifique o número com o código SMS recebido",
            styles["step_body"]
        ),
        Paragraph(
            "⚠️ O número deve estar registrado no WhatsApp Business App "
            "antes de ser adicionado aqui.",
            styles["warning"]
        ),
    ]))

    story.append(make_step_box("3", "Anote as credenciais", [
        Paragraph(
            "Após configurar, anote estes dois valores — você precisará deles:<br/><br/>"
            "• <b>Phone Number ID</b> — aparece na seção 'Telefone'<br/>"
            "• <b>WABA ID</b> (WhatsApp Business Account ID) — aparece em 'Informações da conta'<br/><br/>"
            "Copie ambos e guarde em um local seguro.",
            styles["step_body"]
        ),
    ]))

    story.append(PageBreak())

    # ── SECTION 5: ACCESS TOKEN ────────────────────────────
    story.append(Paragraph("5. Passo 4 — Gerar Access Token permanente", styles["h1"]))

    story.append(Paragraph(
        "O Access Token é a 'chave' que permite ao Barber-On enviar mensagens "
        "em nome da sua barbearia. Siga estes passos com atenção:",
        styles["body"]
    ))

    story.append(make_step_box("1", "Crie um Usuário do Sistema", [
        Paragraph(
            "No Meta Business Suite, vá para:<br/>"
            "<b>Configurações do Negócio</b> → <b>Usuários</b> → <b>Usuários do sistema</b><br/><br/>"
            "Clique em <b>'Adicionar'</b>:<br/>"
            "• Nome: 'Barber-On Bot' (ou qualquer nome)<br/>"
            "• Função: <b>Admin</b><br/>"
            "• Clique em <b>'Criar usuário do sistema'</b>",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("2", "Gere o token", [
        Paragraph(
            "Clique no usuário criado → <b>'Gerar novo token'</b>.<br/><br/>"
            "Selecione o app que você criou ('Barber-On WhatsApp').<br/>"
            "Marque a permissão: <b>whatsapp_business_messaging</b><br/>"
            "Clique em <b>'Gerar token'</b>.",
            styles["step_body"]
        ),
        Paragraph(
            "⚠️ CRÍTICO: Copie o token IMEDIATAMENTE. Ele aparece apenas UMA VEZ. "
            "Se perder, terá que gerar outro.",
            styles["warning"]
        ),
    ]))

    story.append(make_step_box("3", "Guarde as 3 credenciais", [
        Paragraph(
            "Agora você deve ter estas 3 informações:<br/><br/>"
            "① <b>Phone Number ID</b> (do Passo 3)<br/>"
            "② <b>WABA ID</b> (do Passo 3)<br/>"
            "③ <b>Access Token</b> (deste passo)<br/><br/>"
            "Com elas, você está pronto para configurar o Barber-On!",
            styles["step_body"]
        ),
    ]))

    story.append(PageBreak())

    # ── SECTION 6: CONFIGURE IN BARBER-ON ──────────────────
    story.append(Paragraph("6. Passo 5 — Configurar no Barber-On Studio", styles["h1"]))

    story.append(Paragraph(
        "Agora vamos conectar tudo dentro do sistema. Esta parte é simples "
        "e leva menos de 2 minutos.",
        styles["body"]
    ))

    story.append(make_step_box("1", "Acesse a página de configuração", [
        Paragraph(
            "Faça login no Barber-On Studio:<br/>"
            "<b>https://barber-on-studio.vercel.app/dashboard</b><br/><br/>"
            "No menu lateral, clique em <b>'WhatsApp'</b> → <b>'Configurações'</b>.<br/>"
            "Você verá o assistente de configuração em 4 passos.",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("2", "Preencha as credenciais (Passo 1/4)", [
        Paragraph(
            "No formulário, cole os valores que você anotou:<br/><br/>"
            "• <b>Phone Number ID:</b> [cole o Phone Number ID]<br/>"
            "• <b>WABA ID:</b> [cole o WABA ID]<br/>"
            "• <b>Access Token:</b> [cole o Access Token]<br/><br/>"
            "Clique em <b>'Próximo'</b>.",
            styles["step_body"]
        ),
        Paragraph(
            "💡 Se tiver dúvida sobre onde encontrar cada valor, volte às seções anteriores deste guia.",
            styles["tip"]
        ),
    ]))

    story.append(make_step_box("3", "Teste a conexão (Passo 2/4)", [
        Paragraph(
            "Clique em <b>'Testar Conexão'</b>.<br/><br/>"
            "O sistema vai validar suas credenciais com a Meta.<br/>"
            "Se tudo estiver certo, você verá:<br/>"
            "✅ <b>Conectado com sucesso!</b><br/>"
            "Nome do número, qualidade da conta e status oficial.<br/><br/>"
            "O assistente avança automaticamente para o próximo passo.",
            styles["step_body"]
        ),
        Paragraph(
            "⚠️ Se der erro, verifique se copiou os valores corretamente "
            "(sem espaços extras). Veja a seção 'Solução de Problemas'.",
            styles["warning"]
        ),
    ]))

    story.append(make_step_box("4", "Configure lembretes (Passo 3/4)", [
        Paragraph(
            "Defina quando o sistema deve enviar lembretes:<br/><br/>"
            "• <b>Horas antes do agendamento:</b> quantas horas antes avisar o cliente<br/>"
            "• <b>Dias antes do vencimento:</b> quantos dias antes avisar sobre assinatura<br/><br/>"
            "Valores recomendados: 2 horas antes / 3 dias antes.<br/>"
            "Clique em <b>'Salvar e Continuar'</b>.",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("5", "Concluído! (Passo 4/4)", [
        Paragraph(
            "Você verá a tela de confirmação com:<br/>"
            "✅ WhatsApp conectado<br/>"
            "✅ Notificações automáticas ativadas<br/>"
            "✅ Lembretes configurados<br/><br/>"
            "Pronto! Seu WhatsApp está integrado ao Barber-On Studio.",
            styles["step_body"]
        ),
    ]))

    story.append(PageBreak())

    # ── SECTION 7: TEST ────────────────────────────────────
    story.append(Paragraph("7. Passo 6 — Testar a conexão", styles["h1"]))

    story.append(Paragraph(
        "Para garantir que tudo funciona, faça um teste real:",
        styles["body"]
    ))

    story.append(make_step_box("1", "Envie uma mensagem de teste", [
        Paragraph(
            "Na página de configurações do WhatsApp, clique em<br/>"
            "<b>'Enviar mensagem de teste'</b>.<br/><br/>"
            "Informe o número do seu celular pessoal.<br/>"
            "Você deve receber uma mensagem da barbearia em segundos.",
            styles["step_body"]
        ),
    ]))

    story.append(make_step_box("2", "Verifique as notificações automáticas", [
        Paragraph(
            "Crie um agendamento de teste no Barber-On com data de amanhã.<br/>"
            "No horário configurado, o cliente (você) receberá um lembrete automático.<br/><br/>"
            "Se não receber, verifique:<br/>"
            "• O número do cliente está correto (com DDD)?<br/>"
            "• O WhatsApp Business está ativo no celular da barbearia?<br/>"
            "• As configurações salvas estão corretas?",
            styles["step_body"]
        ),
    ]))

    story.append(PageBreak())

    # ── SECTION 8: TROUBLESHOOTING ─────────────────────────
    story.append(Paragraph("8. Solução de Problemas", styles["h1"]))

    problems = [
        ("Erro: 'Invalid OAuth access token'",
         "O token expirou ou foi copiado incorretamente. Gere um novo token "
         "seguindo o Passo 4 novamente. Certifique-se de selecionar a permissão "
         "'whatsapp_business_messaging'."),

        ("Erro: 'Phone number not found'",
         "O Phone Number ID está errado ou o número não foi verificado. "
         "Volte ao Meta Developer Portal → WhatsApp → Configuração da API "
         "e copie o ID novamente."),

        ("Erro: 'WABA not authorized'",
         "Sua conta Business ainda não foi aprovada pela Meta. Aguarde a aprovação "
         "(geralmente leva algumas horas) ou verifique se há pendências em "
         "'Qualidade da conta' no Business Suite."),

        ("Mensagens não chegam ao cliente",
         "Verifique:<br/>"
         "• O número do cliente tem DDD (ex: 82999999999)?<br/>"
         "• O WhatsApp Business está online no celular?<br/>"
         "• O cliente não bloqueou o número da barbearia?<br/>"
         "• Nas primeiras 24h, só é possível responder mensagens recebidas. "
         "Após isso, mensagens ativas funcionam normalmente."),

        ("O wizard não avança após o teste",
         "Tente limpar o cache do navegador (Ctrl+Shift+Delete) e recarregar a página. "
         "Se persistir, entre em contato pelo suporte."),
    ]

    for title, desc in problems:
        story.append(Paragraph(f"<b>❌ {title}</b>", styles["h3"]))
        story.append(Paragraph(desc, styles["body"]))

    story.append(PageBreak())

    # ── SECTION 9: FAQ ─────────────────────────────────────
    story.append(Paragraph("9. Perguntas Frequentes", styles["h1"]))

    faqs = [
        ("Preciso pagar algo para a Meta?",
         "A Meta cobra por conversação iniciada pela empresa (mensagens ativas). "
         "Respostas a mensagens recebidas dos clientes são gratuitas. "
         "Os valores variam por país — consulte a tabela de preços da Meta."),

        ("Posso usar meu WhatsApp pessoal?",
         "Não. É obrigatório usar o WhatsApp Business App. O WhatsApp pessoal "
         "não suporta a API e será bloqueado se tentar."),

        ("E se eu trocar de celular?",
         "O número fica vinculado à conta Business, não ao aparelho. "
         "Basta instalar o WhatsApp Business no novo celular e verificar o mesmo número."),

        ("As mensagens aparecem como spam?",
         "Não, desde que você use templates aprovados pela Meta e respeite as políticas. "
         "Mensagens de lembrete de agendamento são consideradas utilitárias e têm alta taxa de entrega."),

        ("Quantas mensagens posso enviar por dia?",
         "Novas contas começam com limite de 50 conversações/dia. "
         "Conforme a qualidade se mantém boa, o limite aumenta automaticamente "
         "para 250, 1.000 e depois ilimitado."),

        ("Preciso de CNPJ?",
         "Não necessariamente. Você pode criar uma conta Business como pessoa física. "
         "Mas ter CNPJ ajuda na verificação e credibilidade."),
    ]

    for q, a in faqs:
        story.append(Paragraph(f"<b>P: {q}</b>", styles["h3"]))
        story.append(Paragraph(a, styles["body"]))

    story.append(PageBreak())

    # ── SECTION 10: SUPPORT ────────────────────────────────
    story.append(Paragraph("10. Suporte e Contato", styles["h1"]))

    story.append(Paragraph(
        "Se você travou em algum passo ou precisa de ajuda personalizada, "
        "entre em contato conosco:",
        styles["body"]
    ))

    support_data = [
        [Paragraph("<b>Canal</b>", styles["table_header"]),
         Paragraph("<b>Detalhes</b>", styles["table_header"])],
        [Paragraph("E-mail", styles["table_cell"]),
         Paragraph("contato@barberon.com.br", styles["table_cell"])],
        [Paragraph("Site", styles["table_cell"]),
         Paragraph("barber-on-studio.vercel.app", styles["table_cell"])],
        [Paragraph("Horário de suporte", styles["table_cell"]),
         Paragraph("Seg–Sex, 9h–18h (horário de Brasília)", styles["table_cell"])],
        [Paragraph("Tempo de resposta", styles["table_cell"]),
         Paragraph("Até 24 horas úteis", styles["table_cell"])],
    ]
    support_table = Table(support_data, colWidths=[50*mm, 116*mm])
    support_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("BACKGROUND", (0, 1), (-1, -1), GRAFITE),
        ("GRID", (0, 0), (-1, -1), 0.5, AZUL),
        ("TOPPADDING", (0, 0), (-1, -1), 3*mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3*mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3*mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3*mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(support_table)

    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=AZUL))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph(
        "Barber-On Studio © 2026 — Todos os direitos reservados.<br/>"
        "Este guia é confidencial e destinado exclusivamente ao uso do contratante.",
        styles["footer"]
    ))

    # Build
    doc.build(story)
    print(f"PDF generated: {output_path}")
    print(f"Size: {os.path.getsize(output_path) / 1024:.1f} KB")


if __name__ == "__main__":
    output_dir = os.path.join(os.path.dirname(__file__), "..", "docs")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "guia-configuracao-whatsapp.pdf")
    build_pdf(output_path)