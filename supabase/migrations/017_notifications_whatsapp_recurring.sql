-- =============================================================================
-- Migration 017: Notifications, WhatsApp Config & Recurring Appointments
-- Barber-On Studio — Automações de notificação e agendamentos recorrentes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NOTIFICATION TEMPLATES (Modelos reutilizáveis de mensagens)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'booking_confirmation', 'booking_cancellation', 'booking_reminder',
    'subscription_expiry', 'subscription_payment', 'subscription_welcome',
    'reactivation_campaign', 'loyalty_reward', 'custom'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  subject TEXT, -- apenas para email
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- array de {name, description, example}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_org ON notification_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_category ON notification_templates(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(organization_id, channel);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view notification templates"
  ON notification_templates FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage notification templates"
  ON notification_templates FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. NOTIFICATION LOGS (Registro imutável de envios)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'professional', 'admin')),
  recipient_id UUID, -- profile_id ou membership_id
  recipient_phone TEXT,
  recipient_email TEXT,
  event_type TEXT NOT NULL, -- booking_confirmed, subscription_expiring, etc.
  event_reference_id UUID, -- id do agendamento, assinatura, etc.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'
  )),
  provider_message_id TEXT, -- ID retornado pelo provedor (WhatsApp/email)
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  scheduled_at TIMESTAMPTZ, -- quando deveria ser enviado
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb, -- dados dinâmicos usados no template
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_org ON notification_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON notification_logs(organization_id, event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_scheduled ON notification_logs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(organization_id, created_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view notification logs"
  ON notification_logs FOR SELECT
  USING (is_member_of(organization_id));

-- Logs são append-only via RPC — membros não podem editar/apagar diretamente
CREATE POLICY "System can insert notification logs"
  ON notification_logs FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. WHATSAPP CONFIG (Configuração da API por organização)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL, -- WhatsApp Business Account ID
  access_token_encrypted TEXT NOT NULL, -- token encriptado via pgcrypto
  webhook_verify_token TEXT, -- token para verificação do webhook
  is_active BOOLEAN NOT NULL DEFAULT false,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_hours_before INT NOT NULL DEFAULT 24 CHECK (reminder_hours_before >= 0),
  expiry_reminder_days INT NOT NULL DEFAULT 3 CHECK (expiry_reminder_days >= 0),
  rate_limit_per_minute INT NOT NULL DEFAULT 30 CHECK (rate_limit_per_minute > 0),
  last_webhook_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_org ON whatsapp_config(organization_id);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view whatsapp config"
  ON whatsapp_config FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Admins can manage whatsapp config"
  ON whatsapp_config FOR ALL
  USING (
    is_member_of(organization_id) AND
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = whatsapp_config.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    is_member_of(organization_id) AND
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = whatsapp_config.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE TRIGGER set_whatsapp_config_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. RECURRING APPOINTMENTS (Agendamentos recorrentes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recurring_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  barber_service_id UUID NOT NULL REFERENCES barber_services(id) ON DELETE CASCADE,
  recurrence_pattern TEXT NOT NULL CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly', 'custom')),
  recurrence_interval INT NOT NULL DEFAULT 1 CHECK (recurrence_interval > 0),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- obrigatório para weekly/biweekly
  day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31), -- obrigatório para monthly
  time_slot TIME NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE, -- null = indefinido
  next_occurrence DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_recurrence_day CHECK (
    (recurrence_pattern IN ('weekly', 'biweekly') AND day_of_week IS NOT NULL) OR
    (recurrence_pattern = 'monthly' AND day_of_month IS NOT NULL) OR
    (recurrence_pattern = 'custom')
  ),
  CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_appts_org ON recurring_appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appts_customer ON recurring_appointments(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appts_barber ON recurring_appointments(membership_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appts_next ON recurring_appointments(next_occurrence) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_appts_active ON recurring_appointments(organization_id, is_active);

ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view recurring appointments"
  ON recurring_appointments FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage recurring appointments"
  ON recurring_appointments FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_recurring_appointments_updated_at
  BEFORE UPDATE ON recurring_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. RECURRING APPOINTMENT OCCURRENCES (Ocorrências geradas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recurring_appointment_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_appointment_id UUID NOT NULL REFERENCES recurring_appointments(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  appointment_id UUID REFERENCES public_bookings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'booked', 'completed', 'cancelled', 'skipped'
  )),
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recurring_appointment_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_occ_parent ON recurring_appointment_occurrences(recurring_appointment_id);
CREATE INDEX IF NOT EXISTS idx_recurring_occ_date ON recurring_appointment_occurrences(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_recurring_occ_status ON recurring_appointment_occurrences(status);

ALTER TABLE recurring_appointment_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view recurring occurrences"
  ON recurring_appointment_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recurring_appointments ra
      WHERE ra.id = recurring_appointment_occurrences.recurring_appointment_id
        AND is_member_of(ra.organization_id)
    )
  );

CREATE POLICY "Members can manage recurring occurrences"
  ON recurring_appointment_occurrences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recurring_appointments ra
      WHERE ra.id = recurring_appointment_occurrences.recurring_appointment_id
        AND is_member_of(ra.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_appointments ra
      WHERE ra.id = recurring_appointment_occurrences.recurring_appointment_id
        AND is_member_of(ra.organization_id)
    )
  );

CREATE TRIGGER set_recurring_occurrences_updated_at
  BEFORE UPDATE ON recurring_appointment_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. RPC: generate_recurring_occurrences
-- Gera ocorrências futuras para agendamentos recorrentes ativos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_recurring_occurrences(
  p_org_id UUID,
  p_days_ahead INT DEFAULT 30
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
  v_next_date DATE;
  v_end_check DATE;
BEGIN
  FOR v_rec IN
    SELECT * FROM recurring_appointments
    WHERE organization_id = p_org_id
      AND is_active = true
      AND (next_occurrence IS NULL OR next_occurrence <= CURRENT_DATE + p_days_ahead)
  LOOP
    v_next_date := COALESCE(v_rec.next_occurrence, v_rec.start_date);
    v_end_check := CURRENT_DATE + p_days_ahead;

    WHILE v_next_date <= v_end_check LOOP
      -- Pular datas passadas
      IF v_next_date < CURRENT_DATE THEN
        -- Avançar para próxima ocorrência
        IF v_rec.recurrence_pattern = 'weekly' THEN
          v_next_date := v_next_date + 7;
        ELSIF v_rec.recurrence_pattern = 'biweekly' THEN
          v_next_date := v_next_date + 14;
        ELSIF v_rec.recurrence_pattern = 'monthly' THEN
          v_next_date := v_next_date + INTERVAL '1 month';
        ELSE
          EXIT; -- custom sem lógica automática
        END IF;
        CONTINUE;
      END IF;

      -- Verificar se já existe ocorrência nesta data
      IF NOT EXISTS (
        SELECT 1 FROM recurring_appointment_occurrences
        WHERE recurring_appointment_id = v_rec.id
          AND occurrence_date = v_next_date
      ) THEN
        INSERT INTO recurring_appointment_occurrences (
          recurring_appointment_id, occurrence_date, status
        ) VALUES (
          v_rec.id, v_next_date, 'scheduled'
        );
        v_count := v_count + 1;
      END IF;

      -- Avançar para próxima ocorrência
      IF v_rec.recurrence_pattern = 'weekly' THEN
        v_next_date := v_next_date + 7;
      ELSIF v_rec.recurrence_pattern = 'biweekly' THEN
        v_next_date := v_next_date + 14;
      ELSIF v_rec.recurrence_pattern = 'monthly' THEN
        v_next_date := v_next_date + INTERVAL '1 month';
      ELSE
        EXIT;
      END IF;
    END LOOP;

    -- Atualizar next_occurrence
    UPDATE recurring_appointments
    SET next_occurrence = v_next_date
    WHERE id = v_rec.id;
  END LOOP;

  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: get_pending_notifications
-- Retorna notificações pendentes prontas para envio
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pending_notifications(
  p_org_id UUID,
  p_limit INT DEFAULT 50
) RETURNS TABLE (
  log_id UUID,
  channel TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  body TEXT,
  subject TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.id,
    nl.channel,
    nl.recipient_phone,
    nl.recipient_email,
    nt.body,
    nt.subject,
    nl.metadata
  FROM notification_logs nl
  LEFT JOIN notification_templates nt ON nt.id = nl.template_id
  WHERE nl.organization_id = p_org_id
    AND nl.status = 'pending'
    AND (nl.scheduled_at IS NULL OR nl.scheduled_at <= now())
    AND nl.retry_count < nl.max_retries
  ORDER BY nl.scheduled_at ASC NULLS FIRST, nl.created_at ASC
  LIMIT p_limit;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: update_notification_status
-- Atualiza status de uma notificação após tentativa de envio
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_notification_status(
  p_log_id UUID,
  p_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notification_logs
  SET
    status = p_status,
    provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
    error_message = COALESCE(p_error_message, error_message),
    retry_count = CASE WHEN p_status = 'failed' THEN retry_count + 1 ELSE retry_count END,
    sent_at = CASE WHEN p_status IN ('sent', 'delivered', 'read') AND sent_at IS NULL THEN now() ELSE sent_at END,
    delivered_at = CASE WHEN p_status IN ('delivered', 'read') AND delivered_at IS NULL THEN now() ELSE delivered_at END,
    read_at = CASE WHEN p_status = 'read' AND read_at IS NULL THEN now() ELSE read_at END,
    failed_at = CASE WHEN p_status = 'failed' THEN now() ELSE failed_at END,
    updated_at = now()
  WHERE id = p_log_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. SEED: Templates padrão de notificação
-- -----------------------------------------------------------------------------
INSERT INTO notification_templates (organization_id, name, category, channel, body, variables)
SELECT
  o.id,
  t.name,
  t.category,
  t.channel,
  t.body,
  t.variables
FROM organizations o
CROSS JOIN (VALUES
  ('Confirmação de Agendamento', 'booking_confirmation', 'whatsapp',
   'Olá {{customer_name}}! ✅ Seu agendamento foi confirmado.' || E'\n\n' ||
   '📅 Data: {{date}}' || E'\n' ||
   '⏰ Horário: {{time}}' || E'\n' ||
   '💇 Serviço: {{service_name}}' || E'\n' ||
   '💰 Valor: {{price}}' || E'\n\n' ||
   '{{shop_name}} - {{shop_address}}',
   '[{"name":"customer_name","description":"Nome do cliente","example":"João"},{"name":"date","description":"Data do agendamento","example":"15/11/2026"},{"name":"time","description":"Horário","example":"14:00"},{"name":"service_name","description":"Nome do serviço","example":"Corte + Barba"},{"name":"price","description":"Valor formatado","example":"R$ 45,00"},{"name":"shop_name","description":"Nome da barbearia","example":"Barber-On Studio"},{"name":"shop_address","description":"Endereço","example":"Rua X, 123"}]'::jsonb),

  ('Aviso de Vencimento de Assinatura', 'subscription_expiry', 'whatsapp',
   'Olá {{customer_name}}! 👋' || E'\n\n' ||
   'Seu plano {{plan_name}} está próximo do vencimento.' || E'\n' ||
   '💰 Valor: {{price}}' || E'\n' ||
   '📅 Vencimento: {{due_date}}' || E'\n\n' ||
   'Renove para continuar aproveitando seus benefícios! 💈',
   '[{"name":"customer_name","description":"Nome do cliente","example":"Maria"},{"name":"plan_name","description":"Nome do plano","example":"Barber Premium"},{"name":"price","description":"Valor","example":"R$ 89,90"},{"name":"due_date","description":"Data de vencimento","example":"20/11/2026"}]'::jsonb),

  ('Lembrete de Agendamento', 'booking_reminder', 'whatsapp',
   'Olá {{customer_name}}! ⏰' || E'\n\n' ||
   'Lembrando do seu agendamento amanhã:' || E'\n' ||
   '📅 {{date}} às {{time}}' || E'\n' ||
   '💇 {{service_name}}' || E'\n\n' ||
   'Em caso de imprevisto, avise-nos com antecedência. 🙏',
   '[{"name":"customer_name","description":"Nome do cliente","example":"Pedro"},{"name":"date","description":"Data","example":"16/11/2026"},{"name":"time","description":"Horário","example":"10:00"},{"name":"service_name","description":"Serviço","example":"Barba"}]'::jsonb)
) AS t(name, category, channel, body, variables)
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.organization_id = o.id AND nt.name = t.name
);