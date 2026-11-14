-- =============================================================================
-- Migration 023: Automation Triggers, Campaigns & System Event Integration
-- Barber-On Studio — FASE 7: Automações WhatsApp/Email
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: AUTOMATION_RULES (Regras de automação configuráveis)
-- Define quando e como enviar notificações automaticamente
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 description TEXT,
 event_type TEXT NOT NULL CHECK (event_type IN (
 'appointment_created', 'appointment_confirmed', 'appointment_cancelled',
 'appointment_reminder_24h', 'appointment_reminder_1h',
 'subscription_expiring_7d', 'subscription_expiring_3d', 'subscription_expired',
 'payment_received', 'payment_overdue',
 'customer_inactive_30d', 'customer_inactive_60d', 'customer_inactive_90d',
 'birthday', 'custom'
 )),
 channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
 template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
 is_active BOOLEAN NOT NULL DEFAULT true,
 delay_minutes INT NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
 max_per_day INT CHECK (max_per_day > 0),
 target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'subscribers', 'non_subscribers', 'custom')),
 filter_conditions JSONB DEFAULT '{}'::jsonb,
 last_triggered_at TIMESTAMPTZ,
 trigger_count INT NOT NULL DEFAULT 0,
 created_by UUID REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_event ON automation_rules(organization_id, event_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(organization_id, is_active) WHERE is_active = true;

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view automation rules"
 ON automation_rules FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage automation rules"
 ON automation_rules FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_automation_rules_updated_at
 BEFORE UPDATE ON automation_rules
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA: CAMPAIGNS (Campanhas de envio em massa)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 description TEXT,
 campaign_type TEXT NOT NULL CHECK (campaign_type IN (
 'reactivation', 'promotion', 'announcement', 'survey', 'seasonal', 'custom'
 )),
 channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms')),
 template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
 custom_body TEXT,
 custom_subject TEXT,
 target_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
 -- Ex: {"last_visit_before": "2026-10-01", "min_visits": 2, "has_subscription": false}
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled', 'failed')),
 scheduled_at TIMESTAMPTZ,
 started_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 total_recipients INT NOT NULL DEFAULT 0,
 sent_count INT NOT NULL DEFAULT 0,
 delivered_count INT NOT NULL DEFAULT 0,
 failed_count INT NOT NULL DEFAULT 0,
 opened_count INT NOT NULL DEFAULT 0,
 clicked_count INT NOT NULL DEFAULT 0,
 created_by UUID REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(organization_id, campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view campaigns"
 ON campaigns FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage campaigns"
 ON campaigns FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_campaigns_updated_at
 BEFORE UPDATE ON campaigns
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. TABELA: CAMPAIGN_RECIPIENTS (Destinatários individuais da campanha)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_recipients (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 recipient_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
 recipient_phone TEXT,
 recipient_email TEXT,
 recipient_name TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
 notification_log_id UUID REFERENCES notification_logs(id) ON DELETE SET NULL,
 error_message TEXT,
 metadata JSONB DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_profile ON campaign_recipients(recipient_profile_id);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view campaign recipients"
 ON campaign_recipients FOR SELECT
 USING (
 EXISTS (
 SELECT 1 FROM campaigns c
 WHERE c.id = campaign_recipients.campaign_id
 AND is_member_of(c.organization_id)
 )
 );

CREATE POLICY "Members can manage campaign recipients"
 ON campaign_recipients FOR ALL
 USING (
 EXISTS (
 SELECT 1 FROM campaigns c
 WHERE c.id = campaign_recipients.campaign_id
 AND is_member_of(c.organization_id)
 )
 )
 WITH CHECK (
 EXISTS (
 SELECT 1 FROM campaigns c
 WHERE c.id = campaign_recipients.campaign_id
 AND is_member_of(c.organization_id)
 )
 );

CREATE TRIGGER set_campaign_recipients_updated_at
 BEFORE UPDATE ON campaign_recipients
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. ADICIONAR CAMPOS EM NOTIFICATION_LOGS PARA INTEGRAÇÃO COM CAMPANHAS
-- -----------------------------------------------------------------------------
ALTER TABLE notification_logs
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_logs_campaign ON notification_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_automation ON notification_logs(automation_rule_id);

-- -----------------------------------------------------------------------------
-- 5. RPC: QUEUE_AUTOMATION_NOTIFICATION
-- Cria entrada pendente no notification_logs quando evento ocorre
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION queue_automation_notification(
 p_org_id UUID,
 p_event_type TEXT,
 p_recipient_id UUID,
 p_recipient_phone TEXT,
 p_recipient_email TEXT,
 p_reference_id UUID DEFAULT NULL,
 p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_rule RECORD;
 v_template RECORD;
 v_queued INT := 0;
 v_scheduled_at TIMESTAMPTZ;
BEGIN
 FOR v_rule IN
 SELECT ar.*, nt.body, nt.subject, nt.variables
 FROM automation_rules ar
 LEFT JOIN notification_templates nt ON nt.id = ar.template_id
 WHERE ar.organization_id = p_org_id
 AND ar.event_type = p_event_type
 AND ar.is_active = true
 LOOP
 -- Calcular delay
 v_scheduled_at := CASE
 WHEN v_rule.delay_minutes > 0 THEN now() + (v_rule.delay_minutes || ' minutes')::INTERVAL
 ELSE now()
 END;

 -- Verificar limite diário
 IF v_rule.max_per_day IS NOT NULL THEN
 IF (
 SELECT COUNT(*) FROM notification_logs
 WHERE organization_id = p_org_id
 AND automation_rule_id = v_rule.id
 AND created_at >= CURRENT_DATE::timestamptz
 ) >= v_rule.max_per_day THEN
 CONTINUE; -- Pular se atingiu limite
 END IF;
 END IF;

 -- Inserir na fila
 INSERT INTO notification_logs (
 organization_id, template_id, channel,
 recipient_type, recipient_id, recipient_phone, recipient_email,
 event_type, event_reference_id, status,
 scheduled_at, metadata, automation_rule_id
 ) VALUES (
 p_org_id, v_rule.template_id, v_rule.channel,
 'customer', p_recipient_id, p_recipient_phone, p_recipient_email,
 p_event_type, p_reference_id, 'pending',
 v_scheduled_at, COALESCE(p_metadata, '{}'::jsonb), v_rule.id
 );

 -- Atualizar contador da regra
 UPDATE automation_rules
 SET last_triggered_at = now(),
 trigger_count = trigger_count + 1
 WHERE id = v_rule.id;

 v_queued := v_queued + 1;
 END LOOP;

 RETURN v_queued;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: RESOLVE_CAMPAIGN_RECIPIENTS
-- Resolve destinatários baseado no filtro da campanha
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_campaign_recipients(
 p_campaign_id UUID
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_campaign RECORD;
 v_count INT := 0;
 v_cutoff_date DATE;
BEGIN
 SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;

 IF v_campaign IS NULL THEN
 RAISE EXCEPTION 'Campanha não encontrada: %', p_campaign_id;
 END IF;

 -- Limpar destinatários anteriores se houver
 DELETE FROM campaign_recipients WHERE campaign_id = p_campaign_id;

 -- Reativação: clientes inativos
 IF v_campaign.campaign_type = 'reactivation' THEN
 v_cutoff_date := CURRENT_DATE - (COALESCE((v_campaign.target_filter->>'inactive_days')::int, 30))::int;

 INSERT INTO campaign_recipients (campaign_id, recipient_profile_id, recipient_phone, recipient_name)
 SELECT DISTINCT
 p_campaign_id,
 p.id,
 p.phone,
 p.full_name
 FROM profiles p
 WHERE p.organization_id = v_campaign.organization_id
 AND p.phone IS NOT NULL
 AND p.phone != ''
 AND NOT EXISTS (
 SELECT 1 FROM calendar_events ce
 WHERE ce.customer_id = p.id
 AND ce.status = 'completed'
 AND ce.completed_at >= v_cutoff_date::timestamptz
 )
 AND NOT EXISTS (
 SELECT 1 FROM campaign_recipients cr
 WHERE cr.campaign_id = p_campaign_id AND cr.recipient_profile_id = p.id
 );

 GET DIAGNOSTICS v_count = ROW_COUNT;
 END IF;

 -- Promoção/Anúncio: todos os clientes ativos
 IF v_campaign.campaign_type IN ('promotion', 'announcement', 'seasonal') THEN
 INSERT INTO campaign_recipients (campaign_id, recipient_profile_id, recipient_phone, recipient_email, recipient_name)
 SELECT DISTINCT
 p_campaign_id,
 p.id,
 p.phone,
 p.email,
 p.full_name
 FROM profiles p
 WHERE p.organization_id = v_campaign.organization_id
 AND (p.phone IS NOT NULL OR p.email IS NOT NULL)
 AND NOT EXISTS (
 SELECT 1 FROM campaign_recipients cr
 WHERE cr.campaign_id = p_campaign_id AND cr.recipient_profile_id = p.id
 );

 GET DIAGNOSTICS v_count = ROW_COUNT;
 END IF;

 -- Atualizar total na campanha
 UPDATE campaigns
 SET total_recipients = v_count,
 updated_at = now()
 WHERE id = p_campaign_id;

 RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: GET_PENDING_AUTOMATION_EVENTS
-- Retorna eventos do sistema que precisam gerar notificações
-- Usado por cron job para processar lembretes e vencimentos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pending_automation_events(
 p_org_id UUID
) RETURNS TABLE (
 event_type TEXT,
 recipient_id UUID,
 recipient_phone TEXT,
 recipient_email TEXT,
 reference_id UUID,
 metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 RETURN QUERY
 -- Lembretes de agendamento 24h antes
 SELECT
 'appointment_reminder_24h'::TEXT,
 ce.customer_id,
 cp.phone,
 cp.email,
 ce.id,
 jsonb_build_object(
 'appointment_title', ce.title,
 'start_at', ce.start_at,
 'barber_name', bp.full_name,
 'service_name', bs.name
 )
 FROM calendar_events ce
 LEFT JOIN profiles cp ON cp.id = ce.customer_id
 LEFT JOIN memberships bm ON bm.id = ce.assigned_barber_id
 LEFT JOIN profiles bp ON bp.id = bm.user_id
 LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
 WHERE ce.organization_id = p_org_id
 AND ce.status IN ('scheduled', 'confirmed')
 AND ce.start_at BETWEEN now() + INTERVAL '23 hours' AND now() + INTERVAL '25 hours'
 AND ce.customer_id IS NOT NULL
 AND NOT EXISTS (
 SELECT 1 FROM notification_logs nl
 WHERE nl.organization_id = p_org_id
 AND nl.event_type = 'appointment_reminder_24h'
 AND nl.event_reference_id = ce.id
 AND nl.created_at >= CURRENT_DATE::timestamptz
 )

 UNION ALL

 -- Assinaturas expirando em 7 dias
 SELECT
 'subscription_expiring_7d'::TEXT,
 cs.customer_profile_id,
 cp.phone,
 cp.email,
 cs.id,
 jsonb_build_object(
 'plan_name', sp.name,
 'price', sp.price,
 'due_date', cs.current_period_end
 )
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 LEFT JOIN profiles cp ON cp.id = cs.customer_profile_id
 WHERE cs.organization_id = p_org_id
 AND cs.status IN ('active', 'trial')
 AND cs.current_period_end BETWEEN CURRENT_DATE + 6 AND CURRENT_DATE + 8
 AND NOT EXISTS (
 SELECT 1 FROM notification_logs nl
 WHERE nl.organization_id = p_org_id
 AND nl.event_type = 'subscription_expiring_7d'
 AND nl.event_reference_id = cs.id
 AND nl.created_at >= CURRENT_DATE::timestamptz - INTERVAL '6 days'
 )

 UNION ALL

 -- Assinaturas expirando em 3 dias
 SELECT
 'subscription_expiring_3d'::TEXT,
 cs.customer_profile_id,
 cp.phone,
 cp.email,
 cs.id,
 jsonb_build_object(
 'plan_name', sp.name,
 'price', sp.price,
 'due_date', cs.current_period_end
 )
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 LEFT JOIN profiles cp ON cp.id = cs.customer_profile_id
 WHERE cs.organization_id = p_org_id
 AND cs.status IN ('active', 'trial')
 AND cs.current_period_end BETWEEN CURRENT_DATE + 2 AND CURRENT_DATE + 4
 AND NOT EXISTS (
 SELECT 1 FROM notification_logs nl
 WHERE nl.organization_id = p_org_id
 AND nl.event_type = 'subscription_expiring_3d'
 AND nl.event_reference_id = cs.id
 AND nl.created_at >= CURRENT_DATE::timestamptz - INTERVAL '2 days'
 );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. VIEW: V_AUTOMATION_STATS
-- Estatísticas de automações e campanhas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_automation_stats AS
SELECT
 nl.organization_id,
 COUNT(*) FILTER (WHERE nl.created_at >= CURRENT_DATE::timestamptz) AS today_notifications,
 COUNT(*) FILTER (WHERE nl.created_at >= CURRENT_DATE::timestamptz AND nl.status = 'sent') AS today_sent,
 COUNT(*) FILTER (WHERE nl.created_at >= CURRENT_DATE::timestamptz AND nl.status = 'delivered') AS today_delivered,
 COUNT(*) FILTER (WHERE nl.created_at >= CURRENT_DATE::timestamptz AND nl.status = 'failed') AS today_failed,
 COUNT(*) FILTER (WHERE nl.status = 'pending') AS pending_queue,
 COUNT(DISTINCT nl.automation_rule_id) FILTER (WHERE nl.automation_rule_id IS NOT NULL) AS active_rules_triggered,
 COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'completed') AS completed_campaigns,
 SUM(c.sent_count) FILTER (WHERE c.status = 'completed') AS total_campaign_sends
FROM notification_logs nl
LEFT JOIN campaigns c ON c.id = nl.campaign_id
GROUP BY nl.organization_id;

-- -----------------------------------------------------------------------------
-- 9. SEED: Regras de automação padrão
-- -----------------------------------------------------------------------------
INSERT INTO automation_rules (organization_id, name, description, event_type, channel, delay_minutes, is_active)
SELECT
 o.id,
 r.name,
 r.description,
 r.event_type,
 r.channel,
 r.delay_minutes,
 r.is_active
FROM organizations o
CROSS JOIN (VALUES
 ('Confirmação de Agendamento', 'Notifica o cliente quando um agendamento é criado', 'appointment_created', 'whatsapp', 0, true),
 ('Lembrete 24h antes', 'Envia lembrete um dia antes do agendamento', 'appointment_reminder_24h', 'whatsapp', 0, true),
 ('Cancelamento de Agendamento', 'Notifica o cliente sobre cancelamento', 'appointment_cancelled', 'whatsapp', 0, true),
 ('Aviso de Vencimento 7 dias', 'Lembra o cliente 7 dias antes do vencimento da assinatura', 'subscription_expiring_7d', 'whatsapp', 0, true),
 ('Aviso de Vencimento 3 dias', 'Lembra o cliente 3 dias antes do vencimento da assinatura', 'subscription_expiring_3d', 'whatsapp', 0, true)
) AS r(name, description, event_type, channel, delay_minutes, is_active)
WHERE NOT EXISTS (
 SELECT 1 FROM automation_rules ar
 WHERE ar.organization_id = o.id AND ar.event_type = r.event_type
);