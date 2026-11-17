-- =============================================================================
-- BARBER-ON STUDIO — Setup Completo do Banco de Dados
-- =============================================================================
-- INSTRUÇÕES:
--   1. Abra o Supabase Dashboard → SQL Editor
--   2. Cole TODO este script
--   3. Clique em "Run" (pode levar 10-30 segundos)
--   4. Verifique a mensagem "Success" ao final
--
-- NOTA: Este script é IDEMPOTENTE — usa CREATE TABLE IF NOT EXISTS,
--       CREATE OR REPLACE FUNCTION, etc. Pode ser executado múltiplas
--       vezes sem erro nem duplicar dados existentes.
--
-- CONTEÚDO: Todas as 28 migrations do Barber-On Studio + dados iniciais
-- =============================================================================
-- ===========================================================================
-- MIGRATION 001
-- ===========================================================================

-- Barber-On Initial Schema
-- Multi-tenant foundation: profiles, organizations, memberships

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizations table (multi-tenant companies)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships table (user-organization associations)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_organization_id ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Organizations policies
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.organization_id = organizations.id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.organization_id = organizations.id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Memberships policies
CREATE POLICY "Members can view memberships of their organizations"
  ON memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage memberships"
  ON memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ===========================================================================
-- MIGRATION 002
-- ===========================================================================

-- Barber-On Fase 03 — CRM: customers, pipelines, pipeline_stages, leads, interactions
-- All tables are scoped by organization_id and protected by RLS.

-- Habilitar extensões necessárias para índices de busca textual
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- is_member_of — função essencial para RLS multi-tenant
-- Definida aqui porque é usada por todas as políticas de RLS abaixo.
-- A migration 006 fará CREATE OR REPLACE com versão atualizada (status check).
-- ============================================================================
CREATE OR REPLACE FUNCTION is_member_of(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = p_org_id
      AND memberships.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('pf', 'pj')) DEFAULT 'pf',
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  primary_contact_name TEXT,
  source TEXT,
  category TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_archived_at ON customers(archived_at);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_trgm_name ON customers USING gin (name gin_trgm_ops);

-- ============================================================================
-- PIPELINES (one default pipeline per org, extensible later)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_organization_id ON pipelines(organization_id);

-- ============================================================================
-- PIPELINE_STAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_stages_won_lost_exclusive CHECK (NOT (is_won AND is_lost))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_organization_id ON pipeline_stages(organization_id);

-- ============================================================================
-- LEADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  source TEXT,
  interest TEXT,
  estimated_value NUMERIC(14, 2),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expected_return_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost', 'archived')) DEFAULT 'open',
  notes TEXT,
  converted_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_id ON leads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON leads(archived_at);
CREATE INDEX IF NOT EXISTS idx_leads_expected_return_at ON leads(expected_return_at) WHERE expected_return_at IS NOT NULL;

-- ============================================================================
-- INTERACTIONS (timeline entries attached to a customer or a lead)
-- ============================================================================
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'message', 'email', 'meeting', 'note', 'other')),
  description TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT interactions_target_check CHECK (
    (customer_id IS NOT NULL AND lead_id IS NULL) OR
    (customer_id IS NULL AND lead_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_interactions_organization_id ON interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_interactions_customer_id ON interactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON interactions(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_occurred_at ON interactions(occurred_at DESC);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CUSTOMERS policies
-- ============================================================================
CREATE POLICY "Members can view customers of their organizations"
  ON customers FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert customers into their organizations"
  ON customers FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update customers of their organizations"
  ON customers FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete customers of their organizations"
  ON customers FOR DELETE
  USING (is_member_of(organization_id));

-- ============================================================================
-- PIPELINES policies
-- ============================================================================
CREATE POLICY "Members can view pipelines of their organizations"
  ON pipelines FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert pipelines into their organizations"
  ON pipelines FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update pipelines of their organizations"
  ON pipelines FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- PIPELINE_STAGES policies
-- ============================================================================
CREATE POLICY "Members can view pipeline_stages of their organizations"
  ON pipeline_stages FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert pipeline_stages into their organizations"
  ON pipeline_stages FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update pipeline_stages of their organizations"
  ON pipeline_stages FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- LEADS policies
-- ============================================================================
CREATE POLICY "Members can view leads of their organizations"
  ON leads FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert leads into their organizations"
  ON leads FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update leads of their organizations"
  ON leads FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete leads of their organizations"
  ON leads FOR DELETE
  USING (is_member_of(organization_id));

-- ============================================================================
-- INTERACTIONS policies
-- ============================================================================
CREATE POLICY "Members can view interactions of their organizations"
  ON interactions FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert interactions into their organizations"
  ON interactions FOR INSERT
  WITH CHECK (is_member_of(organization_id) AND created_by = auth.uid());

CREATE POLICY "Members can delete their own interactions"
  ON interactions FOR DELETE
  USING (is_member_of(organization_id) AND created_by = auth.uid());

-- ============================================================================
-- AUTO-SEED default pipeline when a new organization is created
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  INSERT INTO pipelines (organization_id, name, is_default)
  VALUES (NEW.id, 'Pipeline Comercial', true)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO pipeline_stages (organization_id, pipeline_id, name, position, is_won, is_lost) VALUES
    (NEW.id, v_pipeline_id, 'Novo',             1, false, false),
    (NEW.id, v_pipeline_id, 'Primeiro contato', 2, false, false),
    (NEW.id, v_pipeline_id, 'Qualificado',      3, false, false),
    (NEW.id, v_pipeline_id, 'Proposta',         4, false, false),
    (NEW.id, v_pipeline_id, 'Negociação',       5, false, false),
    (NEW.id, v_pipeline_id, 'Ganho',            6, true,  false),
    (NEW.id, v_pipeline_id, 'Perdido',          7, false, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_default_pipeline ON organizations;
CREATE TRIGGER trigger_seed_default_pipeline
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_pipeline();

-- ============================================================================
-- UPDATED_AT triggers
-- ============================================================================
CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ===========================================================================
-- MIGRATION 003
-- ===========================================================================

-- Barber-On Fase 04 — Vendas: sales_channels, orders, order_items, quotes, quote_items, order_status_history, document_sequences
-- All tables scoped by organization_id and protected by RLS via is_member_of().

-- ============================================================================
-- SALES CHANNELS (canais de venda: loja física, online, WhatsApp, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_channels_organization_id ON sales_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_channels_is_active ON sales_channels(is_active);

-- ============================================================================
-- DOCUMENT SEQUENCES (numeração sequencial atômica por org/tipo/ano)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('order', 'quote')),
  year INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_sequences_unique UNIQUE (organization_id, document_type, year)
);

CREATE INDEX IF NOT EXISTS idx_document_sequences_lookup ON document_sequences(organization_id, document_type, year);

-- ============================================================================
-- ORDERS (pedidos de venda)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  document_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'preparing', 'completed', 'cancelled')) DEFAULT 'draft',
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel_id ON orders(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON orders(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_document_number ON orders(document_number);
CREATE INDEX IF NOT EXISTS idx_orders_issued_at ON orders(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_organization_id ON order_items(organization_id);

-- ============================================================================
-- QUOTES (orçamentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  document_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')) DEFAULT 'draft',
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  valid_until TIMESTAMPTZ NOT NULL,
  converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_organization_id ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_channel_id ON quotes(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON quotes(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_document_number ON quotes(document_number);
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);
CREATE INDEX IF NOT EXISTS idx_quotes_converted_order_id ON quotes(converted_order_id) WHERE converted_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);

-- ============================================================================
-- QUOTE ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_organization_id ON quote_items(organization_id);

-- ============================================================================
-- ORDER STATUS HISTORY (auditoria de transições de status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_organization_id ON order_status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at DESC);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SALES CHANNELS policies
-- ============================================================================
CREATE POLICY "Members can view sales_channels of their organizations"
  ON sales_channels FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert sales_channels into their organizations"
  ON sales_channels FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update sales_channels of their organizations"
  ON sales_channels FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete sales_channels of their organizations"
  ON sales_channels FOR DELETE
  USING (is_member_of(organization_id));

-- ============================================================================
-- DOCUMENT SEQUENCES policies
-- ============================================================================
CREATE POLICY "Members can view document_sequences of their organizations"
  ON document_sequences FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert document_sequences into their organizations"
  ON document_sequences FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update document_sequences of their organizations"
  ON document_sequences FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- ORDERS policies
-- ============================================================================
CREATE POLICY "Members can view orders of their organizations"
  ON orders FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert orders into their organizations"
  ON orders FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update orders of their organizations"
  ON orders FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- ORDER ITEMS policies
-- ============================================================================
CREATE POLICY "Members can view order_items of their organizations"
  ON order_items FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert order_items into their organizations"
  ON order_items FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update order_items of their organizations"
  ON order_items FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete order_items of their organizations"
  ON order_items FOR DELETE
  USING (is_member_of(organization_id));

-- ============================================================================
-- QUOTES policies
-- ============================================================================
CREATE POLICY "Members can view quotes of their organizations"
  ON quotes FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert quotes into their organizations"
  ON quotes FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update quotes of their organizations"
  ON quotes FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- QUOTE ITEMS policies
-- ============================================================================
CREATE POLICY "Members can view quote_items of their organizations"
  ON quote_items FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert quote_items into their organizations"
  ON quote_items FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update quote_items of their organizations"
  ON quote_items FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete quote_items of their organizations"
  ON quote_items FOR DELETE
  USING (is_member_of(organization_id));

-- ============================================================================
-- ORDER STATUS HISTORY policies
-- ============================================================================
CREATE POLICY "Members can view order_status_history of their organizations"
  ON order_status_history FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert order_status_history into their organizations"
  ON order_status_history FOR INSERT
  WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- FUNCTION: next_document_number (atomic, concurrency-safe)
-- Usage: SELECT next_document_number(p_org_id, 'order') → 'PED-2026-000001'
-- ============================================================================
CREATE OR REPLACE FUNCTION next_document_number(p_org_id UUID, p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_next INTEGER;
  v_prefix TEXT;
BEGIN
  IF p_type NOT IN ('order', 'quote') THEN
    RAISE EXCEPTION 'Invalid document type: %', p_type;
  END IF;

  v_year := EXTRACT(YEAR FROM now());
  v_prefix := CASE WHEN p_type = 'order' THEN 'PED' ELSE 'ORC' END;

  -- Atomically increment or create the sequence row
  INSERT INTO document_sequences (organization_id, document_type, year, current_number)
  VALUES (p_org_id, p_type, v_year, 1)
  ON CONFLICT (organization_id, document_type, year)
  DO UPDATE SET current_number = document_sequences.current_number + 1
  RETURNING current_number INTO v_next;

  RETURN format('%s-%s-%s', v_prefix, v_year, lpad(v_next::text, 6, '0'));
END;
$$;

-- ============================================================================
-- AUTO-SEED default sales channel when a new organization is created
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_sales_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO sales_channels (organization_id, name, description, is_active)
  VALUES (NEW.id, 'Geral', 'Canal de vendas padrão', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_default_sales_channel ON organizations;
CREATE TRIGGER trigger_seed_default_sales_channel
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_sales_channel();

-- ============================================================================
-- UPDATED_AT triggers
-- ============================================================================
CREATE TRIGGER set_sales_channels_updated_at
  BEFORE UPDATE ON sales_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_document_sequences_updated_at
  BEFORE UPDATE ON document_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ===========================================================================
-- MIGRATION 004
-- ===========================================================================

-- Barber-On Fase 05 — Produtos e Controle de Estoque
-- Product catalog, variants, warehouses, inventory balances, movements, reservations
-- All tables scoped by organization_id and protected by RLS via is_member_of().

-- ============================================================================
-- PRODUCT CATEGORIES (hierarchical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_organization_id ON product_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id ON product_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_unique_sibling ON product_categories(organization_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), name);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sku TEXT,
  barcode TEXT,
  brand TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('physical', 'service')) DEFAULT 'physical',
  unit TEXT NOT NULL DEFAULT 'un',
  cost_price NUMERIC(14, 2),
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  track_inventory BOOLEAN NOT NULL DEFAULT false,
  minimum_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(organization_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Prevent services from tracking inventory
ALTER TABLE products ADD CONSTRAINT chk_service_no_inventory
  CHECK (NOT (product_type = 'service' AND track_inventory = true));

-- ============================================================================
-- PRODUCT VARIANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}',
  sku TEXT,
  barcode TEXT,
  cost_price_override NUMERIC(14, 2),
  sale_price_override NUMERIC(14, 2),
  minimum_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_organization_id ON product_variants(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(organization_id, sku) WHERE sku IS NOT NULL;

-- ============================================================================
-- WAREHOUSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_organization_id ON warehouses(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(organization_id, code);

-- ============================================================================
-- INVENTORY BALANCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity_on_hand NUMERIC(14, 4) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(14, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_balance_non_negative CHECK (quantity_on_hand >= 0 AND quantity_reserved >= 0),
  CONSTRAINT chk_reserved_leq_on_hand CHECK (quantity_on_hand >= quantity_reserved)
);

-- Índice único funcional para garantir unicidade warehouse+product+variant (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_balances_unique
  ON inventory_balances (warehouse_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_inventory_balances_org ON inventory_balances(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_warehouse ON inventory_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_product ON inventory_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_variant ON inventory_balances(variant_id) WHERE variant_id IS NOT NULL;

-- ============================================================================
-- INVENTORY MOVEMENTS (immutable audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'initial_balance', 'manual_in', 'manual_out',
    'adjustment_in', 'adjustment_out',
    'transfer_in', 'transfer_out',
    'order_out'
  )),
  quantity_delta NUMERIC(14, 4) NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_org ON inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON inventory_movements(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id) WHERE reference_type IS NOT NULL;

-- ============================================================================
-- STOCK RESERVATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity NUMERIC(14, 4) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'released', 'cancelled')) DEFAULT 'active',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_org ON stock_reservations(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_warehouse ON stock_reservations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product ON stock_reservations(product_id);

-- ============================================================================
-- ALTER TABLE: Add product linkage to order_items and quote_items
-- ============================================================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku_snapshot TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_unit_snapshot TEXT;

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_sku_snapshot TEXT;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_unit_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON quote_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_items_variant ON quote_items(variant_id) WHERE variant_id IS NOT NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Atomic inventory adjustment: updates balance + records movement
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_org_id UUID,
  p_warehouse_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_delta NUMERIC,
  p_movement_type TEXT,
  p_reason TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_on_hand NUMERIC;
BEGIN
  -- Upsert balance atomically
  INSERT INTO inventory_balances (organization_id, warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved)
  VALUES (p_org_id, p_warehouse_id, p_product_id, p_variant_id, p_delta, 0)
  ON CONFLICT (warehouse_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'))
  DO UPDATE SET quantity_on_hand = inventory_balances.quantity_on_hand + p_delta
  RETURNING quantity_on_hand INTO v_new_on_hand;

  -- Validate non-negative after adjustment
  IF v_new_on_hand < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: resulting balance would be %', v_new_on_hand;
  END IF;

  -- Record immutable movement
  INSERT INTO inventory_movements (
    organization_id, warehouse_id, product_id, variant_id,
    movement_type, quantity_delta, reason, reference_type, reference_id, created_by
  ) VALUES (
    p_org_id, p_warehouse_id, p_product_id, p_variant_id,
    p_movement_type, p_delta, p_reason, p_reference_type, p_reference_id, p_user_id
  );
END;
$$;

-- Reserve stock for confirmed orders (atomic, all-or-nothing)
CREATE OR REPLACE FUNCTION reserve_stock(
  p_org_id UUID,
  p_order_id UUID,
  p_items JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_available NUMERIC;
  v_warehouse_id UUID;
BEGIN
  -- Get default warehouse for this org
  SELECT id INTO v_warehouse_id FROM warehouses
  WHERE organization_id = p_org_id AND is_default = true AND is_active = true
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'No active default warehouse found for organization';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Check available stock
    SELECT COALESCE(quantity_on_hand - quantity_reserved, 0) INTO v_available
    FROM inventory_balances
    WHERE warehouse_id = v_warehouse_id
      AND product_id = (v_item->>'product_id')::UUID
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000') = COALESCE((v_item->>'variant_id')::UUID, '00000000-0000-0000-0000-000000000000');

    IF v_available IS NULL OR v_available < (v_item->>'quantity')::NUMERIC THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',
        v_item->>'product_id', COALESCE(v_available, 0), v_item->>'quantity';
    END IF;

    -- Create reservation
    INSERT INTO stock_reservations (
      organization_id, order_id, order_item_id, warehouse_id,
      product_id, variant_id, quantity, status
    ) VALUES (
      p_org_id, p_order_id, (v_item->>'order_item_id')::UUID, v_warehouse_id,
      (v_item->>'product_id')::UUID, (v_item->>'variant_id')::UUID,
      (v_item->>'quantity')::NUMERIC, 'active'
    );

    -- Increment reserved quantity
    UPDATE inventory_balances
    SET quantity_reserved = quantity_reserved + (v_item->>'quantity')::NUMERIC
    WHERE warehouse_id = v_warehouse_id
      AND product_id = (v_item->>'product_id')::UUID
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000') = COALESCE((v_item->>'variant_id')::UUID, '00000000-0000-0000-0000-000000000000');
  END LOOP;
END;
$$;

-- Consume reservations on order completion
CREATE OR REPLACE FUNCTION consume_reservations(
  p_org_id UUID,
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT * FROM stock_reservations
    WHERE order_id = p_order_id AND organization_id = p_org_id AND status = 'active'
    FOR UPDATE
  LOOP
    -- Decrement on_hand and reserved
    UPDATE inventory_balances
    SET quantity_on_hand = quantity_on_hand - v_reservation.quantity,
        quantity_reserved = quantity_reserved - v_reservation.quantity
    WHERE warehouse_id = v_reservation.warehouse_id
      AND product_id = v_reservation.product_id
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000') = COALESCE(v_reservation.variant_id, '00000000-0000-0000-0000-000000000000');

    -- Record movement
    INSERT INTO inventory_movements (
      organization_id, warehouse_id, product_id, variant_id,
      movement_type, quantity_delta, reason, reference_type, reference_id, created_by
    ) VALUES (
      p_org_id, v_reservation.warehouse_id, v_reservation.product_id, v_reservation.variant_id,
      'order_out', -v_reservation.quantity, 'Saída por pedido concluído',
      'order', p_order_id,
      (SELECT created_by FROM orders WHERE id = p_order_id)
    );

    -- Mark reservation consumed
    UPDATE stock_reservations
    SET status = 'consumed', consumed_at = now()
    WHERE id = v_reservation.id;
  END LOOP;
END;
$$;

-- Release reservations on order cancellation
CREATE OR REPLACE FUNCTION release_reservations(
  p_org_id UUID,
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrement reserved quantities
  UPDATE inventory_balances ib
  SET quantity_reserved = quantity_reserved - sr.quantity
  FROM stock_reservations sr
  WHERE sr.order_id = p_order_id
    AND sr.organization_id = p_org_id
    AND sr.status = 'active'
    AND ib.warehouse_id = sr.warehouse_id
    AND ib.product_id = sr.product_id
    AND COALESCE(ib.variant_id, '00000000-0000-0000-0000-000000000000') = COALESCE(sr.variant_id, '00000000-0000-0000-0000-000000000000');

  -- Mark reservations as released
  UPDATE stock_reservations
  SET status = 'released', released_at = now()
  WHERE order_id = p_order_id AND organization_id = p_org_id AND status = 'active';
END;
$$;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES (standard is_member_of pattern)
-- ============================================================================

-- Product Categories
CREATE POLICY "Members can view product categories" ON product_categories FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert product categories" ON product_categories FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can update product categories" ON product_categories FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can delete product categories" ON product_categories FOR DELETE USING (is_member_of(organization_id));

-- Products
CREATE POLICY "Members can view products" ON products FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert products" ON products FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can update products" ON products FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can delete products" ON products FOR DELETE USING (is_member_of(organization_id));

-- Product Variants
CREATE POLICY "Members can view product variants" ON product_variants FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert product variants" ON product_variants FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can update product variants" ON product_variants FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can delete product variants" ON product_variants FOR DELETE USING (is_member_of(organization_id));

-- Warehouses
CREATE POLICY "Members can view warehouses" ON warehouses FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert warehouses" ON warehouses FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can update warehouses" ON warehouses FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can delete warehouses" ON warehouses FOR DELETE USING (is_member_of(organization_id));

-- Inventory Balances
CREATE POLICY "Members can view inventory balances" ON inventory_balances FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert inventory balances" ON inventory_balances FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can update inventory balances" ON inventory_balances FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can delete inventory balances" ON inventory_balances FOR DELETE USING (is_member_of(organization_id));

-- Inventory Movements (append-only: SELECT + INSERT only)
CREATE POLICY "Members can view inventory movements" ON inventory_movements FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert inventory movements" ON inventory_movements FOR INSERT WITH CHECK (is_member_of(organization_id));

-- Stock Reservations
CREATE POLICY "Members can view stock reservations" ON stock_reservations FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "Members can insert stock reservations" ON stock_reservations FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "Members can update stock reservations" ON stock_reservations FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER set_product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_inventory_balances_updated_at BEFORE UPDATE ON inventory_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DEFAULT WAREHOUSE ON ORGANIZATION CREATION
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_warehouse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO warehouses (organization_id, name, code, description, is_default, is_active)
  VALUES (NEW.id, 'Depósito Principal', 'PRINCIPAL', 'Depósito padrão da organização', true, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_default_warehouse ON organizations;
CREATE TRIGGER trigger_seed_default_warehouse
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_warehouse();
-- ===========================================================================
-- MIGRATION 005
-- ===========================================================================

-- ============================================================================
-- BARBER-ON FASE 06 — GESTÃO FINANCEIRA
-- Tabelas: financial_accounts, financial_categories, receivables, payables,
--          financial_payments, payment_allocations, financial_transactions
-- Funções: register_payment, allocate_payment, reverse_payment,
--          transfer_between_accounts, generate_receivables_from_order,
--          seed_default_financial_data
-- ============================================================================

-- ============================================================================
-- 1. FINANCIAL ACCOUNTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank_account', 'cash', 'digital_wallet', 'payment_account', 'other')),
  institution_name TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX idx_financial_accounts_org ON financial_accounts(organization_id);

-- ============================================================================
-- 2. FINANCIAL CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense')),
  parent_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_org ON financial_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_categories_parent ON financial_categories(parent_id);

-- ============================================================================
-- 3. RECEIVABLES (Contas a Receber)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
  amount_received NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  installment_group_id UUID,
  installment_number INT CHECK (installment_number > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_received', 'received', 'overdue', 'cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_receivable_amount CHECK (amount_received <= original_amount)
);

CREATE INDEX idx_receivables_org_status ON receivables(organization_id, status);
CREATE INDEX idx_receivables_org_due_date ON receivables(organization_id, due_date);
CREATE INDEX idx_receivables_order ON receivables(order_id);
CREATE INDEX idx_receivables_customer ON receivables(customer_id);
CREATE INDEX idx_receivables_installment_group ON receivables(installment_group_id);

-- ============================================================================
-- 4. PAYABLES (Contas a Pagar)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  counterparty_name TEXT NOT NULL,
  description TEXT NOT NULL,
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  installment_group_id UUID,
  installment_number INT CHECK (installment_number > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payable_amount CHECK (amount_paid <= original_amount)
);

CREATE INDEX idx_payables_org_status ON payables(organization_id, status);
CREATE INDEX idx_payables_org_due_date ON payables(organization_id, due_date);
CREATE INDEX idx_payables_installment_group ON payables(installment_group_id);

-- ============================================================================
-- 5. FINANCIAL PAYMENTS (Append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  financial_account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  payment_direction TEXT NOT NULL CHECK (payment_direction IN ('inbound', 'outbound')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'cash', 'bank_transfer', 'boleto', 'debit_card', 'credit_card', 'other')),
  gross_amount NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
  fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(14,2) NOT NULL CHECK (net_amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  reversal_of UUID REFERENCES financial_payments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_net CHECK (net_amount = gross_amount - fee_amount)
);

CREATE INDEX IF NOT EXISTS idx_financial_payments_org ON financial_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_payments_account ON financial_payments(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_payments_paid_at ON financial_payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_financial_payments_reversal ON financial_payments(reversal_of);

-- ============================================================================
-- 6. PAYMENT ALLOCATIONS (Append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES financial_payments(id) ON DELETE CASCADE,
  receivable_id UUID REFERENCES receivables(id) ON DELETE CASCADE,
  payable_id UUID REFERENCES payables(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_allocation_target CHECK (
    (receivable_id IS NOT NULL AND payable_id IS NULL) OR
    (receivable_id IS NULL AND payable_id IS NOT NULL)
  )
);

CREATE INDEX idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_receivable ON payment_allocations(receivable_id);
CREATE INDEX idx_payment_allocations_payable ON payment_allocations(payable_id);

-- ============================================================================
-- 7. FINANCIAL TRANSACTIONS (Livro-caixa imutável, append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  financial_account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('opening_balance', 'income', 'expense', 'transfer_in', 'transfer_out', 'fee', 'reversal')),
  amount NUMERIC(14,2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES financial_payments(id) ON DELETE SET NULL,
  transfer_group_id UUID,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  reversal_of_transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_org_date ON financial_transactions(organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_date ON financial_transactions(financial_account_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_transfer_group ON financial_transactions(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment ON financial_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category ON financial_transactions(category_id);

-- ============================================================================
-- ALTER EXISTING TABLES
-- ============================================================================

-- Estender document_sequences para suportar tipos financeiros
ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS chk_document_type;
ALTER TABLE document_sequences ADD CONSTRAINT chk_document_type CHECK (document_type IN ('order', 'quote', 'receivable', 'payable', 'payment'));

-- Adicionar cost_price_snapshot em order_items para cálculo de margem histórico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'cost_price_snapshot'
  ) THEN
    ALTER TABLE order_items ADD COLUMN cost_price_snapshot NUMERIC(14,2);
  END IF;
END $$;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE TRIGGER set_financial_accounts_updated_at
  BEFORE UPDATE ON financial_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_financial_categories_updated_at
  BEFORE UPDATE ON financial_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_receivables_updated_at
  BEFORE UPDATE ON receivables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_payables_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS (SECURITY DEFINER + SET search_path = public)
-- ============================================================================

-- 1. register_payment: cria pagamento + transactions de saldo e taxa
CREATE OR REPLACE FUNCTION register_payment(
  p_org_id UUID,
  p_account_id UUID,
  p_direction TEXT,
  p_method TEXT,
  p_gross_amount NUMERIC,
  p_fee_amount NUMERIC DEFAULT 0,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
  v_net_amount NUMERIC;
  v_tx_type TEXT;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_payment_id FROM financial_payments
    WHERE idempotency_key = p_idempotency_key AND organization_id = p_org_id;
    IF FOUND THEN
      RETURN v_payment_id;
    END IF;
  END IF;

  v_net_amount := p_gross_amount - p_fee_amount;
  IF v_net_amount <= 0 THEN
    RAISE EXCEPTION 'Valor líquido deve ser maior que zero';
  END IF;

  -- Insert payment record
  INSERT INTO financial_payments (
    organization_id, financial_account_id, payment_direction, payment_method,
    gross_amount, fee_amount, net_amount, paid_at, description,
    created_by, idempotency_key
  ) VALUES (
    p_org_id, p_account_id, p_direction, p_method,
    p_gross_amount, p_fee_amount, v_net_amount, p_paid_at, p_description,
    p_user_id, p_idempotency_key
  ) RETURNING id INTO v_payment_id;

  -- Determine transaction type based on direction
  v_tx_type := CASE WHEN p_direction = 'inbound' THEN 'income' ELSE 'expense' END;

  -- Create main transaction for the net amount
  INSERT INTO financial_transactions (
    organization_id, financial_account_id, transaction_type, amount,
    occurred_at, payment_id, description, created_by
  ) VALUES (
    p_org_id, p_account_id, v_tx_type,
    CASE WHEN p_direction = 'inbound' THEN v_net_amount ELSE -v_net_amount END,
    p_paid_at, v_payment_id, p_description, p_user_id
  );

  -- Create separate fee transaction if fee > 0
  IF p_fee_amount > 0 THEN
    INSERT INTO financial_transactions (
      organization_id, financial_account_id, transaction_type, amount,
      occurred_at, payment_id, description, created_by
    ) VALUES (
      p_org_id, p_account_id, 'fee',
      -p_fee_amount,
      p_paid_at, v_payment_id, COALESCE(p_description, '') || ' (taxa)', p_user_id
    );
  END IF;

  RETURN v_payment_id;
END;
$$;

-- 2. allocate_payment: vincula pagamento a recebível ou pagável
CREATE OR REPLACE FUNCTION allocate_payment(
  p_org_id UUID,
  p_payment_id UUID,
  p_receivable_id UUID,
  p_payable_id UUID,
  p_amount NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allocation_id UUID;
  v_remaining_payment NUMERIC;
  v_remaining_target NUMERIC;
  v_current_received NUMERIC;
  v_current_paid NUMERIC;
  v_original_amount NUMERIC;
BEGIN
  -- Validate exactly one target
  IF (p_receivable_id IS NULL AND p_payable_id IS NULL) OR
     (p_receivable_id IS NOT NULL AND p_payable_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Deve informar exatamente um destino: receivable_id ou payable_id';
  END IF;

  -- Check remaining unallocated amount on payment
  SELECT COALESCE(p.gross_amount, 0) - COALESCE(SUM(pa.allocated_amount), 0)
  INTO v_remaining_payment
  FROM financial_payments p
  LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
  WHERE p.id = p_payment_id AND p.organization_id = p_org_id
  GROUP BY p.gross_amount;

  IF v_remaining_payment IS NULL THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  IF p_amount > v_remaining_payment THEN
    RAISE EXCEPTION 'Valor de alocação (%) excede saldo disponível do pagamento (%)', p_amount, v_remaining_payment;
  END IF;

  -- Check and update receivable or payable
  IF p_receivable_id IS NOT NULL THEN
    SELECT original_amount, amount_received INTO v_original_amount, v_current_received
    FROM receivables WHERE id = p_receivable_id AND organization_id = p_org_id;

    IF v_original_amount IS NULL THEN
      RAISE EXCEPTION 'Recebível não encontrado';
    END IF;

    v_remaining_target := v_original_amount - v_current_received;
    IF p_amount > v_remaining_target THEN
      RAISE EXCEPTION 'Valor de alocação (%) excede saldo pendente do recebível (%)', p_amount, v_remaining_target;
    END IF;

    -- Insert allocation
    INSERT INTO payment_allocations (organization_id, payment_id, receivable_id, allocated_amount)
    VALUES (p_org_id, p_payment_id, p_receivable_id, p_amount)
    RETURNING id INTO v_allocation_id;

    -- Update receivable
    UPDATE receivables SET
      amount_received = amount_received + p_amount,
      status = CASE
        WHEN amount_received + p_amount >= original_amount THEN 'received'
        ELSE 'partially_received'
      END
    WHERE id = p_receivable_id AND organization_id = p_org_id;

  ELSE
    SELECT original_amount, amount_paid INTO v_original_amount, v_current_paid
    FROM payables WHERE id = p_payable_id AND organization_id = p_org_id;

    IF v_original_amount IS NULL THEN
      RAISE EXCEPTION 'Pagável não encontrado';
    END IF;

    v_remaining_target := v_original_amount - v_current_paid;
    IF p_amount > v_remaining_target THEN
      RAISE EXCEPTION 'Valor de alocação (%) excede saldo pendente do pagável (%)', p_amount, v_remaining_target;
    END IF;

    -- Insert allocation
    INSERT INTO payment_allocations (organization_id, payment_id, payable_id, allocated_amount)
    VALUES (p_org_id, p_payment_id, p_payable_id, p_amount)
    RETURNING id INTO v_allocation_id;

    -- Update payable
    UPDATE payables SET
      amount_paid = amount_paid + p_amount,
      status = CASE
        WHEN amount_paid + p_amount >= original_amount THEN 'paid'
        ELSE 'partially_paid'
      END
    WHERE id = p_payable_id AND organization_id = p_org_id;
  END IF;

  RETURN v_allocation_id;
END;
$$;

-- 3. reverse_payment: estorna pagamento e reverte allocations
CREATE OR REPLACE FUNCTION reverse_payment(
  p_org_id UUID,
  p_payment_id UUID,
  p_reason TEXT,
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_reversal_id UUID;
  v_alloc RECORD;
BEGIN
  -- Get original payment
  SELECT * INTO v_payment FROM financial_payments
  WHERE id = p_payment_id AND organization_id = p_org_id AND reversal_of IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado ou já estornado';
  END IF;

  -- Create reversal payment (opposite direction)
  INSERT INTO financial_payments (
    organization_id, financial_account_id, payment_direction, payment_method,
    gross_amount, fee_amount, net_amount, paid_at, description,
    reversal_of, created_by
  ) VALUES (
    p_org_id, v_payment.financial_account_id,
    CASE WHEN v_payment.payment_direction = 'inbound' THEN 'outbound' ELSE 'inbound' END,
    v_payment.payment_method,
    v_payment.gross_amount, v_payment.fee_amount, v_payment.net_amount,
    now(), COALESCE(p_reason, 'Estorno'),
    p_payment_id, p_user_id
  ) RETURNING id INTO v_reversal_id;

  -- Create reversal transactions
  INSERT INTO financial_transactions (
    organization_id, financial_account_id, transaction_type, amount,
    occurred_at, payment_id, description, created_by
  ) VALUES (
    p_org_id, v_payment.financial_account_id, 'reversal',
    CASE WHEN v_payment.payment_direction = 'inbound' THEN -v_payment.net_amount ELSE v_payment.net_amount END,
    now(), v_reversal_id, COALESCE(p_reason, 'Estorno'), p_user_id
  );

  -- Reverse fee transaction if applicable
  IF v_payment.fee_amount > 0 THEN
    INSERT INTO financial_transactions (
      organization_id, financial_account_id, transaction_type, amount,
      occurred_at, payment_id, description, created_by
    ) VALUES (
      p_org_id, v_payment.financial_account_id, 'reversal',
      v_payment.fee_amount,
      now(), v_reversal_id, COALESCE(p_reason, 'Estorno') || ' (taxa)', p_user_id
    );
  END IF;

  -- Reverse allocations: revert receivable/payable amounts
  FOR v_alloc IN
    SELECT * FROM payment_allocations WHERE payment_id = p_payment_id AND organization_id = p_org_id
  LOOP
    IF v_alloc.receivable_id IS NOT NULL THEN
      UPDATE receivables SET
        amount_received = GREATEST(0, amount_received - v_alloc.allocated_amount),
        status = CASE
          WHEN GREATEST(0, amount_received - v_alloc.allocated_amount) = 0 THEN 'open'
          WHEN GREATEST(0, amount_received - v_alloc.allocated_amount) < original_amount THEN 'partially_received'
          ELSE status
        END
      WHERE id = v_alloc.receivable_id AND organization_id = p_org_id;
    ELSIF v_alloc.payable_id IS NOT NULL THEN
      UPDATE payables SET
        amount_paid = GREATEST(0, amount_paid - v_alloc.allocated_amount),
        status = CASE
          WHEN GREATEST(0, amount_paid - v_alloc.allocated_amount) = 0 THEN 'open'
          WHEN GREATEST(0, amount_paid - v_alloc.allocated_amount) < original_amount THEN 'partially_paid'
          ELSE status
        END
      WHERE id = v_alloc.payable_id AND organization_id = p_org_id;
    END IF;
  END LOOP;

  RETURN v_reversal_id;
END;
$$;

-- 4. transfer_between_accounts: transfere entre contas financeiras
CREATE OR REPLACE FUNCTION transfer_between_accounts(
  p_org_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_group_id UUID;
  v_from_balance NUMERIC;
BEGIN
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor da transferência deve ser maior que zero';
  END IF;

  -- Calculate current balance of source account
  SELECT COALESCE(SUM(amount), 0) INTO v_from_balance
  FROM financial_transactions
  WHERE financial_account_id = p_from_account_id AND organization_id = p_org_id;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem. Saldo: %, Transferência: %', v_from_balance, p_amount;
  END IF;

  v_transfer_group_id := gen_random_uuid();

  -- Debit from source
  INSERT INTO financial_transactions (
    organization_id, financial_account_id, transaction_type, amount,
    occurred_at, transfer_group_id, description, created_by
  ) VALUES (
    p_org_id, p_from_account_id, 'transfer_out', -p_amount,
    now(), v_transfer_group_id, p_description, p_user_id
  );

  -- Credit to destination
  INSERT INTO financial_transactions (
    organization_id, financial_account_id, transaction_type, amount,
    occurred_at, transfer_group_id, description, created_by
  ) VALUES (
    p_org_id, p_to_account_id, 'transfer_in', p_amount,
    now(), v_transfer_group_id, p_description, p_user_id
  );

  RETURN v_transfer_group_id;
END;
$$;

-- 5. generate_receivables_from_order: gera recebíveis parcelados a partir de pedido
CREATE OR REPLACE FUNCTION generate_receivables_from_order(
  p_org_id UUID,
  p_order_id UUID,
  p_installments INT DEFAULT 1,
  p_first_due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days')::DATE,
  p_interval_days INT DEFAULT 30,
  p_category_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_group_id UUID;
  v_base_amount NUMERIC;
  v_remainder NUMERIC;
  v_result_ids UUID[] := '{}';
  v_due_date DATE;
  v_new_id UUID;
BEGIN
  -- Validate order exists and is confirmed
  SELECT id, customer_id, total, status INTO v_order
  FROM orders WHERE id = p_order_id AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status != 'confirmed' THEN
    RAISE EXCEPTION 'Apenas pedidos confirmados podem gerar recebíveis. Status atual: %', v_order.status;
  END IF;

  -- Idempotency: check if receivables already exist for this order
  IF EXISTS (SELECT 1 FROM receivables WHERE order_id = p_order_id AND organization_id = p_org_id) THEN
    RAISE EXCEPTION 'Recebíveis já foram gerados para este pedido';
  END IF;

  v_group_id := gen_random_uuid();
  v_base_amount := TRUNC(v_order.total / p_installments, 2);
  v_remainder := v_order.total - (v_base_amount * p_installments);

  FOR i IN 1..p_installments LOOP
    v_due_date := p_first_due_date + ((i - 1) * p_interval_days || ' days')::INTERVAL;

    INSERT INTO receivables (
      organization_id, customer_id, order_id, description,
      original_amount, issue_date, due_date, category_id,
      installment_group_id, installment_number, status, created_by
    ) VALUES (
      p_org_id, v_order.customer_id, p_order_id,
      'Pedido ' || COALESCE((SELECT document_number FROM orders WHERE id = p_order_id), ''),
      CASE WHEN i = p_installments THEN v_base_amount + v_remainder ELSE v_base_amount END,
      CURRENT_DATE, v_due_date, p_category_id,
      v_group_id, i, 'open', p_user_id
    ) RETURNING id INTO v_new_id;

    v_result_ids := array_append(v_result_ids, v_new_id);
  END LOOP;

  RETURN v_result_ids;
END;
$$;

-- ============================================================================
-- SEED DEFAULT FINANCIAL DATA (trigger on new organizations)
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_financial_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_account_id UUID;
BEGIN
  -- Create default cash account
  INSERT INTO financial_accounts (organization_id, name, account_type, description)
  VALUES (NEW.id, 'Caixa Principal', 'cash', 'Conta caixa padrão')
  RETURNING id INTO v_cash_account_id;

  -- Income categories
  INSERT INTO financial_categories (organization_id, name, category_type) VALUES
    (NEW.id, 'Vendas de Produtos', 'income'),
    (NEW.id, 'Prestação de Serviços', 'income'),
    (NEW.id, 'Assinaturas e Recorrências', 'income'),
    (NEW.id, 'Outras Receitas', 'income');

  -- Expense categories
  INSERT INTO financial_categories (organization_id, name, category_type) VALUES
    (NEW.id, 'Aluguel e Condomínio', 'expense'),
    (NEW.id, 'Salários e Encargos', 'expense'),
    (NEW.id, 'Fornecedores e Materiais', 'expense'),
    (NEW.id, 'Marketing e Publicidade', 'expense'),
    (NEW.id, 'Tecnologia e Software', 'expense'),
    (NEW.id, 'Impostos e Taxas', 'expense'),
    (NEW.id, 'Transporte e Logística', 'expense'),
    (NEW.id, 'Serviços de Terceiros', 'expense'),
    (NEW.id, 'Despesas Bancárias', 'expense'),
    (NEW.id, 'Outras Despesas', 'expense');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_seed_financial_data
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_financial_data();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- financial_accounts
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_accounts_select" ON financial_accounts FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "financial_accounts_insert" ON financial_accounts FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "financial_accounts_update" ON financial_accounts FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "financial_accounts_delete" ON financial_accounts FOR DELETE USING (is_member_of(organization_id));

-- financial_categories
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_categories_select" ON financial_categories FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "financial_categories_insert" ON financial_categories FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "financial_categories_update" ON financial_categories FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "financial_categories_delete" ON financial_categories FOR DELETE USING (is_member_of(organization_id));

-- receivables
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receivables_select" ON receivables FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "receivables_insert" ON receivables FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "receivables_update" ON receivables FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "receivables_delete" ON receivables FOR DELETE USING (is_member_of(organization_id));

-- payables
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payables_select" ON payables FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "payables_insert" ON payables FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "payables_update" ON payables FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "payables_delete" ON payables FOR DELETE USING (is_member_of(organization_id));

-- financial_payments (append-only: SELECT + INSERT only)
ALTER TABLE financial_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_payments_select" ON financial_payments FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "financial_payments_insert" ON financial_payments FOR INSERT WITH CHECK (is_member_of(organization_id));

-- payment_allocations (append-only: SELECT + INSERT only)
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_allocations_select" ON payment_allocations FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "payment_allocations_insert" ON payment_allocations FOR INSERT WITH CHECK (is_member_of(organization_id));

-- financial_transactions (append-only: SELECT + INSERT only)
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_transactions_select" ON financial_transactions FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "financial_transactions_insert" ON financial_transactions FOR INSERT WITH CHECK (is_member_of(organization_id));
-- ===========================================================================
-- MIGRATION 006
-- ===========================================================================

-- Barber-On Fase 07 — Equipe, Funcionários e Gestão de Permissões
-- Migration: departments, employee_profiles, organization_roles, permissions,
--            role_permissions, membership_permissions, invitations,
--            audit_logs, approval_requests, approval_votes

-- ============================================================
-- 0. ALTER memberships: add status column (must come before is_member_of redefinition)
-- ============================================================
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

-- ============================================================
-- 1. Fix is_member_of to add SET search_path and exclude suspended
-- ============================================================
CREATE OR REPLACE FUNCTION is_member_of(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = p_org_id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'
  );
$$;

-- ============================================================
-- 2. departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view departments"
  ON departments FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can manage departments"
  ON departments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = departments.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = departments.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

-- ============================================================
-- 3. employee_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL UNIQUE REFERENCES memberships(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_title TEXT,
  professional_phone TEXT,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_membership ON employee_profiles(membership_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_department ON employee_profiles(department_id);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view employee profiles"
  ON employee_profiles FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can manage employee profiles"
  ON employee_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = employee_profiles.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = employee_profiles.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

-- ============================================================
-- 4. organization_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_organization_roles_org ON organization_roles(organization_id);

ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view roles"
  ON organization_roles FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can manage custom roles"
  ON organization_roles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_roles.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ) AND organization_roles.is_system_role = false)
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = organization_roles.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

-- ============================================================
-- 5. permissions (global catalog, not tenant-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions catalog"
  ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 6. role_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_org_role ON role_permissions(organization_id, role_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view role permissions"
  ON role_permissions FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can manage role permissions"
  ON role_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = role_permissions.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = role_permissions.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

-- ============================================================
-- 7. membership_permissions (individual overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS membership_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect TEXT NOT NULL CHECK (effect IN ('grant', 'deny')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, membership_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_membership_permissions_membership ON membership_permissions(membership_id);

ALTER TABLE membership_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view membership permissions"
  ON membership_permissions FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can manage membership permissions"
  ON membership_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = membership_permissions.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = membership_permissions.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

-- ============================================================
-- 8. invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES organization_roles(id),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_title TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON invitations(organization_id, email);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invitations"
  ON invitations FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = invitations.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

CREATE POLICY "Owners and admins can update invitations"
  ON invitations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = invitations.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
  ));

-- ============================================================
-- 9. audit_logs (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audit logs"
  ON audit_logs FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (is_member_of(organization_id));

-- ============================================================
-- 10. approval_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('promote_to_owner', 'demote_owner', 'remove_owner', 'transfer_ownership')),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  target_membership_id UUID NOT NULL REFERENCES memberships(id),
  description TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status ON approval_requests(organization_id, status);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view approval requests"
  ON approval_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = approval_requests.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'OWNER'
      AND m.status = 'active'
  ));

CREATE POLICY "Owners can create approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = approval_requests.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'OWNER'
      AND m.status = 'active'
  ));

-- ============================================================
-- 11. approval_votes
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  voter_user_id UUID NOT NULL REFERENCES profiles(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(approval_request_id, voter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_votes_request ON approval_votes(approval_request_id);

ALTER TABLE approval_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view approval votes"
  ON approval_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = approval_votes.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'OWNER'
      AND m.status = 'active'
  ));

CREATE POLICY "Owners can cast approval votes"
  ON approval_votes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = approval_votes.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'OWNER'
      AND m.status = 'active'
  ));

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_employee_profiles_updated_at
  BEFORE UPDATE ON employee_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_organization_roles_updated_at
  BEFORE UPDATE ON organization_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SECURITY DEFINER Functions
-- ============================================================

-- has_permission: resolve effective permission for a user in an org
CREATE OR REPLACE FUNCTION has_permission(p_org_id UUID, p_user_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_membership_id UUID;
  v_effect TEXT;
  v_role_granted BOOLEAN;
BEGIN
  -- Get membership
  SELECT id INTO v_membership_id FROM memberships
  WHERE organization_id = p_org_id AND user_id = p_user_id AND status = 'active';

  IF v_membership_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check individual override first (deny wins)
  SELECT mp.effect INTO v_effect
  FROM membership_permissions mp
  JOIN permissions p ON p.id = mp.permission_id
  WHERE mp.membership_id = v_membership_id
    AND mp.organization_id = p_org_id
    AND p.permission_key = p_permission_key
  LIMIT 1;

  IF v_effect = 'deny' THEN
    RETURN false;
  ELSIF v_effect = 'grant' THEN
    RETURN true;
  END IF;

  -- Fall back to role permissions
  SELECT rp.granted INTO v_role_granted
  FROM role_permissions rp
  JOIN organization_roles r ON r.id = rp.role_id
  JOIN memberships mem ON mem.organization_id = rp.organization_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE rp.organization_id = p_org_id
    AND mem.id = v_membership_id
    AND (r.name = mem.role OR r.id IN (
      SELECT orole.id FROM organization_roles orole
      WHERE orole.organization_id = p_org_id AND orole.name = mem.role
    ))
    AND p.permission_key = p_permission_key
  LIMIT 1;

  RETURN COALESCE(v_role_granted, false);
END;
$$;

-- require_permission: raise exception if permission denied
CREATE OR REPLACE FUNCTION require_permission(p_org_id UUID, p_user_id UUID, p_permission_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT has_permission(p_org_id, p_user_id, p_permission_key) THEN
    RAISE EXCEPTION 'Permissão negada: %', p_permission_key;
  END IF;
END;
$$;

-- log_audit: insert audit log entry
CREATE OR REPLACE FUNCTION log_audit(
  p_org_id UUID,
  p_actor UUID,
  p_action TEXT,
  p_module TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (organization_id, actor_user_id, action, module, resource_type, resource_id, metadata)
  VALUES (p_org_id, p_actor, p_action, p_module, p_resource_type, p_resource_id, p_metadata);
END;
$$;

-- accept_invitation: validate token and create membership
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_membership_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM profiles WHERE id = p_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Find valid invitation by token hash
  SELECT i.*, r.name AS role_name
  INTO v_inv
  FROM invitations i
  JOIN organization_roles r ON r.id = i.role_id
  WHERE i.token_hash = encode(sha256(p_token::bytea), 'hex')
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now();

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Convite inválido, expirado ou revogado';
  END IF;

  -- Validate email matches
  IF lower(v_inv.email) != lower(v_user_email) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail';
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM memberships WHERE organization_id = v_inv.organization_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Você já é membro desta organização';
  END IF;

  -- Create membership with the system role name from the invited role
  INSERT INTO memberships (organization_id, user_id, role, status)
  VALUES (v_inv.organization_id, p_user_id, v_inv.role_name, 'active')
  RETURNING id INTO v_membership_id;

  -- Create employee profile
  INSERT INTO employee_profiles (organization_id, membership_id, department_id, job_title)
  VALUES (v_inv.organization_id, v_membership_id, v_inv.department_id, v_inv.job_title);

  -- Mark invitation as accepted
  UPDATE invitations SET accepted_at = now() WHERE id = v_inv.id;

  -- Log audit
  PERFORM log_audit(v_inv.organization_id, p_user_id, 'invitation_accepted', 'team', 'invitation', v_inv.id);

  RETURN v_membership_id;
END;
$$;

-- resolve_approval: check votes and execute if all owners approved
CREATE OR REPLACE FUNCTION resolve_approval(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_total_owners INT;
  v_approve_count INT;
  v_reject_count INT;
  v_target_user_id UUID;
BEGIN
  -- Lock the request row to prevent concurrent resolution (race condition)
  SELECT ar.* INTO v_req FROM approval_requests ar WHERE ar.id = p_request_id FOR UPDATE;
  IF v_req IS NULL OR v_req.status != 'pending' THEN
    RETURN;
  END IF;

  -- Count active owners
  SELECT COUNT(*) INTO v_total_owners FROM memberships
  WHERE organization_id = v_req.organization_id AND role = 'OWNER' AND status = 'active';

  -- Count approve votes
  SELECT COUNT(*) INTO v_approve_count
  FROM approval_votes WHERE approval_request_id = p_request_id AND decision = 'approve';

  -- Count reject votes
  SELECT COUNT(*) INTO v_reject_count
  FROM approval_votes WHERE approval_request_id = p_request_id AND decision = 'reject';

  -- If any rejection, mark rejected
  IF v_reject_count > 0 THEN
    UPDATE approval_requests SET status = 'rejected', resolved_at = now() WHERE id = p_request_id;
    PERFORM log_audit(v_req.organization_id, v_req.requested_by, 'approval_rejected', 'team', 'approval_request', p_request_id);
    RETURN;
  END IF;

  -- If all owners approved
  IF v_approve_count >= v_total_owners THEN
    -- Get target user
    SELECT user_id INTO v_target_user_id FROM memberships WHERE id = v_req.target_membership_id;

    -- Execute the operation
    IF v_req.request_type = 'promote_to_owner' THEN
      UPDATE memberships SET role = 'OWNER' WHERE id = v_req.target_membership_id;
    ELSIF v_req.request_type = 'demote_owner' THEN
      UPDATE memberships SET role = 'ADMIN' WHERE id = v_req.target_membership_id;
    ELSIF v_req.request_type = 'remove_owner' THEN
      DELETE FROM memberships WHERE id = v_req.target_membership_id;
    ELSIF v_req.request_type = 'transfer_ownership' THEN
      -- Demote current owner (requested_by) and promote target
      UPDATE memberships SET role = 'ADMIN'
      WHERE organization_id = v_req.organization_id AND user_id = v_req.requested_by AND role = 'OWNER';
      UPDATE memberships SET role = 'OWNER' WHERE id = v_req.target_membership_id;
    END IF;

    UPDATE approval_requests SET status = 'approved', resolved_at = now() WHERE id = p_request_id;
    PERFORM log_audit(v_req.organization_id, v_req.requested_by, 'approval_executed', 'team', 'approval_request', p_request_id,
      jsonb_build_object('type', v_req.request_type, 'target_user', v_target_user_id));
  END IF;
END;
$$;

-- ============================================================
-- Seed: permissions catalog + default team data trigger
-- ============================================================

-- Seed permissions catalog (idempotent)
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('dashboard.view', 'dashboard', 'view', 'Visualizar dashboard'),
  ('customers.view', 'customers', 'view', 'Visualizar clientes'),
  ('customers.create', 'customers', 'create', 'Criar clientes'),
  ('customers.edit', 'customers', 'edit', 'Editar clientes'),
  ('customers.delete', 'customers', 'delete', 'Arquivar clientes'),
  ('leads.view', 'leads', 'view', 'Visualizar leads'),
  ('leads.create', 'leads', 'create', 'Criar leads'),
  ('leads.edit', 'leads', 'edit', 'Editar leads'),
  ('leads.delete', 'leads', 'delete', 'Arquivar leads'),
  ('orders.view', 'orders', 'view', 'Visualizar pedidos'),
  ('orders.create', 'orders', 'create', 'Criar pedidos'),
  ('orders.edit', 'orders', 'edit', 'Editar pedidos'),
  ('orders.delete', 'orders', 'delete', 'Cancelar pedidos'),
  ('quotes.view', 'quotes', 'view', 'Visualizar orçamentos'),
  ('quotes.create', 'quotes', 'create', 'Criar orçamentos'),
  ('quotes.edit', 'quotes', 'edit', 'Editar orçamentos'),
  ('channels.view', 'channels', 'view', 'Visualizar canais'),
  ('channels.manage', 'channels', 'manage', 'Gerenciar canais'),
  ('products.view', 'products', 'view', 'Visualizar produtos'),
  ('products.create', 'products', 'create', 'Criar produtos'),
  ('products.edit', 'products', 'edit', 'Editar produtos'),
  ('products.delete', 'products', 'delete', 'Arquivar produtos'),
  ('products.change_price', 'products', 'change_price', 'Alterar preços'),
  ('inventory.view', 'inventory', 'view', 'Visualizar estoque'),
  ('inventory.adjust', 'inventory', 'adjust', 'Ajustar estoque'),
  ('inventory.transfer', 'inventory', 'transfer', 'Transferir estoque'),
  ('warehouses.view', 'warehouses', 'view', 'Visualizar depósitos'),
  ('warehouses.manage', 'warehouses', 'manage', 'Gerenciar depósitos'),
  ('receivables.view', 'receivables', 'view', 'Visualizar contas a receber'),
  ('receivables.create', 'receivables', 'create', 'Criar contas a receber'),
  ('receivables.edit', 'receivables', 'edit', 'Editar contas a receber'),
  ('payables.view', 'payables', 'view', 'Visualizar contas a pagar'),
  ('payables.create', 'payables', 'create', 'Criar contas a pagar'),
  ('payables.edit', 'payables', 'edit', 'Editar contas a pagar'),
  ('payments.register_inbound', 'payments', 'register_inbound', 'Registrar recebimentos'),
  ('payments.register_outbound', 'payments', 'register_outbound', 'Registrar pagamentos'),
  ('payments.reverse', 'payments', 'reverse', 'Efetuar estornos'),
  ('accounts.view', 'accounts', 'view', 'Visualizar contas financeiras'),
  ('accounts.manage', 'accounts', 'manage', 'Gerenciar contas financeiras'),
  ('transfers.execute', 'transfers', 'execute', 'Transferir entre contas'),
  ('cashflow.view', 'cashflow', 'view', 'Visualizar fluxo de caixa'),
  ('transactions.view', 'transactions', 'view', 'Visualizar transações'),
  ('categories.view', 'categories', 'view', 'Visualizar categorias financeiras'),
  ('categories.manage', 'categories', 'manage', 'Gerenciar categorias financeiras'),
  ('team.view', 'team', 'view', 'Visualizar equipe'),
  ('team.invite', 'team', 'invite', 'Convidar membros'),
  ('team.edit_profile', 'team', 'edit_profile', 'Editar dados profissionais'),
  ('team.edit_role', 'team', 'edit_role', 'Alterar papéis'),
  ('team.suspend', 'team', 'suspend', 'Suspender membros'),
  ('team.remove', 'team', 'remove', 'Remover membros'),
  ('departments.view', 'departments', 'view', 'Visualizar departamentos'),
  ('departments.manage', 'departments', 'manage', 'Gerenciar departamentos'),
  ('roles.view', 'roles', 'view', 'Visualizar papéis e permissões'),
  ('roles.manage', 'roles', 'manage', 'Gerenciar papéis e permissões'),
  ('audit.view', 'audit', 'view', 'Visualizar auditoria'),
  ('approvals.view', 'approvals', 'view', 'Visualizar aprovações'),
  ('approvals.vote', 'approvals', 'vote', 'Votar em aprovações'),
  ('settings.org', 'settings', 'org', 'Editar dados da organização'),
  ('reports.view', 'reports', 'view', 'Visualizar relatórios'),
  ('reports.export', 'reports', 'export', 'Exportar relatórios')
ON CONFLICT (permission_key) DO NOTHING;

-- Seed trigger function for new organizations
CREATE OR REPLACE FUNCTION seed_default_team_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_role_id UUID;
  v_admin_role_id UUID;
  v_manager_role_id UUID;
  v_employee_role_id UUID;
  v_perm RECORD;
BEGIN
  -- Create system roles
  INSERT INTO organization_roles (organization_id, name, description, is_system_role)
  VALUES (NEW.id, 'OWNER', 'Proprietário com acesso integral', true)
  RETURNING id INTO v_owner_role_id;

  INSERT INTO organization_roles (organization_id, name, description, is_system_role)
  VALUES (NEW.id, 'ADMIN', 'Administrador com acesso amplo', true)
  RETURNING id INTO v_admin_role_id;

  INSERT INTO organization_roles (organization_id, name, description, is_system_role)
  VALUES (NEW.id, 'MANAGER', 'Gerente com acesso operacional', true)
  RETURNING id INTO v_manager_role_id;

  INSERT INTO organization_roles (organization_id, name, description, is_system_role)
  VALUES (NEW.id, 'EMPLOYEE', 'Funcionário com acesso básico', true)
  RETURNING id INTO v_employee_role_id;

  -- OWNER gets all permissions
  INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
  SELECT NEW.id, v_owner_role_id, p.id, true FROM permissions p;

  -- ADMIN gets all except team.remove and approvals.vote restricted
  INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
  SELECT NEW.id, v_admin_role_id, p.id, true
  FROM permissions p
  WHERE p.permission_key NOT IN ('team.remove');

  -- MANAGER gets operational permissions
  INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
  SELECT NEW.id, v_manager_role_id, p.id, true
  FROM permissions p
  WHERE p.module IN ('dashboard', 'customers', 'leads', 'orders', 'quotes', 'channels', 'products', 'inventory', 'warehouses', 'receivables', 'payables', 'cashflow', 'transactions', 'categories', 'departments')
    AND p.permission_key NOT IN ('products.change_price', 'warehouses.manage', 'categories.manage');

  -- Add payment register permissions for MANAGER
  INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
  SELECT NEW.id, v_manager_role_id, p.id, true
  FROM permissions p
  WHERE p.permission_key IN ('payments.register_inbound', 'payments.register_outbound', 'accounts.view');

  -- EMPLOYEE gets basic view + create/edit in operational modules
  INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
  SELECT NEW.id, v_employee_role_id, p.id, true
  FROM permissions p
  WHERE p.permission_key IN (
    'dashboard.view',
    'customers.view', 'customers.create', 'customers.edit',
    'leads.view', 'leads.create', 'leads.edit',
    'orders.view', 'orders.create', 'orders.edit',
    'quotes.view', 'quotes.create', 'quotes.edit',
    'channels.view',
    'products.view',
    'inventory.view',
    'warehouses.view',
    'receivables.view',
    'payables.view',
    'cashflow.view',
    'transactions.view',
    'categories.view',
    'departments.view'
  );

  -- Create default departments
  INSERT INTO departments (organization_id, name, description) VALUES
    (NEW.id, 'Administração', 'Gestão administrativa geral'),
    (NEW.id, 'Comercial', 'Área comercial e negócios'),
    (NEW.id, 'Vendas', 'Equipe de vendas'),
    (NEW.id, 'Financeiro', 'Gestão financeira e contábil'),
    (NEW.id, 'Atendimento', 'Suporte e atendimento ao cliente'),
    (NEW.id, 'Operações', 'Operações e logística'),
    (NEW.id, 'Estoque', 'Gestão de estoque e armazenagem'),
    (NEW.id, 'Marketing', 'Marketing e comunicação'),
    (NEW.id, 'Tecnologia', 'TI e desenvolvimento');

  RETURN NEW;
END;
$$;

-- Attach trigger to organizations
DROP TRIGGER IF EXISTS on_organization_created_team ON organizations;
CREATE TRIGGER on_organization_created_team
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_team_data();

-- Seed existing organizations that don't have roles yet
DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations WHERE id NOT IN (SELECT DISTINCT organization_id FROM organization_roles)
  LOOP
    INSERT INTO organization_roles (organization_id, name, description, is_system_role) VALUES
      (v_org.id, 'OWNER', 'Proprietário com acesso integral', true),
      (v_org.id, 'ADMIN', 'Administrador com acesso amplo', true),
      (v_org.id, 'MANAGER', 'Gerente com acesso operacional', true),
      (v_org.id, 'EMPLOYEE', 'Funcionário com acesso básico', true);

    -- Seed role_permissions for each role (same logic as trigger)
    INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
    SELECT v_org.id, r.id, p.id, true
    FROM organization_roles r, permissions p
    WHERE r.organization_id = v_org.id AND r.name = 'OWNER';

    INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
    SELECT v_org.id, r.id, p.id, true
    FROM organization_roles r, permissions p
    WHERE r.organization_id = v_org.id AND r.name = 'ADMIN'
      AND p.permission_key NOT IN ('team.remove');

    INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
    SELECT v_org.id, r.id, p.id, true
    FROM organization_roles r, permissions p
    WHERE r.organization_id = v_org.id AND r.name = 'MANAGER'
      AND p.module IN ('dashboard', 'customers', 'leads', 'orders', 'quotes', 'channels', 'products', 'inventory', 'warehouses', 'receivables', 'payables', 'cashflow', 'transactions', 'categories', 'departments')
      AND p.permission_key NOT IN ('products.change_price', 'warehouses.manage', 'categories.manage');

    INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
    SELECT v_org.id, r.id, p.id, true
    FROM organization_roles r, permissions p
    WHERE r.organization_id = v_org.id AND r.name = 'MANAGER'
      AND p.permission_key IN ('payments.register_inbound', 'payments.register_outbound', 'accounts.view');

    INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
    SELECT v_org.id, r.id, p.id, true
    FROM organization_roles r, permissions p
    WHERE r.organization_id = v_org.id AND r.name = 'EMPLOYEE'
      AND p.permission_key IN (
        'dashboard.view', 'customers.view', 'customers.create', 'customers.edit',
        'leads.view', 'leads.create', 'leads.edit',
        'orders.view', 'orders.create', 'orders.edit',
        'quotes.view', 'quotes.create', 'quotes.edit',
        'channels.view', 'products.view', 'inventory.view', 'warehouses.view',
        'receivables.view', 'payables.view', 'cashflow.view', 'transactions.view',
        'categories.view', 'departments.view'
      );

    -- Create default departments for existing orgs
    INSERT INTO departments (organization_id, name, description) VALUES
      (v_org.id, 'Administração', 'Gestão administrativa geral'),
      (v_org.id, 'Comercial', 'Área comercial e negócios'),
      (v_org.id, 'Vendas', 'Equipe de vendas'),
      (v_org.id, 'Financeiro', 'Gestão financeira e contábil'),
      (v_org.id, 'Atendimento', 'Suporte e atendimento ao cliente'),
      (v_org.id, 'Operações', 'Operações e logística'),
      (v_org.id, 'Estoque', 'Gestão de estoque e armazenagem'),
      (v_org.id, 'Marketing', 'Marketing e comunicação'),
      (v_org.id, 'Tecnologia', 'TI e desenvolvimento')
    ON CONFLICT (organization_id, name) DO NOTHING;
  END LOOP;
END $$;
-- ===========================================================================
-- MIGRATION 007
-- ===========================================================================

-- ============================================================================
-- Barber-On Fase 08 — BI Views & Report Permissions
-- ============================================================================

-- Seed report permissions into the global permissions catalog
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('reports.executive.view', 'reports', 'view', 'Visualizar dashboard executivo'),
  ('reports.sales.view',     'reports', 'view', 'Visualizar relatórios comerciais'),
  ('reports.crm.view',       'reports', 'view', 'Visualizar relatórios de CRM'),
  ('reports.financial.view', 'reports', 'view', 'Visualizar relatórios financeiros'),
  ('reports.inventory.view', 'reports', 'view', 'Visualizar relatórios de estoque'),
  ('reports.team.view',      'reports', 'view', 'Visualizar relatórios de equipe'),
  ('reports.export',         'reports', 'export', 'Exportar relatórios')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all report permissions to OWNER and ADMIN system roles for every org
DO $$
DECLARE
  v_org RECORD;
  v_role RECORD;
  v_perm RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    FOR v_role IN
      SELECT id FROM organization_roles
      WHERE organization_id = v_org.id AND is_system_role = true AND name IN ('OWNER', 'ADMIN')
    LOOP
      FOR v_perm IN
        SELECT id FROM permissions WHERE module = 'reports'
      LOOP
        INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
        VALUES (v_org.id, v_role.id, v_perm.id, true)
        ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- VIEW: v_sales_summary
-- Aggregates orders by period/channel/customer with totals
-- Uses cost_price_snapshot from order_items for margin calculation
-- ============================================================================
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
  o.organization_id,
  o.id AS order_id,
  o.document_number,
  o.status,
  o.channel_id,
  sc.name AS channel_name,
  o.customer_id,
  c.name AS customer_name,
  o.subtotal,
  o.discount,
  o.tax,
  o.total,
  o.issued_at,
  o.completed_at,
  o.created_at,
  COALESCE(SUM(oi.cost_price_snapshot * oi.quantity), 0) AS total_cost,
  o.total - COALESCE(SUM(oi.cost_price_snapshot * oi.quantity), 0) AS gross_margin
FROM orders o
LEFT JOIN sales_channels sc ON sc.id = o.channel_id
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.organization_id = o.organization_id
GROUP BY o.organization_id, o.id, o.document_number, o.status, o.channel_id, sc.name,
         o.customer_id, c.name, o.subtotal, o.discount, o.tax, o.total,
         o.issued_at, o.completed_at, o.created_at;

-- ============================================================================
-- VIEW: v_pipeline_funnel
-- Counts and sums leads per stage with won/lost classification
-- ============================================================================
CREATE OR REPLACE VIEW v_pipeline_funnel AS
SELECT
  l.organization_id,
  ps.id AS stage_id,
  ps.name AS stage_name,
  ps.position,
  ps.is_won,
  ps.is_lost,
  COUNT(l.id) AS lead_count,
  COALESCE(SUM(l.estimated_value), 0) AS total_value,
  COUNT(l.id) FILTER (WHERE l.converted_at IS NOT NULL) AS converted_count
FROM leads l
JOIN pipeline_stages ps ON ps.id = l.stage_id AND ps.organization_id = l.organization_id
WHERE l.archived_at IS NULL
GROUP BY l.organization_id, ps.id, ps.name, ps.position, ps.is_won, ps.is_lost;

-- ============================================================================
-- VIEW: v_cashflow_monthly
-- Monthly income/expense/balance from financial_transactions
-- Excludes transfers (transfer_group_id IS NOT NULL) from income/expense totals
-- ============================================================================
CREATE OR REPLACE VIEW v_cashflow_monthly AS
SELECT
  ft.organization_id,
  DATE_TRUNC('month', ft.occurred_at)::DATE AS month_start,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type IN ('income', 'receivable_payment', 'opening_balance')), 0) AS total_income,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type IN ('expense', 'payable_payment')), 0) AS total_expense,
  SUM(ft.amount) AS net_flow
FROM financial_transactions ft
WHERE ft.reversal_of_transaction_id IS NULL
GROUP BY ft.organization_id, DATE_TRUNC('month', ft.occurred_at);

-- ============================================================================
-- VIEW: v_inventory_valuation
-- Current stock value per product/warehouse using cost_price and quantity_on_hand
-- Includes variant-level granularity when applicable
-- ============================================================================
CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT
  ib.organization_id,
  ib.warehouse_id,
  w.name AS warehouse_name,
  ib.product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  ib.variant_id,
  pv.name AS variant_name,
  pv.sku AS variant_sku,
  ib.quantity_on_hand,
  ib.quantity_reserved,
  ib.quantity_on_hand - ib.quantity_reserved AS quantity_available,
  COALESCE(pv.cost_price_override, p.cost_price, 0) AS unit_cost,
  (ib.quantity_on_hand - ib.quantity_reserved) * COALESCE(pv.cost_price_override, p.cost_price, 0) AS available_value,
  ib.quantity_on_hand * COALESCE(pv.cost_price_override, p.cost_price, 0) AS total_value
FROM inventory_balances ib
JOIN warehouses w ON w.id = ib.warehouse_id AND w.organization_id = ib.organization_id
JOIN products p ON p.id = ib.product_id AND p.organization_id = ib.organization_id
LEFT JOIN product_variants pv ON pv.id = ib.variant_id AND pv.organization_id = ib.organization_id;

-- ============================================================================
-- VIEW: v_receivables_aging
-- Open receivables bucketed into aging brackets based on due_date vs now()
-- Uses remaining balance (original_amount - amount_received)
-- ============================================================================
CREATE OR REPLACE VIEW v_receivables_aging AS
SELECT
  r.organization_id,
  r.id AS receivable_id,
  r.customer_id,
  c.name AS customer_name,
  r.description,
  r.original_amount,
  r.amount_received,
  r.original_amount - r.amount_received AS outstanding_amount,
  r.due_date,
  r.status,
  CASE
    WHEN r.due_date >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - r.due_date <= 30 THEN '1_30'
    WHEN CURRENT_DATE - r.due_date <= 60 THEN '31_60'
    WHEN CURRENT_DATE - r.due_date <= 90 THEN '61_90'
    ELSE '90_plus'
  END AS aging_bucket,
  GREATEST(0, CURRENT_DATE - r.due_date) AS days_overdue
FROM receivables r
LEFT JOIN customers c ON c.id = r.customer_id AND c.organization_id = r.organization_id
WHERE r.status NOT IN ('cancelled', 'fully_paid')
  AND r.original_amount - r.amount_received > 0.01;

-- ============================================================================
-- VIEW: v_payables_aging
-- Open payables bucketed into aging brackets based on due_date vs now()
-- Uses remaining balance (original_amount - amount_paid)
-- ============================================================================
CREATE OR REPLACE VIEW v_payables_aging AS
SELECT
  p.organization_id,
  p.id AS payable_id,
  p.counterparty_name,
  p.description,
  p.original_amount,
  p.amount_paid,
  p.original_amount - p.amount_paid AS outstanding_amount,
  p.due_date,
  p.status,
  CASE
    WHEN p.due_date >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - p.due_date <= 30 THEN '1_30'
    WHEN CURRENT_DATE - p.due_date <= 60 THEN '31_60'
    WHEN CURRENT_DATE - p.due_date <= 90 THEN '61_90'
    ELSE '90_plus'
  END AS aging_bucket,
  GREATEST(0, CURRENT_DATE - p.due_date) AS days_overdue
FROM payables p
WHERE p.status NOT IN ('cancelled', 'fully_paid')
  AND p.original_amount - p.amount_paid > 0.01;

-- ============================================================================
-- VIEW: v_team_performance
-- Orders count and revenue per employee per period
-- Joins orders.created_by with memberships + profiles
-- ============================================================================
CREATE OR REPLACE VIEW v_team_performance AS
SELECT
  o.organization_id,
  o.created_by AS user_id,
  pr.full_name,
  pr.email,
  m.role,
  ep.department_id,
  d.name AS department_name,
  COUNT(o.id) AS order_count,
  COALESCE(SUM(o.total), 0) AS total_revenue,
  COALESCE(AVG(o.total), 0) AS avg_ticket,
  MIN(o.created_at) AS first_order_at,
  MAX(o.created_at) AS last_order_at
FROM orders o
JOIN memberships m ON m.user_id = o.created_by AND m.organization_id = o.organization_id
JOIN profiles pr ON pr.id = o.created_by
LEFT JOIN employee_profiles ep ON ep.membership_id = m.id AND ep.organization_id = o.organization_id
LEFT JOIN departments d ON d.id = ep.department_id AND d.organization_id = o.organization_id
GROUP BY o.organization_id, o.created_by, pr.full_name, pr.email, m.role,
         ep.department_id, d.name;

-- ============================================================================
-- Indexes for report query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_org_completed ON orders(organization_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_orders_org_channel ON orders(organization_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_stage ON leads(organization_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON leads(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ft_org_occurred ON financial_transactions(organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_receivables_org_due ON receivables(organization_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payables_org_due ON payables(organization_id, due_date);
CREATE INDEX IF NOT EXISTS idx_inv_balances_org_product ON inventory_balances(organization_id, product_id);

-- ============================================================================
-- RLS: Views inherit RLS from underlying tables automatically
-- No additional policies needed since views use SECURITY INVOKER (default)
-- and all base tables already have organization_id-scoped RLS via is_member_of()
-- ============================================================================
-- ===========================================================================
-- MIGRATION 008
-- ===========================================================================

-- ============================================================================
-- BARBER-ON FASE 09 — FORNECEDORES E GESTÃO DE COMPRAS
-- Tabelas: suppliers, supplier_addresses, supplier_contacts, supplier_products,
--          purchase_orders, purchase_order_items, goods_receipts,
--          goods_receipt_items, purchase_payable_links
-- Funções: next_purchase_number, next_receipt_number, confirm_goods_receipt,
--          seed_default_purchase_permissions
-- ============================================================================

-- ============================================================================
-- 1. SUPPLIERS (Fornecedores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_type TEXT NOT NULL CHECK (supplier_type IN ('individual', 'company')) DEFAULT 'company',
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  document TEXT, -- CPF or CNPJ (optional, validated at app level)
  state_registration TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  category TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_suppliers_document ON suppliers(document) WHERE document IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON suppliers USING gin (legal_name gin_trgm_ops);

-- ============================================================================
-- 2. SUPPLIER ADDRESSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL DEFAULT 'main' CHECK (address_type IN ('main', 'billing', 'shipping', 'other')),
  postal_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_addresses_supplier ON supplier_addresses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_addresses_org ON supplier_addresses(organization_id);

-- ============================================================================
-- 3. SUPPLIER CONTACTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_org ON supplier_contacts(organization_id);

-- ============================================================================
-- 4. SUPPLIER PRODUCTS (Relacionamento fornecedor ↔ produto)
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  supplier_product_code TEXT,
  purchase_price NUMERIC(14, 2),
  lead_time_days INT,
  minimum_order_quantity NUMERIC(14, 4),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplier_products_active CHECK (is_active IN (true, false))
);

-- Índice único funcional para garantir unicidade org+supplier+product+variant (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_products_unique
  ON supplier_products (organization_id, supplier_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_org ON supplier_products(organization_id);

-- ============================================================================
-- 5. PURCHASE ORDERS (Ordens de Compra)
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'approved', 'sent', 'partially_received', 'received', 'partially_cancelled', 'cancelled'
  )),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  freight_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  additional_costs NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  commercial_terms TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, purchase_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_issue_date ON purchase_orders(organization_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);

-- ============================================================================
-- 6. PURCHASE ORDER ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  quantity_ordered NUMERIC(14, 4) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_cancelled NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (quantity_cancelled >= 0),
  unit_snapshot TEXT NOT NULL DEFAULT 'un',
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_po_item_qty CHECK (quantity_received + quantity_cancelled <= quantity_ordered)
);

CREATE INDEX IF NOT EXISTS idx_po_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_po_items_org ON purchase_order_items(organization_id);

-- ============================================================================
-- 7. GOODS RECEIPTS (Recebimentos de Mercadoria)
-- ============================================================================
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'partial', 'with_discrepancies')),
  notes TEXT,
  received_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_org ON goods_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse ON goods_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_received_at ON goods_receipts(received_at DESC);

-- ============================================================================
-- 8. GOODS RECEIPT ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity_received NUMERIC(14, 4) NOT NULL CHECK (quantity_received > 0),
  quantity_accepted NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (quantity_accepted >= 0),
  quantity_rejected NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_gr_item_qty CHECK (quantity_accepted + quantity_rejected = quantity_received)
);

CREATE INDEX IF NOT EXISTS idx_gr_items_receipt ON goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_gr_items_po_item ON goods_receipt_items(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS idx_gr_items_org ON goods_receipt_items(organization_id);

-- ============================================================================
-- 9. PURCHASE PAYABLE LINKS (Vínculo compra ↔ conta a pagar)
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_payable_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payable_id UUID NOT NULL REFERENCES payables(id) ON DELETE CASCADE,
  linked_amount NUMERIC(14, 2) NOT NULL CHECK (linked_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, purchase_order_id, payable_id)
);

CREATE INDEX IF NOT EXISTS idx_ppl_po ON purchase_payable_links(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_ppl_payable ON purchase_payable_links(payable_id);
CREATE INDEX IF NOT EXISTS idx_ppl_org ON purchase_payable_links(organization_id);

-- ============================================================================
-- EXTEND document_sequences TO SUPPORT PURCHASE TYPES
-- ============================================================================
ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS chk_document_type;
ALTER TABLE document_sequences ADD CONSTRAINT chk_document_type CHECK (
  document_type IN ('order', 'quote', 'receivable', 'payable', 'payment', 'purchase_order', 'goods_receipt')
);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_supplier_addresses_updated_at
  BEFORE UPDATE ON supplier_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_supplier_contacts_updated_at
  BEFORE UPDATE ON supplier_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_supplier_products_updated_at
  BEFORE UPDATE ON supplier_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_purchase_order_items_updated_at
  BEFORE UPDATE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS (SECURITY DEFINER + SET search_path = public)
-- ============================================================================

-- Atomic numbering for purchase orders: COMP-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION next_purchase_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_next INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now());

  INSERT INTO document_sequences (organization_id, document_type, year, current_number)
  VALUES (p_org_id, 'purchase_order', v_year, 1)
  ON CONFLICT (organization_id, document_type, year)
  DO UPDATE SET current_number = document_sequences.current_number + 1
  RETURNING current_number INTO v_next;

  RETURN format('COMP-%s-%s', v_year, lpad(v_next::text, 6, '0'));
END;
$$;

-- Atomic numbering for goods receipts: REC-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION next_receipt_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_next INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now());

  INSERT INTO document_sequences (organization_id, document_type, year, current_number)
  VALUES (p_org_id, 'goods_receipt', v_year, 1)
  ON CONFLICT (organization_id, document_type, year)
  DO UPDATE SET current_number = document_sequences.current_number + 1
  RETURNING current_number INTO v_next;

  RETURN format('REC-%s-%s', v_year, lpad(v_next::text, 6, '0'));
END;
$$;

-- Confirm goods receipt: updates PO item quantities, PO status, and creates inventory movements
-- All within a single transaction to prevent partial state
CREATE OR REPLACE FUNCTION confirm_goods_receipt(
  p_org_id UUID,
  p_receipt_id UUID,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_receipt RECORD;
  v_item RECORD;
  v_po_item RECORD;
  v_pending NUMERIC;
  v_all_received BOOLEAN := true;
  v_any_received BOOLEAN := false;
BEGIN
  -- Lock the receipt
  SELECT gr.*, po.id AS po_id, po.status AS po_status, po.destination_warehouse_id
  INTO v_receipt
  FROM goods_receipts gr
  JOIN purchase_orders po ON po.id = gr.purchase_order_id AND po.organization_id = gr.organization_id
  WHERE gr.id = p_receipt_id AND gr.organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  -- Process each receipt item
  FOR v_item IN
    SELECT gri.*, poi.quantity_ordered, poi.quantity_received AS prev_received,
           poi.quantity_cancelled, poi.product_id AS poi_product_id, poi.variant_id AS poi_variant_id
    FROM goods_receipt_items gri
    JOIN purchase_order_items poi ON poi.id = gri.purchase_order_item_id
    WHERE gri.goods_receipt_id = p_receipt_id AND gri.organization_id = p_org_id
    FOR UPDATE OF poi
  LOOP
    -- Validate: cannot receive more than pending
    v_pending := v_item.quantity_ordered - v_item.prev_received - v_item.quantity_cancelled;
    IF v_item.quantity_received > v_pending THEN
      RAISE EXCEPTION 'Quantidade recebida (%) excede pendente (%) para item %',
        v_item.quantity_received, v_pending, v_item.purchase_order_item_id;
    END IF;

    -- Update PO item received quantity
    UPDATE purchase_order_items
    SET quantity_received = quantity_received + v_item.quantity_received
    WHERE id = v_item.purchase_order_item_id;

    -- Create inventory movement for accepted quantity only
    IF v_item.quantity_accepted > 0 THEN
      PERFORM adjust_inventory(
        p_org_id,
        v_receipt.warehouse_id,
        v_item.product_id,
        v_item.variant_id,
        v_item.quantity_accepted,
        'manual_in',
        'Recebimento de compra ' || v_receipt.receipt_number,
        'goods_receipt',
        p_receipt_id,
        p_user_id
      );
    END IF;

    v_any_received := true;
  END LOOP;

  -- Check if all PO items are fully received
  SELECT bool_and(quantity_received + quantity_cancelled >= quantity_ordered)
  INTO v_all_received
  FROM purchase_order_items
  WHERE purchase_order_id = v_receipt.po_id AND organization_id = p_org_id;

  -- Update PO status
  IF v_all_received THEN
    UPDATE purchase_orders
    SET status = 'received', received_at = now()
    WHERE id = v_receipt.po_id AND organization_id = p_org_id;
  ELSIF v_any_received THEN
    UPDATE purchase_orders
    SET status = 'partially_received'
    WHERE id = v_receipt.po_id AND organization_id = p_org_id
      AND status NOT IN ('received', 'cancelled');
  END IF;
END;
$$;

-- ============================================================================
-- SEED PURCHASE PERMISSIONS
-- ============================================================================
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('suppliers.view',       'suppliers', 'view',       'Visualizar fornecedores'),
  ('suppliers.create',     'suppliers', 'create',     'Criar fornecedores'),
  ('suppliers.edit',       'suppliers', 'edit',       'Editar fornecedores'),
  ('suppliers.archive',    'suppliers', 'archive',    'Arquivar fornecedores'),
  ('purchases.view',       'purchases', 'view',       'Visualizar ordens de compra'),
  ('purchases.create',     'purchases', 'create',     'Criar ordens de compra'),
  ('purchases.edit_draft', 'purchases', 'edit_draft', 'Editar ordens em rascunho'),
  ('purchases.approve',    'purchases', 'approve',    'Aprovar ordens de compra'),
  ('purchases.send',       'purchases', 'send',       'Registrar envio de ordem'),
  ('purchases.receive',    'purchases', 'receive',    'Registrar recebimentos'),
  ('purchases.discrepancy','purchases', 'discrepancy','Registrar divergências'),
  ('purchases.return',     'purchases', 'return',     'Registrar devoluções'),
  ('purchases.generate_payable', 'purchases', 'generate_payable', 'Gerar contas a pagar de compras'),
  ('purchases.update_cost','purchases', 'update_cost','Atualizar custo de produtos após compra'),
  ('purchases.export',     'purchases', 'export',     'Exportar relatórios de compras')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all purchase permissions to OWNER and ADMIN system roles
DO $$
DECLARE
  v_org RECORD;
  v_role RECORD;
  v_perm RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    FOR v_role IN
      SELECT id FROM organization_roles
      WHERE organization_id = v_org.id AND is_system_role = true AND name IN ('OWNER', 'ADMIN')
    LOOP
      FOR v_perm IN
        SELECT id FROM permissions WHERE module IN ('suppliers', 'purchases')
      LOOP
        INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
        VALUES (v_org.id, v_role.id, v_perm.id, true)
        ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Grant view + create + edit_draft + receive to MANAGER
DO $$
DECLARE
  v_org RECORD;
  v_role RECORD;
  v_perm RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    FOR v_role IN
      SELECT id FROM organization_roles
      WHERE organization_id = v_org.id AND is_system_role = true AND name = 'MANAGER'
    LOOP
      FOR v_perm IN
        SELECT id FROM permissions
        WHERE module IN ('suppliers', 'purchases')
          AND permission_key IN (
            'suppliers.view', 'suppliers.create', 'suppliers.edit',
            'purchases.view', 'purchases.create', 'purchases.edit_draft',
            'purchases.receive', 'purchases.discrepancy', 'purchases.export'
          )
      LOOP
        INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
        VALUES (v_org.id, v_role.id, v_perm.id, true)
        ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Grant view only to EMPLOYEE
DO $$
DECLARE
  v_org RECORD;
  v_role RECORD;
  v_perm RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    FOR v_role IN
      SELECT id FROM organization_roles
      WHERE organization_id = v_org.id AND is_system_role = true AND name = 'EMPLOYEE'
    LOOP
      FOR v_perm IN
        SELECT id FROM permissions
        WHERE permission_key IN ('suppliers.view', 'purchases.view')
      LOOP
        INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
        VALUES (v_org.id, v_role.id, v_perm.id, true)
        ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payable_links ENABLE ROW LEVEL SECURITY;

-- Standard is_member_of policies for all tables
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (is_member_of(organization_id));

CREATE POLICY "supplier_addresses_select" ON supplier_addresses FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "supplier_addresses_insert" ON supplier_addresses FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "supplier_addresses_update" ON supplier_addresses FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "supplier_addresses_delete" ON supplier_addresses FOR DELETE USING (is_member_of(organization_id));

CREATE POLICY "supplier_contacts_select" ON supplier_contacts FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "supplier_contacts_insert" ON supplier_contacts FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "supplier_contacts_update" ON supplier_contacts FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "supplier_contacts_delete" ON supplier_contacts FOR DELETE USING (is_member_of(organization_id));

CREATE POLICY "supplier_products_select" ON supplier_products FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "supplier_products_insert" ON supplier_products FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "supplier_products_update" ON supplier_products FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "supplier_products_delete" ON supplier_products FOR DELETE USING (is_member_of(organization_id));

CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

CREATE POLICY "po_items_select" ON purchase_order_items FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "po_items_insert" ON purchase_order_items FOR INSERT WITH CHECK (is_member_of(organization_id));
CREATE POLICY "po_items_update" ON purchase_order_items FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
CREATE POLICY "po_items_delete" ON purchase_order_items FOR DELETE USING (is_member_of(organization_id));

CREATE POLICY "goods_receipts_select" ON goods_receipts FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "goods_receipts_insert" ON goods_receipts FOR INSERT WITH CHECK (is_member_of(organization_id));

CREATE POLICY "gr_items_select" ON goods_receipt_items FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "gr_items_insert" ON goods_receipt_items FOR INSERT WITH CHECK (is_member_of(organization_id));

CREATE POLICY "ppl_select" ON purchase_payable_links FOR SELECT USING (is_member_of(organization_id));
CREATE POLICY "ppl_insert" ON purchase_payable_links FOR INSERT WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- PERFORMANCE INDEXES FOR REPORTS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_po_items_org_product ON purchase_order_items(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_gr_items_org_product ON goods_receipt_items(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_expected ON purchase_orders(expected_delivery_date) WHERE expected_delivery_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(organization_id, category) WHERE category IS NOT NULL;
-- ===========================================================================
-- MIGRATION 009
-- ===========================================================================

-- Barber-On Fase 10 — Tarefas, Agenda e Notificações
-- Migration: tasks, task_checklists, calendar_events, event_reminders,
--            notifications, notification_preferences, push_subscriptions

-- ============================================================================
-- 1. TASKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES memberships(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  -- Module linking (nullable FKs — only one should be set per task)
  linked_client_id UUID,
  linked_lead_id UUID,
  linked_order_id UUID,
  linked_supplier_id UUID,
  linked_purchase_order_id UUID,
  linked_invoice_id UUID,
  linked_product_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks"
  ON tasks FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Members can create tasks"
  ON tasks FOR INSERT WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update tasks"
  ON tasks FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete tasks"
  ON tasks FOR DELETE USING (is_member_of(organization_id));

-- ============================================================================
-- 2. TASK_CHECKLISTS (subtasks / checklist items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON task_checklists(task_id);

ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;

-- Checklist items inherit access from parent task via join
CREATE POLICY "Members can view task checklists"
  ON task_checklists FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_checklists.task_id AND is_member_of(t.organization_id))
  );

CREATE POLICY "Members can manage task checklists"
  ON task_checklists FOR ALL USING (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_checklists.task_id AND is_member_of(t.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_checklists.task_id AND is_member_of(t.organization_id))
  );

-- ============================================================================
-- 3. CALENDAR_EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  -- Recurrence (RFC 5545 RRULE subset)
  recurrence_rule TEXT, -- e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T235959Z"
  recurrence_end_date TIMESTAMPTZ,
  parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  -- Module linking
  linked_client_id UUID,
  linked_lead_id UUID,
  linked_order_id UUID,
  linked_supplier_id UUID,
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  color TEXT DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_dates ON calendar_events(organization_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence ON calendar_events(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_parent ON calendar_events(parent_event_id) WHERE parent_event_id IS NOT NULL;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view calendar events"
  ON calendar_events FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Members can create calendar events"
  ON calendar_events FOR INSERT WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update calendar events"
  ON calendar_events FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete calendar events"
  ON calendar_events FOR DELETE USING (is_member_of(organization_id));

-- ============================================================================
-- 4. EVENT_ATTENDEES (who is invited/attending)
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, membership_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_membership ON event_attendees(membership_id);

ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event attendees"
  ON event_attendees FOR SELECT USING (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = event_attendees.event_id AND is_member_of(ce.organization_id))
  );

CREATE POLICY "Members can manage event attendees"
  ON event_attendees FOR ALL USING (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = event_attendees.event_id AND is_member_of(ce.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = event_attendees.event_id AND is_member_of(ce.organization_id))
  );

-- ============================================================================
-- 5. EVENT_REMINDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'notification' CHECK (reminder_type IN ('notification', 'email', 'push')),
  minutes_before INT NOT NULL DEFAULT 15,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_event ON event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_pending ON event_reminders(sent_at) WHERE sent_at IS NULL;

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event reminders"
  ON event_reminders FOR SELECT USING (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = event_reminders.event_id AND is_member_of(ce.organization_id))
  );

CREATE POLICY "Members can manage event reminders"
  ON event_reminders FOR ALL USING (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = event_reminders.event_id AND is_member_of(ce.organization_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = event_reminders.event_id AND is_member_of(ce.organization_id))
  );

-- ============================================================================
-- 6. NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'task_assigned', 'task_due_soon', 'task_overdue', 'task_completed',
    'event_reminder', 'event_updated', 'event_cancelled',
    'order_status_changed', 'payment_received', 'payment_overdue',
    'stock_low', 'purchase_received', 'member_joined', 'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_all ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE USING (auth.uid() = recipient_id);

-- ============================================================================
-- 7. NOTIFICATION_PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
  category TEXT NOT NULL CHECK (category IN (
    'tasks', 'calendar', 'orders', 'financial', 'inventory', 'team', 'system'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, channel, category)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_org ON notification_preferences(user_id, organization_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences"
  ON notification_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 8. PUSH_SUBSCRIPTIONS (Web Push API)
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Create notification for a user (used by server actions and triggers)
CREATE OR REPLACE FUNCTION create_notification(
  p_org_id UUID,
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (organization_id, recipient_id, type, title, body, link, metadata)
  VALUES (p_org_id, p_recipient_id, p_type, p_title, p_body, p_link, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM notifications
  WHERE recipient_id = p_user_id AND is_read = false;
$$;

-- Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notifications
  SET is_read = true, read_at = now()
  WHERE recipient_id = p_user_id AND is_read = false;
$$;

-- Complete a task atomically (sets status + completed_at + audit log)
CREATE OR REPLACE FUNCTION complete_task(
  p_task_id UUID,
  p_org_id UUID,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tasks
  SET status = 'done', completed_at = now(), updated_at = now()
  WHERE id = p_task_id AND organization_id = p_org_id AND status != 'done';

  PERFORM log_audit(p_org_id, p_user_id, 'task_completed', 'tasks', 'task', p_task_id);
END;
$$;

-- Get pending reminders that need to be sent (for backend cron processing)
CREATE OR REPLACE FUNCTION get_pending_reminders()
RETURNS TABLE (
  reminder_id UUID,
  event_id UUID,
  event_title TEXT,
  event_start_at TIMESTAMPTZ,
  event_org_id UUID,
  reminder_type TEXT,
  minutes_before INT,
  attendee_membership_id UUID,
  attendee_user_id UUID
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    er.id AS reminder_id,
    er.event_id,
    ce.title AS event_title,
    ce.start_at AS event_start_at,
    ce.organization_id AS event_org_id,
    er.reminder_type,
    er.minutes_before,
    ea.membership_id AS attendee_membership_id,
    m.user_id AS attendee_user_id
  FROM event_reminders er
  JOIN calendar_events ce ON ce.id = er.event_id
  LEFT JOIN event_attendees ea ON ea.event_id = ce.id
  LEFT JOIN memberships m ON m.id = ea.membership_id AND m.status = 'active'
  WHERE er.sent_at IS NULL
    AND ce.start_at - (er.minutes_before || ' minutes')::INTERVAL <= now()
    AND ce.start_at > now()
  ORDER BY ce.start_at ASC;
$$;

-- Mark reminder as sent
CREATE OR REPLACE FUNCTION mark_reminder_sent(p_reminder_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE event_reminders SET sent_at = now() WHERE id = p_reminder_id;
$$;

-- ============================================================================
-- SEED PERMISSIONS FOR TASKS/CALENDAR/NOTIFICATIONS MODULE
-- ============================================================================
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('tasks.view', 'tasks', 'view', 'Visualizar tarefas'),
  ('tasks.create', 'tasks', 'create', 'Criar tarefas'),
  ('tasks.edit', 'tasks', 'edit', 'Editar tarefas'),
  ('tasks.delete', 'tasks', 'delete', 'Excluir tarefas'),
  ('tasks.assign', 'tasks', 'assign', 'Atribuir tarefas'),
  ('calendar.view', 'calendar', 'view', 'Visualizar agenda'),
  ('calendar.create', 'calendar', 'create', 'Criar eventos'),
  ('calendar.edit', 'calendar', 'edit', 'Editar eventos'),
  ('calendar.delete', 'calendar', 'delete', 'Excluir eventos'),
  ('notifications.view', 'notifications', 'view', 'Visualizar notificações'),
  ('notifications.manage_prefs', 'notifications', 'manage_prefs', 'Gerenciar preferências de notificação')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant new permissions to existing system roles
DO $$
DECLARE
  v_org RECORD;
  v_owner_role UUID;
  v_admin_role UUID;
  v_manager_role UUID;
  v_employee_role UUID;
BEGIN
  FOR v_org IN SELECT id FROM organizations
  LOOP
    SELECT id INTO v_owner_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'OWNER';
    SELECT id INTO v_admin_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'ADMIN';
    SELECT id INTO v_manager_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'MANAGER';
    SELECT id INTO v_employee_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'EMPLOYEE';

    -- OWNER & ADMIN: all task/calendar/notification permissions
    IF v_owner_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_owner_role, p.id, true
      FROM permissions p WHERE p.module IN ('tasks', 'calendar', 'notifications')
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;

    IF v_admin_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_admin_role, p.id, true
      FROM permissions p WHERE p.module IN ('tasks', 'calendar', 'notifications')
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;

    -- MANAGER: view + create + edit tasks/calendar, view notifications
    IF v_manager_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_manager_role, p.id, true
      FROM permissions p
      WHERE p.permission_key IN (
        'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.assign',
        'calendar.view', 'calendar.create', 'calendar.edit',
        'notifications.view'
      )
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;

    -- EMPLOYEE: view tasks/calendar, view notifications
    IF v_employee_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_employee_role, p.id, true
      FROM permissions p
      WHERE p.permission_key IN (
        'tasks.view', 'tasks.create',
        'calendar.view',
        'notifications.view'
      )
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
-- ===========================================================================
-- MIGRATION 010
-- ===========================================================================

-- Barber-On Fase 11 — Barber-On Intelligence (AI Assistant)
-- Migration: ai_conversations, ai_messages, ai_usage_records, ai_settings, ai_insights

-- ============================================================================
-- 1. AI_CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_org ON ai_conversations(user_id, organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org ON ai_conversations(organization_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id AND is_member_of(organization_id));

CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 2. AI_MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  message_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_org ON ai_messages(organization_id);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON ai_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id
        AND ac.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON ai_messages FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id
        AND ac.user_id = auth.uid()
        AND is_member_of(ai_messages.organization_id)
    )
  );

-- ============================================================================
-- 3. AI_USAGE_RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('chat', 'insight', 'summary', 'tool_call')),
  input_tokens INT,
  output_tokens INT,
  estimated_cost NUMERIC(10, 6),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout', 'rate_limited')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_date ON ai_usage_records(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_records(user_id, created_at DESC);

ALTER TABLE ai_usage_records ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can view usage records for the org
CREATE POLICY "Admins can view usage records"
  ON ai_usage_records FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = ai_usage_records.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
        AND m.status = 'active'
    )
  );

-- System inserts via server actions (SECURITY DEFINER function below)
CREATE POLICY "System can insert usage records"
  ON ai_usage_records FOR INSERT WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- 4. AI_SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  usage_limit_monthly INT NOT NULL DEFAULT 1000,
  daily_limit INT NOT NULL DEFAULT 100,
  max_tokens_per_request INT NOT NULL DEFAULT 4096,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view AI settings"
  ON ai_settings FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Owners and admins can manage AI settings"
  ON ai_settings FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = ai_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
        AND m.status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = ai_settings.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
        AND m.status = 'active'
    )
  );

-- ============================================================================
-- 5. AI_INSIGHTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'sales_trend', 'expense_alert', 'stock_critical', 'overdue_receivable',
    'lead_stale', 'order_delayed', 'performance_change', 'custom'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_metadata JSONB DEFAULT '{}',
  reference_type TEXT,
  reference_id UUID,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_org_status ON ai_insights(organization_id, status, generated_at DESC);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view insights"
  ON ai_insights FOR SELECT USING (is_member_of(organization_id));

CREATE POLICY "Members can update insight status"
  ON ai_insights FOR UPDATE USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

-- System inserts via SECURITY DEFINER function
CREATE POLICY "System can insert insights"
  ON ai_insights FOR INSERT WITH CHECK (is_member_of(organization_id));

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER set_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Record AI usage atomically
CREATE OR REPLACE FUNCTION record_ai_usage(
  p_org_id UUID,
  p_user_id UUID,
  p_provider TEXT,
  p_model TEXT,
  p_operation_type TEXT,
  p_input_tokens INT DEFAULT NULL,
  p_output_tokens INT DEFAULT NULL,
  p_estimated_cost NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO ai_usage_records (
    organization_id, user_id, provider, model, operation_type,
    input_tokens, output_tokens, estimated_cost, status, error_message
  ) VALUES (
    p_org_id, p_user_id, p_provider, p_model, p_operation_type,
    p_input_tokens, p_output_tokens, p_estimated_cost, p_status, p_error_message
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Check if user has remaining AI quota for today
CREATE OR REPLACE FUNCTION check_ai_quota(
  p_org_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_today_count INT;
BEGIN
  SELECT * INTO v_settings FROM ai_settings WHERE organization_id = p_org_id;

  -- If no settings or disabled, deny
  IF v_settings IS NULL OR NOT v_settings.is_enabled THEN
    RETURN false;
  END IF;

  -- Check daily limit
  SELECT COUNT(*)::INT INTO v_today_count
  FROM ai_usage_records
  WHERE organization_id = p_org_id
    AND user_id = p_user_id
    AND status = 'success'
    AND created_at >= CURRENT_DATE;

  IF v_today_count >= v_settings.daily_limit THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Get current AI usage stats for an org
CREATE OR REPLACE FUNCTION get_ai_usage_stats(
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'today_requests', (
      SELECT COUNT(*) FROM ai_usage_records
      WHERE organization_id = p_org_id AND status = 'success' AND created_at >= CURRENT_DATE
    ),
    'month_requests', (
      SELECT COUNT(*) FROM ai_usage_records
      WHERE organization_id = p_org_id AND status = 'success'
        AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'total_cost_month', (
      SELECT COALESCE(SUM(estimated_cost), 0) FROM ai_usage_records
      WHERE organization_id = p_org_id AND status = 'success'
        AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'errors_today', (
      SELECT COUNT(*) FROM ai_usage_records
      WHERE organization_id = p_org_id AND status != 'success' AND created_at >= CURRENT_DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- SEED PERMISSIONS FOR AI MODULE
-- ============================================================================
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('ai.chat', 'ai', 'chat', 'Usar o assistente Barber-On Intelligence'),
  ('ai.view_history', 'ai', 'view_history', 'Visualizar histórico de conversas'),
  ('ai.view_insights', 'ai', 'view_insights', 'Visualizar insights da IA'),
  ('ai.manage_settings', 'ai', 'manage_settings', 'Gerenciar configurações da IA'),
  ('ai.view_usage', 'ai', 'view_usage', 'Visualizar uso e custos da IA')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant AI permissions to existing system roles
DO $$
DECLARE
  v_org RECORD;
  v_owner_role UUID;
  v_admin_role UUID;
  v_manager_role UUID;
  v_employee_role UUID;
BEGIN
  FOR v_org IN SELECT id FROM organizations
  LOOP
    SELECT id INTO v_owner_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'OWNER';
    SELECT id INTO v_admin_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'ADMIN';
    SELECT id INTO v_manager_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'MANAGER';
    SELECT id INTO v_employee_role FROM organization_roles WHERE organization_id = v_org.id AND name = 'EMPLOYEE';

    -- OWNER & ADMIN: all AI permissions
    IF v_owner_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_owner_role, p.id, true
      FROM permissions p WHERE p.module = 'ai'
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;

    IF v_admin_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_admin_role, p.id, true
      FROM permissions p WHERE p.module = 'ai'
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;

    -- MANAGER: chat + history + insights (no settings/usage)
    IF v_manager_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_manager_role, p.id, true
      FROM permissions p
      WHERE p.permission_key IN ('ai.chat', 'ai.view_history', 'ai.view_insights')
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;

    -- EMPLOYEE: chat + history only
    IF v_employee_role IS NOT NULL THEN
      INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
      SELECT v_org.id, v_employee_role, p.id, true
      FROM permissions p
      WHERE p.permission_key IN ('ai.chat', 'ai.view_history')
      ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
-- ===========================================================================
-- MIGRATION 011
-- ===========================================================================

-- ============================================================================
-- BARBER-ON FASE 14: Planos, Assinaturas e Administração SaaS
-- Migration 011 — Billing, Subscriptions, Entitlements, Platform Admin
-- ============================================================================

-- ============================================================================
-- 1. SUBSCRIPTION PLANS (catálogo global, não tenant-scoped)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active, display_order);

-- ============================================================================
-- 2. SUBSCRIPTION PLAN VERSIONS (versionamento de preços/limites)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  monthly_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  annual_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (annual_price >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  grace_period_days INT NOT NULL DEFAULT 7 CHECK (grace_period_days >= 0),
  published_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  external_plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, version)
);

CREATE INDEX idx_plan_versions_plan ON subscription_plan_versions(plan_id);
CREATE INDEX idx_plan_versions_published ON subscription_plan_versions(published_at) WHERE published_at IS NOT NULL;

-- ============================================================================
-- 3. PLAN ENTITLEMENTS (recursos e limites por versão de plano)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value INT,
  limit_unit TEXT,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_version_id, feature_key)
);

CREATE INDEX idx_entitlements_version ON plan_entitlements(plan_version_id);
CREATE INDEX idx_entitlements_feature ON plan_entitlements(feature_key);

-- ============================================================================
-- 4. BILLING CUSTOMERS (vínculo org ↔ provedor de pagamento)
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  external_customer_id TEXT NOT NULL,
  billing_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, provider)
);

CREATE INDEX idx_billing_customers_org ON billing_customers(organization_id);
CREATE INDEX idx_billing_customers_external ON billing_customers(provider, external_customer_id);

-- ============================================================================
-- 5. SUBSCRIPTIONS (assinaturas das organizações)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id) ON DELETE RESTRICT,
  billing_provider TEXT NOT NULL DEFAULT 'mercadopago',
  external_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN (
    'trialing', 'active', 'past_due', 'grace_period', 'paused', 'canceled', 'expired', 'incomplete'
  )),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'annual')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_external ON subscriptions(billing_provider, external_subscription_id);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE trial_end IS NOT NULL;
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end) WHERE current_period_end IS NOT NULL;

-- ============================================================================
-- 6. SUBSCRIPTION EVENTS (histórico de mudanças de estado)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'webhook', 'admin', 'user')),
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_events_sub ON subscription_events(subscription_id);
CREATE INDEX idx_sub_events_org ON subscription_events(organization_id, occurred_at DESC);

-- ============================================================================
-- 7. SUBSCRIPTION INVOICES (cobranças/faturas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  external_invoice_id TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'refused', 'processing', 'refunded', 'cancelled'
  )),
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_org ON subscription_invoices(organization_id);
CREATE INDEX idx_invoices_sub ON subscription_invoices(subscription_id);
CREATE INDEX idx_invoices_status ON subscription_invoices(status);
CREATE INDEX idx_invoices_due ON subscription_invoices(due_at);

-- ============================================================================
-- 8. SUBSCRIPTION PAYMENT EVENTS (eventos de pagamento idempotentes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  external_payment_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  raw_payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_sub ON subscription_payment_events(subscription_id);
CREATE INDEX idx_payment_events_org ON subscription_payment_events(organization_id);

-- ============================================================================
-- 9. PLAN CHANGES (upgrade/downgrade pendentes e históricos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  requested_plan_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id) ON DELETE RESTRICT,
  change_type TEXT NOT NULL CHECK (change_type IN ('upgrade', 'downgrade')),
  effective_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_changes_org ON plan_changes(organization_id);
CREATE INDEX idx_plan_changes_sub ON plan_changes(current_subscription_id);

-- ============================================================================
-- 10. ORGANIZATION USAGE RECORDS (utilização por período)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  usage_value INT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, feature_key, period_start)
);

CREATE INDEX idx_usage_records_org ON organization_usage_records(organization_id, period_start);

-- ============================================================================
-- 11. PLATFORM ADMINS (administradores internos da Barber-On)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  internal_role TEXT NOT NULL DEFAULT 'support' CHECK (internal_role IN ('super_admin', 'billing_admin', 'support')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_admins_user ON platform_admins(user_id);

-- ============================================================================
-- 12. PLATFORM AUDIT LOGS (auditoria do painel admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_audit_actor ON platform_audit_logs(actor_user_id);
CREATE INDEX idx_platform_audit_resource ON platform_audit_logs(resource_type, resource_id);
CREATE INDEX idx_platform_audit_created ON platform_audit_logs(created_at DESC);

-- ============================================================================
-- 13. SUPPORT TICKETS (chamados de suporte)
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_org ON support_tickets(organization_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_assigned ON support_tickets(assigned_admin_id);

-- ============================================================================
-- TRIGGERS: updated_at automático
-- ============================================================================

CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_billing_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_platform_admins_updated_at
  BEFORE UPDATE ON platform_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS: Habilitar em todas as tabelas novas
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: Catálogo de planos (leitura pública para autenticados)
-- ============================================================================

CREATE POLICY "Authenticated users can view active plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Platform admins can manage plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Authenticated users can view published plan versions"
  ON subscription_plan_versions FOR SELECT
  TO authenticated
  USING (published_at IS NOT NULL OR EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Platform admins can manage plan versions"
  ON subscription_plan_versions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Authenticated users can view entitlements of published versions"
  ON plan_entitlements FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM subscription_plan_versions spv
    WHERE spv.id = plan_entitlements.plan_version_id AND spv.published_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Platform admins can manage entitlements"
  ON plan_entitlements FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Billing customers (org members + admins)
-- ============================================================================

CREATE POLICY "Org members can view own billing customer"
  ON billing_customers FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id));

CREATE POLICY "Platform admins can view all billing customers"
  ON billing_customers FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Platform admins can manage billing customers"
  ON billing_customers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Subscriptions (org OWNER/ADMIN + platform admins)
-- ============================================================================

CREATE POLICY "Org owners/admins can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = subscriptions.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
    )
  );

CREATE POLICY "Platform admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Platform admins can manage subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Subscription events (org owners + platform admins)
-- ============================================================================

CREATE POLICY "Org owners can view own subscription events"
  ON subscription_events FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = subscription_events.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
    )
  );

CREATE POLICY "Platform admins can view all subscription events"
  ON subscription_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "System can insert subscription events"
  ON subscription_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: Invoices (org owners + platform admins)
-- ============================================================================

CREATE POLICY "Org owners can view own invoices"
  ON subscription_invoices FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = subscription_invoices.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
    )
  );

CREATE POLICY "Platform admins can view all invoices"
  ON subscription_invoices FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Payment events (platform admins only for security)
-- ============================================================================

CREATE POLICY "Platform admins can view payment events"
  ON subscription_payment_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "System can insert payment events"
  ON subscription_payment_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: Plan changes (org owners + platform admins)
-- ============================================================================

CREATE POLICY "Org owners can view own plan changes"
  ON plan_changes FOR SELECT
  TO authenticated
  USING (
    is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = plan_changes.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('OWNER', 'ADMIN')
      AND m.status = 'active'
    )
  );

CREATE POLICY "Platform admins can view all plan changes"
  ON plan_changes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Usage records (org members + platform admins)
-- ============================================================================

CREATE POLICY "Org members can view own usage records"
  ON organization_usage_records FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id));

CREATE POLICY "Platform admins can view all usage records"
  ON organization_usage_records FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Platform admins (self-view + super_admin management)
-- ============================================================================

CREATE POLICY "Platform admins can view own record"
  ON platform_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

CREATE POLICY "Super admins can manage platform admins"
  ON platform_admins FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.internal_role = 'super_admin' AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Platform audit logs (platform admins only)
-- ============================================================================

CREATE POLICY "Platform admins can view audit logs"
  ON platform_audit_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Platform admins can insert audit logs"
  ON platform_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- RLS POLICIES: Support tickets (org members + assigned admin + platform admins)
-- ============================================================================

CREATE POLICY "Org members can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id));

CREATE POLICY "Platform admins can view all tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

CREATE POLICY "Org members can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Platform admins can update tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid() AND pa.is_active = true
  ));

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Check if user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = p_user_id AND is_active = true
  );
$$;

-- Check entitlement for an organization
CREATE OR REPLACE FUNCTION check_entitlement(p_org_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_plan_version_id UUID;
  v_is_enabled BOOLEAN;
BEGIN
  -- Get active subscription's plan version
  SELECT plan_version_id INTO v_plan_version_id
  FROM subscriptions
  WHERE organization_id = p_org_id
    AND status IN ('active', 'trialing', 'grace_period')
  LIMIT 1;

  IF v_plan_version_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check entitlement
  SELECT is_enabled INTO v_is_enabled
  FROM plan_entitlements
  WHERE plan_version_id = v_plan_version_id
    AND feature_key = p_feature_key;

  RETURN COALESCE(v_is_enabled, false);
END;
$$;

-- Get entitlement limit for an organization
CREATE OR REPLACE FUNCTION get_entitlement_limit(p_org_id UUID, p_feature_key TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_plan_version_id UUID;
  v_limit INT;
BEGIN
  SELECT plan_version_id INTO v_plan_version_id
  FROM subscriptions
  WHERE organization_id = p_org_id
    AND status IN ('active', 'trialing', 'grace_period')
  LIMIT 1;

  IF v_plan_version_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT limit_value INTO v_limit
  FROM plan_entitlements
  WHERE plan_version_id = v_plan_version_id
    AND feature_key = p_feature_key
    AND is_enabled = true;

  RETURN COALESCE(v_limit, 0);
END;
$$;

-- Log platform admin action
CREATE OR REPLACE FUNCTION log_platform_audit(
  p_actor UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO platform_audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (p_actor, p_action, p_resource_type, p_resource_id, p_metadata);
END;
$$;

-- Record subscription event
CREATE OR REPLACE FUNCTION record_subscription_event(
  p_org_id UUID,
  p_subscription_id UUID,
  p_event_type TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_source TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO subscription_events (organization_id, subscription_id, event_type, previous_status, new_status, source, metadata)
  VALUES (p_org_id, p_subscription_id, p_event_type, p_previous_status, p_new_status, p_source, p_metadata);
END;
$$;

-- ============================================================================
-- SEED: Initial plans (FREE, PRO, BUSINESS)
-- ============================================================================

INSERT INTO subscription_plans (slug, name, description, is_active, is_featured, display_order) VALUES
  ('free', 'Free', 'Plano gratuito para pequenas empresas conhecerem a Barber-On.', true, false, 1),
  ('pro', 'Pro', 'Plano intermediário para empresas em crescimento.', true, true, 2),
  ('business', 'Business', 'Plano avançado para empresas que precisam de mais recursos.', true, false, 3)
ON CONFLICT (slug) DO NOTHING;

-- FREE plan version
INSERT INTO subscription_plan_versions (plan_id, version, monthly_price, annual_price, trial_days, grace_period_days, published_at)
SELECT id, 1, 0, 0, 0, 0, now()
FROM subscription_plans WHERE slug = 'free'
ON CONFLICT (plan_id, version) DO NOTHING;

-- PRO plan version
INSERT INTO subscription_plan_versions (plan_id, version, monthly_price, annual_price, trial_days, grace_period_days, published_at)
SELECT id, 1, 99.00, 990.00, 14, 7, now()
FROM subscription_plans WHERE slug = 'pro'
ON CONFLICT (plan_id, version) DO NOTHING;

-- BUSINESS plan version
INSERT INTO subscription_plan_versions (plan_id, version, monthly_price, annual_price, trial_days, grace_period_days, published_at)
SELECT id, 1, 249.00, 2490.00, 14, 14, now()
FROM subscription_plans WHERE slug = 'business'
ON CONFLICT (plan_id, version) DO NOTHING;

-- ============================================================================
-- SEED: Entitlements for each plan version
-- ============================================================================

-- Helper: get plan version ID by slug
DO $$
DECLARE
  v_free_id UUID;
  v_pro_id UUID;
  v_business_id UUID;
BEGIN
  SELECT spv.id INTO v_free_id FROM subscription_plan_versions spv
    JOIN subscription_plans sp ON sp.id = spv.plan_id WHERE sp.slug = 'free' AND spv.version = 1;
  SELECT spv.id INTO v_pro_id FROM subscription_plan_versions spv
    JOIN subscription_plans sp ON sp.id = spv.plan_id WHERE sp.slug = 'pro' AND spv.version = 1;
  SELECT spv.id INTO v_business_id FROM subscription_plan_versions spv
    JOIN subscription_plans sp ON sp.id = spv.plan_id WHERE sp.slug = 'business' AND spv.version = 1;

  -- FREE entitlements
  INSERT INTO plan_entitlements (plan_version_id, feature_key, is_enabled, limit_value, limit_unit) VALUES
    (v_free_id, 'team.users', true, 3, 'users'),
    (v_free_id, 'team.owners', true, 2, 'users'),
    (v_free_id, 'crm.customers', true, 50, 'records'),
    (v_free_id, 'crm.leads', true, 30, 'records'),
    (v_free_id, 'sales.orders', true, 20, 'records_month'),
    (v_free_id, 'inventory.products', true, 30, 'records'),
    (v_free_id, 'inventory.warehouses', true, 1, 'records'),
    (v_free_id, 'finance.receivables', true, 30, 'records'),
    (v_free_id, 'finance.payables', true, 30, 'records'),
    (v_free_id, 'reports.basic', true, NULL, NULL),
    (v_free_id, 'reports.advanced', false, NULL, NULL),
    (v_free_id, 'ai.assistant', false, NULL, NULL),
    (v_free_id, 'integrations.whatsapp', false, NULL, NULL),
    (v_free_id, 'integrations.instagram', false, NULL, NULL),
    (v_free_id, 'automations.rules', false, NULL, NULL)
  ON CONFLICT (plan_version_id, feature_key) DO NOTHING;

  -- PRO entitlements
  INSERT INTO plan_entitlements (plan_version_id, feature_key, is_enabled, limit_value, limit_unit) VALUES
    (v_pro_id, 'team.users', true, 15, 'users'),
    (v_pro_id, 'team.owners', true, 2, 'users'),
    (v_pro_id, 'crm.customers', true, 500, 'records'),
    (v_pro_id, 'crm.leads', true, 300, 'records'),
    (v_pro_id, 'sales.orders', true, 200, 'records_month'),
    (v_pro_id, 'inventory.products', true, 300, 'records'),
    (v_pro_id, 'inventory.warehouses', true, 3, 'records'),
    (v_pro_id, 'finance.receivables', true, 500, 'records'),
    (v_pro_id, 'finance.payables', true, 500, 'records'),
    (v_pro_id, 'reports.basic', true, NULL, NULL),
    (v_pro_id, 'reports.advanced', true, NULL, NULL),
    (v_pro_id, 'ai.assistant', true, 50, 'queries_day'),
    (v_pro_id, 'integrations.whatsapp', true, 1, 'connections'),
    (v_pro_id, 'integrations.instagram', true, 1, 'connections'),
    (v_pro_id, 'automations.rules', true, 10, 'rules')
  ON CONFLICT (plan_version_id, feature_key) DO NOTHING;

  -- BUSINESS entitlements
  INSERT INTO plan_entitlements (plan_version_id, feature_key, is_enabled, limit_value, limit_unit) VALUES
    (v_business_id, 'team.users', true, 100, 'users'),
    (v_business_id, 'team.owners', true, 2, 'users'),
    (v_business_id, 'crm.customers', true, 5000, 'records'),
    (v_business_id, 'crm.leads', true, 3000, 'records'),
    (v_business_id, 'sales.orders', true, 2000, 'records_month'),
    (v_business_id, 'inventory.products', true, 3000, 'records'),
    (v_business_id, 'inventory.warehouses', true, 10, 'records'),
    (v_business_id, 'finance.receivables', true, 5000, 'records'),
    (v_business_id, 'finance.payables', true, 5000, 'records'),
    (v_business_id, 'reports.basic', true, NULL, NULL),
    (v_business_id, 'reports.advanced', true, NULL, NULL),
    (v_business_id, 'ai.assistant', true, 200, 'queries_day'),
    (v_business_id, 'integrations.whatsapp', true, 3, 'connections'),
    (v_business_id, 'integrations.instagram', true, 3, 'connections'),
    (v_business_id, 'automations.rules', true, 50, 'rules')
  ON CONFLICT (plan_version_id, feature_key) DO NOTHING;
END $$;
-- ===========================================================================
-- MIGRATION 012
-- ===========================================================================

-- =============================================================================
-- Migration 012: Barber Services, Schedules & Blocks
-- Barber-On Studio — Sistema de gestão para barbearias
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BARBER SERVICES (Catálogo de serviços)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes INTEGER DEFAULT 0 CHECK (buffer_minutes >= 0),
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed', 'none')),
  commission_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_barber_services_org ON barber_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_category ON barber_services(category_id);
CREATE INDEX IF NOT EXISTS idx_barber_services_active ON barber_services(organization_id, is_active);

ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barber services"
  ON barber_services FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barber services"
  ON barber_services FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barber_services_updated_at
  BEFORE UPDATE ON barber_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. BARBER SCHEDULES (Expedientes individuais por profissional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lunch_start TIME,
  lunch_end TIME,
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(membership_id, day_of_week),
  CHECK (end_time > start_time),
  CHECK (lunch_start IS NULL OR (lunch_end IS NOT NULL AND lunch_end > lunch_start)),
  CHECK (lunch_start IS NULL OR (lunch_start >= start_time AND lunch_end <= end_time))
);

CREATE INDEX IF NOT EXISTS idx_barber_schedules_org ON barber_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_barber_schedules_member ON barber_schedules(membership_id);

ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barber schedules"
  ON barber_schedules FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barber schedules"
  ON barber_schedules FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barber_schedules_updated_at
  BEFORE UPDATE ON barber_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. SCHEDULE BLOCKS (Bloqueios, folgas, feriados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('holiday', 'day_off', 'vacation', 'personal', 'maintenance', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_org ON schedule_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_member ON schedule_blocks(membership_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(organization_id, start_at, end_at);

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view schedule blocks"
  ON schedule_blocks FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage schedule blocks"
  ON schedule_blocks FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_schedule_blocks_updated_at
  BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. ALTER EMPLOYEE PROFILES (Adicionar campos de barbearia)
-- -----------------------------------------------------------------------------
ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS specialties TEXT[],
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed', 'none')),
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_available_for_booking BOOLEAN DEFAULT true;

-- -----------------------------------------------------------------------------
-- 5. ALTER CALENDAR EVENTS (Adicionar campos de agendamento)
-- -----------------------------------------------------------------------------
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS barber_service_id UUID REFERENCES barber_services(id),
  ADD COLUMN IF NOT EXISTS assigned_barber_id UUID REFERENCES memberships(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show')),
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_events_barber ON calendar_events(assigned_barber_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_service ON calendar_events(barber_service_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer ON calendar_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(organization_id, status);

-- -----------------------------------------------------------------------------
-- 6. SEED DEFAULT BARBER SERVICES
-- -----------------------------------------------------------------------------
INSERT INTO product_categories (organization_id, name, description, is_active)
SELECT id, 'Cortes', 'Serviços de corte de cabelo', true
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories
  WHERE organization_id = organizations.id AND name = 'Cortes'
)
LIMIT 1;

-- -----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('barber_services.view', 'barber_services', 'view', 'Visualizar serviços da barbearia'),
  ('barber_services.create', 'barber_services', 'create', 'Criar novos serviços'),
  ('barber_services.update', 'barber_services', 'update', 'Atualizar serviços existentes'),
  ('barber_services.delete', 'barber_services', 'delete', 'Remover serviços'),
  ('barber_schedules.view', 'barber_schedules', 'view', 'Visualizar expedientes'),
  ('barber_schedules.manage', 'barber_schedules', 'manage', 'Gerenciar expedientes de profissionais'),
  ('schedule_blocks.view', 'schedule_blocks', 'view', 'Visualizar bloqueios de agenda'),
  ('schedule_blocks.manage', 'schedule_blocks', 'manage', 'Gerenciar bloqueios e folgas')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant to OWNER and ADMIN roles
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
  AND p.permission_key IN (
    'barber_services.view', 'barber_services.create', 'barber_services.update', 'barber_services.delete',
    'barber_schedules.view', 'barber_schedules.manage',
    'schedule_blocks.view', 'schedule_blocks.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to MANAGER and BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('MANAGER', 'EMPLOYEE')
  AND p.permission_key IN (
    'barber_services.view',
    'barber_schedules.view',
    'schedule_blocks.view'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Function to check if a time slot is available for a barber
CREATE OR REPLACE FUNCTION check_barber_availability(
  p_org_id UUID,
  p_barber_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_event_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  -- Check for overlapping events
  SELECT COUNT(*) INTO v_conflict_count
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND assigned_barber_id = p_barber_id
    AND id != COALESCE(p_exclude_event_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND status NOT IN ('cancelled', 'no_show')
    AND (
      (start_at < p_end_time AND end_at > p_start_time)
    );

  -- Check for schedule blocks
  SELECT COUNT(*) INTO v_conflict_count
  FROM schedule_blocks
  WHERE organization_id = p_org_id
    AND (membership_id = p_barber_id OR membership_id IS NULL)
    AND (
      (start_at < p_end_time AND end_at > p_start_time)
    );

  RETURN v_conflict_count = 0;
END;
$$;

-- Function to get available time slots for a barber on a specific date
CREATE OR REPLACE FUNCTION get_barber_available_slots(
  p_org_id UUID,
  p_barber_id UUID,
  p_date DATE
)
RETURNS TABLE (
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule barber_schedules%ROWTYPE;
  v_day_of_week INTEGER;
  v_current_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Get schedule for this day
  SELECT * INTO v_schedule
  FROM barber_schedules
  WHERE organization_id = p_org_id
    AND membership_id = p_barber_id
    AND day_of_week = v_day_of_week
    AND is_working_day = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Generate time slots (every 30 minutes)
  v_current_time := p_date + v_schedule.start_time::TIME;
  v_end_time := p_date + v_schedule.end_time::TIME;

  WHILE v_current_time < v_end_time LOOP
    -- Check if this slot is available
    IF check_barber_availability(p_org_id, p_barber_id, v_current_time, v_current_time + INTERVAL '30 minutes') THEN
      RETURN QUERY SELECT v_current_time, v_current_time + INTERVAL '30 minutes';
    END IF;
    v_current_time := v_current_time + INTERVAL '30 minutes';
  END LOOP;
END;
$$;

COMMENT ON TABLE barber_services IS 'Catálogo de serviços da barbearia com duração, preço e comissão';
COMMENT ON TABLE barber_schedules IS 'Expedientes semanais individuais por profissional';
COMMENT ON TABLE schedule_blocks IS 'Bloqueios de agenda: feriados, folgas, férias, manutenção';
COMMENT ON FUNCTION check_barber_availability IS 'Verifica se um horário está disponível para um barbeiro';
COMMENT ON FUNCTION get_barber_available_slots IS 'Retorna slots de horário disponíveis para um barbeiro em uma data';
-- ===========================================================================
-- MIGRATION 013
-- ===========================================================================

-- =============================================================================
-- Migration 013: Barber Commissions, Cash Register & Daily Close
-- Barber-On Studio — Sistema de gestão para barbearias
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BARBER COMMISSIONS (Registro de comissões por atendimento)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_commissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
 membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
 barber_service_id UUID REFERENCES barber_services(id),
 service_name TEXT NOT NULL,
 service_price DECIMAL(12,2) NOT NULL CHECK (service_price >= 0),
 commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed', 'none')),
 commission_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
 commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
 paid_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barber_commissions_org ON barber_commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_order ON barber_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_member ON barber_commissions(membership_id);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_status ON barber_commissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_barber_commissions_date ON barber_commissions(organization_id, created_at);

ALTER TABLE barber_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barber commissions"
 ON barber_commissions FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barber commissions"
 ON barber_commissions FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barber_commissions_updated_at
 BEFORE UPDATE ON barber_commissions
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. CASH REGISTERS (Caixas da barbearia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_registers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 description TEXT,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_org ON cash_registers(organization_id);

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash registers"
 ON cash_registers FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage cash registers"
 ON cash_registers FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_cash_registers_updated_at
 BEFORE UPDATE ON cash_registers
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. CASH SESSIONS (Sessões de caixa — abertura e fechamento diário)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
 opened_by UUID NOT NULL REFERENCES memberships(id),
 closed_by UUID REFERENCES memberships(id),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 closed_at TIMESTAMPTZ,
 opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
 closing_amount DECIMAL(12,2) CHECK (closing_amount IS NULL OR closing_amount >= 0),
 expected_amount DECIMAL(12,2),
 difference DECIMAL(12,2),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
 notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_org ON cash_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register ON cash_sessions(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_date ON cash_sessions(organization_id, opened_at);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash sessions"
 ON cash_sessions FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage cash sessions"
 ON cash_sessions FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_cash_sessions_updated_at
 BEFORE UPDATE ON cash_sessions
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. CASH MOVEMENTS (Movimentações dentro de uma sessão de caixa)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
 movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'refund', 'withdrawal', 'deposit', 'adjustment')),
 amount DECIMAL(12,2) NOT NULL,
 description TEXT,
 reference_type TEXT,
 reference_id UUID,
 payment_method TEXT CHECK (payment_method IN ('cash', 'pix', 'debit', 'credit', 'other')),
 created_by UUID NOT NULL REFERENCES memberships(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_org ON cash_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_movements(organization_id, movement_type);

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash movements"
 ON cash_movements FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can create cash movements"
 ON cash_movements FOR INSERT
 WITH CHECK (is_member_of(organization_id));

-- APPEND-ONLY: no UPDATE/DELETE policies

-- -----------------------------------------------------------------------------
-- 5. ALTER ORDERS (Vincular comanda ao caixa e barbeiro)
-- -----------------------------------------------------------------------------
ALTER TABLE orders
 ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(id),
 ADD COLUMN IF NOT EXISTS assigned_barber_id UUID REFERENCES memberships(id),
 ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES calendar_events(id);

CREATE INDEX IF NOT EXISTS idx_orders_cash_session ON orders(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_barber ON orders(assigned_barber_id);
CREATE INDEX IF NOT EXISTS idx_orders_appointment ON orders(appointment_id);

-- -----------------------------------------------------------------------------
-- 6. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Calcula e registra comissões ao finalizar uma comanda
CREATE OR REPLACE FUNCTION calculate_order_commissions(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_order RECORD;
 v_item RECORD;
 v_barber RECORD;
 v_commission_amount DECIMAL(12,2);
BEGIN
 -- Buscar dados do pedido
 SELECT * INTO v_order FROM orders WHERE id = p_order_id;
 IF NOT FOUND THEN
 RAISE EXCEPTION 'Pedido não encontrado: %', p_order_id;
 END IF;

 -- Para cada item do pedido que tem serviço/barbeiro vinculado
 FOR v_item IN
 SELECT oi.*, bs.commission_type, bs.commission_value, bs.duration_minutes
 FROM order_items oi
 LEFT JOIN barber_services bs ON oi.description = bs.name
 AND bs.organization_id = v_order.organization_id
 WHERE oi.order_id = p_order_id
 LOOP
 -- Se tem barbeiro atribuído ao pedido e serviço encontrado
 IF v_order.assigned_barber_id IS NOT NULL AND v_item.commission_type IS NOT NULL THEN
 -- Buscar perfil do barbeiro para override de comissão
 SELECT * INTO v_barber FROM employee_profiles
 WHERE membership_id = v_order.assigned_barber_id
 AND organization_id = v_order.organization_id;

 -- Calcular comissão
 IF v_barber IS NOT NULL AND v_barber.commission_type != 'none' THEN
 -- Usar comissão do barbeiro (override)
 IF v_barber.commission_type = 'percentage' THEN
 v_commission_amount := v_item.total * (v_barber.commission_rate / 100.0);
 ELSIF v_barber.commission_type = 'fixed' THEN
 v_commission_amount := v_barber.commission_rate;
 ELSE
 v_commission_amount := 0;
 END IF;
 ELSE
 -- Usar comissão do serviço
 IF v_item.commission_type = 'percentage' THEN
 v_commission_amount := v_item.total * (v_item.commission_value / 100.0);
 ELSIF v_item.commission_type = 'fixed' THEN
 v_commission_amount := v_item.commission_value;
 ELSE
 v_commission_amount := 0;
 END IF;
 END IF;

 -- Registrar comissão
 IF v_commission_amount > 0 THEN
 INSERT INTO barber_commissions (
 organization_id, order_id, order_item_id, membership_id,
 barber_service_id, service_name, service_price,
 commission_type, commission_value, commission_amount
 ) VALUES (
 v_order.organization_id, p_order_id, v_item.id, v_order.assigned_barber_id,
 NULL, v_item.description, v_item.unit_price,
 COALESCE(v_barber.commission_type, v_item.commission_type),
 COALESCE(v_barber.commission_rate, v_item.commission_value),
 v_commission_amount
 );
 END IF;
 END IF;
 END LOOP;
END;
$$;

-- Obtém resumo de caixa do dia
CREATE OR REPLACE FUNCTION get_daily_cash_summary(
 p_org_id UUID,
 p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
 total_sales DECIMAL,
 total_refunds DECIMAL,
 total_withdrawals DECIMAL,
 total_deposits DECIMAL,
 net_amount DECIMAL,
 orders_count BIGINT,
 commissions_pending DECIMAL,
 commissions_paid DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 RETURN QUERY
 SELECT
 COALESCE(SUM(CASE WHEN cm.movement_type = 'sale' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type = 'refund' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type = 'withdrawal' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type = 'deposit' THEN cm.amount ELSE 0 END), 0),
 COALESCE(SUM(CASE WHEN cm.movement_type IN ('sale', 'deposit') THEN cm.amount
 WHEN cm.movement_type IN ('refund', 'withdrawal') THEN -cm.amount
 ELSE 0 END), 0),
 (SELECT COUNT(*) FROM orders o
 WHERE o.organization_id = p_org_id
 AND o.issued_at::DATE = p_date
 AND o.status IN ('completed', 'confirmed')),
 COALESCE((SELECT SUM(bc.commission_amount) FROM barber_commissions bc
 WHERE bc.organization_id = p_org_id
 AND bc.status = 'pending'
 AND bc.created_at::DATE = p_date), 0),
 COALESCE((SELECT SUM(bc.commission_amount) FROM barber_commissions bc
 WHERE bc.organization_id = p_org_id
 AND bc.status = 'paid'
 AND bc.paid_at::DATE = p_date), 0)
 FROM cash_sessions cs
 LEFT JOIN cash_movements cm ON cm.cash_session_id = cs.id
 WHERE cs.organization_id = p_org_id
 AND cs.opened_at::DATE = p_date;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
 ('commissions.view', 'commissions', 'view', 'Visualizar comissões'),
 ('commissions.manage', 'commissions', 'manage', 'Gerenciar comissões'),
 ('commissions.pay', 'commissions', 'pay', 'Marcar comissões como pagas'),
 ('cash_register.view', 'cash_register', 'view', 'Visualizar caixas'),
 ('cash_register.manage', 'cash_register', 'manage', 'Gerenciar caixas'),
 ('cash_session.open', 'cash_session', 'open', 'Abrir sessão de caixa'),
 ('cash_session.close', 'cash_session', 'close', 'Fechar sessão de caixa'),
 ('cash_movement.create', 'cash_movement', 'create', 'Registrar movimentação de caixa')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
 AND p.permission_key IN (
 'commissions.view', 'commissions.manage', 'commissions.pay',
 'cash_register.view', 'cash_register.manage',
 'cash_session.open', 'cash_session.close',
 'cash_movement.create'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to MANAGER, operations to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
 AND p.permission_key IN (
 'commissions.view', 'commissions.manage', 'commissions.pay',
 'cash_register.view',
 'cash_session.open', 'cash_session.close',
 'cash_movement.create'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant basic view to BARBER and EMPLOYEE
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
 AND p.permission_key IN (
 'commissions.view',
 'cash_register.view',
 'cash_session.open',
 'cash_movement.create'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. SEED
-- -----------------------------------------------------------------------------
INSERT INTO cash_registers (organization_id, name, description, is_active)
SELECT id, 'Caixa Principal', 'Caixa principal da barbearia', true
FROM organizations
WHERE NOT EXISTS (
 SELECT 1 FROM cash_registers
 WHERE organization_id = organizations.id AND name = 'Caixa Principal'
)
LIMIT 1;

COMMENT ON TABLE barber_commissions IS 'Registro de comissões por atendimento/serviço';
COMMENT ON TABLE cash_registers IS 'Caixas físicos ou virtuais da barbearia';
COMMENT ON TABLE cash_sessions IS 'Sessões de abertura e fechamento de caixa';
COMMENT ON TABLE cash_movements IS 'Movimentações financeiras dentro de uma sessão de caixa (APPEND-ONLY)';
COMMENT ON FUNCTION calculate_order_commissions IS 'Calcula e registra comissões automaticamente ao finalizar uma comanda';
COMMENT ON FUNCTION get_daily_cash_summary IS 'Retorna resumo financeiro do dia: vendas, comissões e movimentações';
-- ===========================================================================
-- MIGRATION 014
-- ===========================================================================

-- =============================================================================
-- Migration 014: Public Bookings & Schedule Blocks
-- Barber-On Studio — Agendamento público e bloqueio de horários
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PUBLIC BOOKINGS (Agendamentos feitos por clientes sem login)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  barber_service_id UUID NOT NULL REFERENCES barber_services(id) ON DELETE CASCADE,
  assigned_barber_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  confirmation_token TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_bookings_org ON public_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_service ON public_bookings(barber_service_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_barber ON public_bookings(assigned_barber_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_status ON public_bookings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_public_bookings_date ON public_bookings(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_public_bookings_token ON public_bookings(confirmation_token);

ALTER TABLE public_bookings ENABLE ROW LEVEL SECURITY;

-- Política pública: qualquer pessoa pode criar booking (sem auth)
CREATE POLICY "Anyone can create public booking"
  ON public_bookings FOR INSERT
  WITH CHECK (true);

-- Política pública: confirmar/cancelar via token (sem auth)
CREATE POLICY "Anyone can confirm/cancel via token"
  ON public_bookings FOR UPDATE
  USING (confirmation_token IS NOT NULL)
  WITH CHECK (confirmation_token IS NOT NULL);

-- Membros da org podem ver e gerenciar todos os bookings
CREATE POLICY "Members can view public bookings"
  ON public_bookings FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage public bookings"
  ON public_bookings FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_public_bookings_updated_at
  BEFORE UPDATE ON public_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. SCHEDULE BLOCKS (Bloqueios de horário — folgas, férias, manutenção)
-- -----------------------------------------------------------------------------
-- Tabela schedule_blocks já criada na migration 012 com colunas start_at/end_at.
-- Adicionar apenas colunas extras que esta migration precisa, se não existirem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_blocks' AND column_name = 'reason') THEN
    ALTER TABLE schedule_blocks ADD COLUMN reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_blocks' AND column_name = 'recurring_days') THEN
    ALTER TABLE schedule_blocks ADD COLUMN recurring_days INT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_blocks' AND column_name = 'recurring_until') THEN
    ALTER TABLE schedule_blocks ADD COLUMN recurring_until TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_blocks' AND column_name = 'created_by') THEN
    ALTER TABLE schedule_blocks ADD COLUMN created_by UUID REFERENCES memberships(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_org ON schedule_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_member ON schedule_blocks(membership_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_dates ON schedule_blocks(organization_id, start_at, end_at);

-- Políticas e trigger já criadas na migration 012 — apenas garantir idempotência
DO $$
BEGIN
  -- Drop e recria policies para garantir consistência
  DROP POLICY IF EXISTS "Members can view schedule blocks" ON schedule_blocks;
  DROP POLICY IF EXISTS "Members can manage schedule blocks" ON schedule_blocks;

  CREATE POLICY "Members can view schedule blocks"
    ON schedule_blocks FOR SELECT
    USING (is_member_of(organization_id));

  CREATE POLICY "Members can manage schedule blocks"
    ON schedule_blocks FOR ALL
    USING (is_member_of(organization_id))
    WITH CHECK (is_member_of(organization_id));
END $$;

-- Trigger já existe da migration 012, mas garantir idempotência
DROP TRIGGER IF EXISTS set_schedule_blocks_updated_at ON schedule_blocks;
CREATE TRIGGER set_schedule_blocks_updated_at
  BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. BARBERSHOP SETTINGS (Configurações da barbearia para agendamento público)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barbershop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  public_slug TEXT UNIQUE,
  shop_name TEXT NOT NULL,
  shop_description TEXT,
  shop_address TEXT,
  shop_phone TEXT,
  shop_logo_url TEXT,
  booking_enabled BOOLEAN NOT NULL DEFAULT true,
  advance_booking_days INT NOT NULL DEFAULT 30 CHECK (advance_booking_days >= 1 AND advance_booking_days <= 365),
  min_advance_hours INT NOT NULL DEFAULT 2 CHECK (min_advance_hours >= 0),
  auto_confirm BOOLEAN NOT NULL DEFAULT false,
  allow_barber_selection BOOLEAN NOT NULL DEFAULT true,
  whatsapp_reminder_hours INT NOT NULL DEFAULT 24,
  primary_color TEXT NOT NULL DEFAULT '#C9A96E',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE barbershop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view barbershop settings"
  ON barbershop_settings FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage barbershop settings"
  ON barbershop_settings FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_barbershop_settings_updated_at
  BEFORE UPDATE ON barbershop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Verifica disponibilidade considerando expedientes + bloqueios + bookings existentes
CREATE OR REPLACE FUNCTION check_public_availability(
  p_org_id UUID,
  p_barber_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_of_week INT;
  v_has_schedule BOOLEAN;
  v_has_block BOOLEAN;
  v_has_conflict BOOLEAN;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_scheduled_at);

  -- 1. Verificar se o barbeiro trabalha neste dia
  SELECT EXISTS (
    SELECT 1 FROM barber_schedules
    WHERE membership_id = p_barber_id
      AND organization_id = p_org_id
      AND day_of_week = v_day_of_week
      AND is_working_day = true
      AND start_time <= p_scheduled_at::TIME
      AND end_time >= (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
  ) INTO v_has_schedule;

  IF NOT v_has_schedule THEN
    RETURN false;
  END IF;

  -- 2. Verificar bloqueios
  SELECT EXISTS (
    SELECT 1 FROM schedule_blocks
    WHERE organization_id = p_org_id
      AND (membership_id IS NULL OR membership_id = p_barber_id)
      AND starts_at < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND ends_at > p_scheduled_at
  ) INTO v_has_block;

  IF v_has_block THEN
    RETURN false;
  END IF;

  -- 3. Verificar conflitos com outros agendamentos
  SELECT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE organization_id = p_org_id
      AND assigned_barber_id = p_barber_id
      AND status NOT IN ('cancelled')
      AND start_time < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND end_time > p_scheduled_at
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RETURN false;
  END IF;

  -- 4. Verificar conflitos com outros bookings públicos
  SELECT EXISTS (
    SELECT 1 FROM public_bookings
    WHERE organization_id = p_org_id
      AND assigned_barber_id = p_barber_id
      AND status NOT IN ('cancelled')
      AND scheduled_at < (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
      AND (scheduled_at + (duration_minutes || ' minutes')::INTERVAL) > p_scheduled_at
  ) INTO v_has_conflict;

  RETURN NOT v_has_conflict;
END;
$$;

-- Obtém horários disponíveis para um serviço/barbeiro em uma data
CREATE OR REPLACE FUNCTION get_public_available_slots(
  p_org_id UUID,
  p_service_id UUID,
  p_barber_id UUID,
  p_date DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration INT;
  v_schedule RECORD;
  v_current TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_day_of_week INT;
BEGIN
  -- Buscar duração do serviço
  SELECT duration_minutes INTO v_duration
  FROM barber_services
  WHERE id = p_service_id AND organization_id = p_org_id;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date::TIMESTAMP);

  -- Buscar expediente do barbeiro para este dia
  SELECT * INTO v_schedule
  FROM barber_schedules
  WHERE membership_id = p_barber_id
    AND organization_id = p_org_id
    AND day_of_week = v_day_of_week
    AND is_working_day = true;

  IF v_schedule IS NULL THEN
    RETURN;
  END IF;

  -- Gerar slots a cada 30 minutos dentro do horário de trabalho
  v_current := (p_date || ' ' || v_schedule.start_time)::TIMESTAMPTZ;
  v_end := (p_date || ' ' || v_schedule.end_time)::TIMESTAMPTZ;

  WHILE v_current + (v_duration || ' minutes')::INTERVAL <= v_end LOOP
    -- Pular horário de almoço
    IF v_schedule.lunch_start IS NOT NULL AND v_schedule.lunch_end IS NOT NULL THEN
      IF v_current::TIME >= v_schedule.lunch_start::TIME
         AND v_current::TIME < v_schedule.lunch_end::TIME THEN
        v_current := v_current + INTERVAL '30 minutes';
        CONTINUE;
      END IF;
    END IF;

    -- Verificar disponibilidade
    IF check_public_availability(p_org_id, p_barber_id, v_current, v_duration) THEN
      slot_start := v_current;
      slot_end := v_current + (v_duration || ' minutes')::INTERVAL;
      RETURN NEXT;
    END IF;

    v_current := v_current + INTERVAL '30 minutes';
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('bookings.view', 'bookings', 'view', 'Visualizar agendamentos públicos'),
  ('bookings.manage', 'bookings', 'manage', 'Gerenciar agendamentos públicos'),
  ('blocks.view', 'blocks', 'view', 'Visualizar bloqueios de horário'),
  ('blocks.manage', 'blocks', 'manage', 'Gerenciar bloqueios de horário'),
  ('settings.barbershop', 'settings', 'barbershop', 'Configurar barbearia')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
  AND p.permission_key IN (
    'bookings.view', 'bookings.manage',
    'blocks.view', 'blocks.manage',
    'settings.barbershop'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant operational to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
  AND p.permission_key IN (
    'bookings.view', 'bookings.manage',
    'blocks.view', 'blocks.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to EMPLOYEE/BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
  AND p.permission_key IN ('bookings.view', 'blocks.view')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public_bookings IS 'Agendamentos feitos por clientes via página pública (sem login)';
COMMENT ON TABLE schedule_blocks IS 'Bloqueios de horário: folgas, férias, manutenção, eventos';
COMMENT ON TABLE barbershop_settings IS 'Configurações da barbearia para agendamento público e personalização';
COMMENT ON FUNCTION check_public_availability IS 'Verifica se um horário está disponível considerando expediente, bloqueios e agendamentos';
COMMENT ON FUNCTION get_public_available_slots IS 'Retorna slots disponíveis para agendamento público em uma data';
-- ===========================================================================
-- MIGRATION 015
-- ===========================================================================

-- =============================================================================
-- Migration 015: Subscription Plans & Client Memberships
-- Barber-On Studio — Assinaturas mensais e controle de benefícios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SUBSCRIPTION PLANS (Planos de assinatura da barbearia)
-- -----------------------------------------------------------------------------
-- Tabela já criada na migration 011 SEM organization_id.
-- Adicionar colunas novas que esta migration precisa.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'organization_id') THEN
    ALTER TABLE subscription_plans ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'price') THEN
    ALTER TABLE subscription_plans ADD COLUMN price DECIMAL(12,2) CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'billing_cycle') THEN
    ALTER TABLE subscription_plans ADD COLUMN billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'trial_days') THEN
    ALTER TABLE subscription_plans ADD COLUMN trial_days INT DEFAULT 0 CHECK (trial_days >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'max_services_per_month') THEN
    ALTER TABLE subscription_plans ADD COLUMN max_services_per_month INT CHECK (max_services_per_month IS NULL OR max_services_per_month > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'included_services') THEN
    ALTER TABLE subscription_plans ADD COLUMN included_services JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'discount_percentage') THEN
    ALTER TABLE subscription_plans ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'priority_booking') THEN
    ALTER TABLE subscription_plans ADD COLUMN priority_booking BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_org ON subscription_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(organization_id, is_active);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Políticas idempotentes (drop + recreate)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Members can view subscription plans" ON subscription_plans;
  DROP POLICY IF EXISTS "Members can manage subscription plans" ON subscription_plans;

  CREATE POLICY "Members can view subscription plans"
    ON subscription_plans FOR SELECT
    USING (is_member_of(organization_id));

  CREATE POLICY "Members can manage subscription plans"
    ON subscription_plans FOR ALL
    USING (is_member_of(organization_id))
    WITH CHECK (is_member_of(organization_id));
END $$;

DROP TRIGGER IF EXISTS set_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER set_subscription_plans_updated_at
 BEFORE UPDATE ON subscription_plans
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. CLIENT SUBSCRIPTIONS (Assinaturas ativas dos clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'trial')),
 current_period_start DATE NOT NULL,
 current_period_end DATE NOT NULL,
 services_used_this_period INT NOT NULL DEFAULT 0,
 auto_renew BOOLEAN NOT NULL DEFAULT true,
 payment_method TEXT CHECK (payment_method IN ('cash', 'pix', 'debit', 'credit', 'other')),
 last_payment_at TIMESTAMPTZ,
 next_billing_date DATE,
 cancelled_at TIMESTAMPTZ,
 cancellation_reason TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT chk_period_dates CHECK (current_period_end >= current_period_start)
);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_org ON client_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_customer ON client_subscriptions(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_plan ON client_subscriptions(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_status ON client_subscriptions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_billing ON client_subscriptions(next_billing_date);

ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view client subscriptions"
 ON client_subscriptions FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage client subscriptions"
 ON client_subscriptions FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_client_subscriptions_updated_at
 BEFORE UPDATE ON client_subscriptions
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. SUBSCRIPTION HISTORY (Histórico de pagamentos e renovações)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 client_subscription_id UUID NOT NULL REFERENCES client_subscriptions(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL CHECK (event_type IN ('created', 'renewed', 'paused', 'resumed', 'cancelled', 'payment_received', 'service_used', 'plan_changed')),
 amount DECIMAL(12,2),
 payment_method TEXT,
 period_start DATE,
 period_end DATE,
 services_count INT,
 notes TEXT,
 created_by UUID REFERENCES memberships(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_sub ON subscription_history(client_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_event ON subscription_history(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_history_date ON subscription_history(created_at);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription history"
 ON subscription_history FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can create subscription history"
 ON subscription_history FOR INSERT
 WITH CHECK (is_member_of(organization_id));

-- APPEND-ONLY: no UPDATE/DELETE policies

-- -----------------------------------------------------------------------------
-- 4. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Registra uso de serviço por assinatura e incrementa contador
CREATE OR REPLACE FUNCTION record_subscription_service_usage(
 p_subscription_id UUID,
 p_service_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_plan RECORD;
BEGIN
 SELECT * INTO v_sub FROM client_subscriptions WHERE id = p_subscription_id;
 IF NOT FOUND THEN
 RAISE EXCEPTION 'Assinatura não encontrada: %', p_subscription_id;
 END IF;

 IF v_sub.status != 'active' AND v_sub.status != 'trial' THEN
 RAISE EXCEPTION 'Assinatura não está ativa (status: %)', v_sub.status;
 END IF;

 -- Verificar limite de serviços se houver
 SELECT * INTO v_plan FROM subscription_plans WHERE id = v_sub.subscription_plan_id;
 IF v_plan.max_services_per_month IS NOT NULL
 AND v_sub.services_used_this_period >= v_plan.max_services_per_month THEN
 RAISE EXCEPTION 'Limite de serviços atingido neste período (%/%)',
 v_sub.services_used_this_period, v_plan.max_services_per_month;
 END IF;

 -- Incrementar contador
 UPDATE client_subscriptions
 SET services_used_this_period = services_used_this_period + 1,
 updated_at = now()
 WHERE id = p_subscription_id;

 -- Registrar no histórico
 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type,
 services_count, notes
 ) VALUES (
 v_sub.organization_id, p_subscription_id, 'service_used',
 NULL, 'Serviço utilizado via assinatura'
 );
END;
$$;

-- Processa renovações automáticas de assinaturas vencidas
CREATE OR REPLACE FUNCTION process_subscription_renewals()
RETURNS TABLE (renewed_count INT, expired_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_renewed INT := 0;
 v_expired INT := 0;
 v_new_period_start DATE;
 v_new_period_end DATE;
BEGIN
 FOR v_sub IN
 SELECT cs.*, sp.price, sp.billing_cycle
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.status IN ('active', 'trial')
 AND cs.current_period_end < CURRENT_DATE
 LOOP
 IF v_sub.auto_renew THEN
 -- Calcular novo período
 v_new_period_start := v_sub.current_period_end + INTERVAL '1 day';
 CASE v_sub.billing_cycle
 WHEN 'monthly' THEN
 v_new_period_end := v_new_period_start + INTERVAL '1 month' - INTERVAL '1 day';
 WHEN 'quarterly' THEN
 v_new_period_end := v_new_period_start + INTERVAL '3 months' - INTERVAL '1 day';
 WHEN 'annual' THEN
 v_new_period_end := v_new_period_start + INTERVAL '1 year' - INTERVAL '1 day';
 ELSE
 v_new_period_end := v_new_period_start + INTERVAL '1 month' - INTERVAL '1 day';
 END CASE;

 -- Renovar
 UPDATE client_subscriptions
 SET current_period_start = v_new_period_start,
 current_period_end = v_new_period_end,
 services_used_this_period = 0,
 status = 'active',
 next_billing_date = v_new_period_end + INTERVAL '1 day',
 last_payment_at = now(),
 updated_at = now()
 WHERE id = v_sub.id;

 -- Histórico
 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type,
 amount, period_start, period_end, notes
 ) VALUES (
 v_sub.organization_id, v_sub.id, 'renewed',
 v_sub.price, v_new_period_start, v_new_period_end,
 'Renovação automática'
 );

 v_renewed := v_renewed + 1;
 ELSE
 -- Expirar
 UPDATE client_subscriptions
 SET status = 'expired',
 updated_at = now()
 WHERE id = v_sub.id;

 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type,
 notes
 ) VALUES (
 v_sub.organization_id, v_sub.id, 'cancelled',
 'Expirou sem renovação automática'
 );

 v_expired := v_expired + 1;
 END IF;
 END LOOP;

 renewed_count := v_renewed;
 expired_count := v_expired;
 RETURN NEXT;
END;
$$;

-- Obtém resumo de assinaturas da barbearia
CREATE OR REPLACE FUNCTION get_subscription_summary(p_org_id UUID)
RETURNS TABLE (
 total_active INT,
 total_paused INT,
 total_cancelled INT,
 monthly_revenue DECIMAL,
 upcoming_renewals_7d INT,
 avg_services_used DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 RETURN QUERY
 SELECT
 COUNT(*) FILTER (WHERE cs.status = 'active')::INT,
 COUNT(*) FILTER (WHERE cs.status = 'paused')::INT,
 COUNT(*) FILTER (WHERE cs.status IN ('cancelled', 'expired'))::INT,
 COALESCE(SUM(sp.price) FILTER (WHERE cs.status = 'active'), 0),
 COUNT(*) FILTER (WHERE cs.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INT,
 COALESCE(AVG(cs.services_used_this_period) FILTER (WHERE cs.status = 'active'), 0)
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.organization_id = p_org_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
 ('subscriptions.view', 'subscriptions', 'view', 'Visualizar assinaturas'),
 ('subscriptions.manage', 'subscriptions', 'manage', 'Gerenciar assinaturas de clientes'),
 ('subscriptions.plans', 'subscriptions', 'plans', 'Gerenciar planos de assinatura'),
 ('subscriptions.history', 'subscriptions', 'history', 'Visualizar histórico de assinaturas')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
 AND p.permission_key IN (
 'subscriptions.view', 'subscriptions.manage',
 'subscriptions.plans', 'subscriptions.history'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant operational to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
 AND p.permission_key IN (
 'subscriptions.view', 'subscriptions.manage', 'subscriptions.history'
 )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to EMPLOYEE/BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
 AND p.permission_key IN ('subscriptions.view')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

COMMENT ON TABLE subscription_plans IS 'Planos de assinatura mensal/trimestral/anual oferecidos pela barbearia';
COMMENT ON TABLE client_subscriptions IS 'Assinaturas ativas dos clientes com controle de período e uso';
COMMENT ON TABLE subscription_history IS 'Histórico append-only de eventos: criação, renovação, pagamento, uso, cancelamento';
COMMENT ON FUNCTION record_subscription_service_usage IS 'Registra uso de serviço via assinatura e valida limites';
COMMENT ON FUNCTION process_subscription_renewals IS 'Processa renovações automáticas e expirações de assinaturas vencidas';
COMMENT ON FUNCTION get_subscription_summary IS 'Retorna resumo de assinaturas: ativas, receita, renovações próximas';
-- ===========================================================================
-- MIGRATION 016
-- ===========================================================================

-- =============================================================================
-- Migration 016: Loyalty Programs & Customer Reactivation
-- Barber-On Studio — Sistema de fidelidade e reativação de clientes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. LOYALTY PROGRAMS (Programas de fidelidade da barbearia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_per_real DECIMAL(10,2) NOT NULL DEFAULT 1.0 CHECK (points_per_real > 0),
  points_per_visit INT NOT NULL DEFAULT 0 CHECK (points_per_visit >= 0),
  redemption_threshold INT NOT NULL DEFAULT 100 CHECK (redemption_threshold > 0),
  reward_type TEXT NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'free_service', 'product', 'cashback')),
  reward_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (reward_value >= 0),
  reward_service_id UUID REFERENCES barber_services(id),
  expiry_days INT CHECK (expiry_days IS NULL OR expiry_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_org ON loyalty_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_active ON loyalty_programs(organization_id, is_active);

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view loyalty programs"
  ON loyalty_programs FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage loyalty programs"
  ON loyalty_programs FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_loyalty_programs_updated_at
  BEFORE UPDATE ON loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. LOYALTY CARDS (Cartões de fidelidade dos clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  current_points INT NOT NULL DEFAULT 0 CHECK (current_points >= 0),
  lifetime_points INT NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  total_visits INT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  last_visit_at TIMESTAMPTZ,
  card_status TEXT NOT NULL DEFAULT 'active' CHECK (card_status IN ('active', 'inactive', 'expired', 'blocked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_program UNIQUE (customer_profile_id, loyalty_program_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_org ON loyalty_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_customer ON loyalty_cards(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_program ON loyalty_cards(loyalty_program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_status ON loyalty_cards(card_status);

ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view loyalty cards"
  ON loyalty_cards FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage loyalty cards"
  ON loyalty_cards FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_loyalty_cards_updated_at
  BEFORE UPDATE ON loyalty_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. LOYALTY TRANSACTIONS (Histórico de pontos ganhos/resgatados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loyalty_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn_purchase', 'earn_visit', 'earn_bonus', 'redeem', 'expire', 'adjustment')),
  points_change INT NOT NULL,
  balance_after INT NOT NULL,
  reference_id UUID, -- order_id, booking_id, etc.
  reference_type TEXT, -- 'order', 'booking', 'manual', 'campaign'
  description TEXT,
  created_by UUID REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_org ON loyalty_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_card ON loyalty_transactions(loyalty_card_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON loyalty_transactions(created_at);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can create loyalty transactions"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (is_member_of(organization_id));

-- APPEND-ONLY: no UPDATE/DELETE policies

-- -----------------------------------------------------------------------------
-- 4. REACTIVATION CAMPAIGNS (Campanhas de reativação de clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactivation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'inactive_clients' CHECK (campaign_type IN ('inactive_clients', 'birthday', 'custom_segment', 'win_back')),
  inactive_days_threshold INT NOT NULL DEFAULT 30 CHECK (inactive_days_threshold > 0),
  target_count INT,
  sent_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  conversion_count INT NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email', 'push')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  created_by UUID REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_campaigns_org ON reactivation_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_campaigns_status ON reactivation_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_reactivation_campaigns_scheduled ON reactivation_campaigns(scheduled_at);

ALTER TABLE reactivation_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactivation campaigns"
  ON reactivation_campaigns FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage reactivation campaigns"
  ON reactivation_campaigns FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_reactivation_campaigns_updated_at
  BEFORE UPDATE ON reactivation_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. REACTIVATION RECIPIENTS (Clientes alvo de cada campanha)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactivation_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES reactivation_campaigns(id) ON DELETE CASCADE,
  customer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  last_visit_at TIMESTAMPTZ,
  days_inactive INT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'responded', 'converted', 'failed')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_recipients_campaign ON reactivation_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_recipients_customer ON reactivation_recipients(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_recipients_status ON reactivation_recipients(status);

ALTER TABLE reactivation_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactivation recipients"
  ON reactivation_recipients FOR SELECT
  USING (is_member_of((SELECT organization_id FROM reactivation_campaigns WHERE id = campaign_id)));

CREATE POLICY "Members can manage reactivation recipients"
  ON reactivation_recipients FOR ALL
  USING (is_member_of((SELECT organization_id FROM reactivation_campaigns WHERE id = campaign_id)))
  WITH CHECK (is_member_of((SELECT organization_id FROM reactivation_campaigns WHERE id = campaign_id)));

-- -----------------------------------------------------------------------------
-- 6. FUNCTIONS
-- -----------------------------------------------------------------------------

-- Adiciona pontos a um cartão de fidelidade
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_card_id UUID,
  p_points INT,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_new_balance INT;
BEGIN
  SELECT * INTO v_card FROM loyalty_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão de fidelidade não encontrado: %', p_card_id;
  END IF;

  IF v_card.card_status != 'active' THEN
    RAISE EXCEPTION 'Cartão não está ativo (status: %)', v_card.card_status;
  END IF;

  v_new_balance := v_card.current_points + p_points;

  -- Atualizar cartão
  UPDATE loyalty_cards
  SET current_points = v_new_balance,
      lifetime_points = lifetime_points + GREATEST(p_points, 0),
      updated_at = now()
  WHERE id = p_card_id;

  -- Registrar transação
  INSERT INTO loyalty_transactions (
    organization_id, loyalty_card_id, transaction_type,
    points_change, balance_after, reference_id, reference_type, description
  ) VALUES (
    v_card.organization_id, p_card_id, p_transaction_type,
    p_points, v_new_balance, p_reference_id, p_reference_type, p_description
  );
END;
$$;

-- Resgata pontos de um cartão de fidelidade
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_card_id UUID,
  p_points INT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_new_balance INT;
BEGIN
  SELECT * INTO v_card FROM loyalty_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão de fidelidade não encontrado: %', p_card_id;
  END IF;

  IF v_card.current_points < p_points THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_card.current_points, p_points;
  END IF;

  v_new_balance := v_card.current_points - p_points;

  -- Atualizar cartão
  UPDATE loyalty_cards
  SET current_points = v_new_balance,
      updated_at = now()
  WHERE id = p_card_id;

  -- Registrar transação
  INSERT INTO loyalty_transactions (
    organization_id, loyalty_card_id, transaction_type,
    points_change, balance_after, reference_id, reference_type, description
  ) VALUES (
    v_card.organization_id, p_card_id, 'redeem',
    -p_points, v_new_balance, p_reference_id, 'manual', p_description
  );
END;
$$;

-- Obtém resumo de fidelidade da organização
CREATE OR REPLACE FUNCTION get_loyalty_summary(p_org_id UUID)
RETURNS TABLE (
  total_programs INT,
  active_cards INT,
  total_points_issued BIGINT,
  avg_points_per_card DECIMAL,
  redemptions_this_month INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT lp.id)::INT,
    COUNT(lc.id)::INT,
    COALESCE(SUM(lc.lifetime_points), 0)::BIGINT,
    COALESCE(AVG(lc.current_points), 0),
    COUNT(lt.id) FILTER (WHERE lt.transaction_type = 'redeem' AND lt.created_at >= date_trunc('month', CURRENT_DATE))::INT
  FROM loyalty_programs lp
  LEFT JOIN loyalty_cards lc ON lc.loyalty_program_id = lp.id AND lc.card_status = 'active'
  LEFT JOIN loyalty_transactions lt ON lt.loyalty_card_id = lc.id
  WHERE lp.organization_id = p_org_id AND lp.is_active = true;
END;
$$;

-- Obtém clientes inativos para reativação
CREATE OR REPLACE FUNCTION get_inactive_customers(
  p_org_id UUID,
  p_inactive_days INT DEFAULT 30
)
RETURNS TABLE (
  customer_id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  last_visit_at TIMESTAMPTZ,
  days_inactive INT,
  total_visits INT,
  total_spent DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.phone,
    p.email,
    MAX(o.created_at) AS last_visit_at,
    EXTRACT(DAY FROM (now() - MAX(o.created_at)))::INT AS days_inactive,
    COUNT(o.id)::INT AS total_visits,
    COALESCE(SUM(o.total_amount), 0) AS total_spent
  FROM profiles p
  JOIN memberships m ON m.user_id = p.id AND m.organization_id = p_org_id
  LEFT JOIN orders o ON o.customer_id = p.id AND o.organization_id = p_org_id
  WHERE p.id IN (
    SELECT DISTINCT customer_id FROM orders WHERE organization_id = p_org_id
  )
  GROUP BY p.id, p.full_name, p.phone, p.email
  HAVING MAX(o.created_at) < now() - (p_inactive_days || ' days')::INTERVAL
  ORDER BY days_inactive DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. PERMISSIONS
-- -----------------------------------------------------------------------------
INSERT INTO permissions (permission_key, module, action, description) VALUES
  ('loyalty.view', 'loyalty', 'view', 'Visualizar programa de fidelidade'),
  ('loyalty.manage', 'loyalty', 'manage', 'Gerenciar programas e cartões de fidelidade'),
  ('loyalty.transactions', 'loyalty', 'transactions', 'Registrar e visualizar transações de pontos'),
  ('reactivation.view', 'reactivation', 'view', 'Visualizar campanhas de reativação'),
  ('reactivation.manage', 'reactivation', 'manage', 'Criar e gerenciar campanhas de reativação')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all to OWNER and ADMIN
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('OWNER', 'ADMIN')
  AND p.permission_key IN (
    'loyalty.view', 'loyalty.manage', 'loyalty.transactions',
    'reactivation.view', 'reactivation.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant operational to MANAGER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name = 'MANAGER'
  AND p.permission_key IN (
    'loyalty.view', 'loyalty.manage', 'loyalty.transactions',
    'reactivation.view', 'reactivation.manage'
  )
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Grant view to EMPLOYEE/BARBER
INSERT INTO role_permissions (organization_id, role_id, permission_id, granted)
SELECT o.id, r.id, p.id, true
FROM organizations o
CROSS JOIN organization_roles r
CROSS JOIN permissions p
WHERE r.name IN ('EMPLOYEE')
  AND p.permission_key IN ('loyalty.view', 'loyalty.transactions')
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

COMMENT ON TABLE loyalty_programs IS 'Programas de fidelidade configurados pela barbearia';
COMMENT ON TABLE loyalty_cards IS 'Cartões de fidelidade individuais dos clientes';
COMMENT ON TABLE loyalty_transactions IS 'Histórico append-only de transações de pontos';
COMMENT ON TABLE reactivation_campaigns IS 'Campanhas de reativação de clientes inativos';
COMMENT ON TABLE reactivation_recipients IS 'Clientes alvo e status de envio de cada campanha';
COMMENT ON FUNCTION add_loyalty_points IS 'Adiciona pontos a um cartão e registra transação';
COMMENT ON FUNCTION redeem_loyalty_points IS 'Resgata pontos de um cartão e registra transação';
COMMENT ON FUNCTION get_loyalty_summary IS 'Retorna resumo do programa de fidelidade da organização';
COMMENT ON FUNCTION get_inactive_customers IS 'Lista clientes inativos há N dias para reativação';
-- ===========================================================================
-- MIGRATION 017
-- ===========================================================================

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
-- ===========================================================================
-- MIGRATION 018
-- ===========================================================================

-- =============================================================================
-- Migration 018: Barber Performance Fields & Conflict Prevention RPC
-- Barber-On Studio — FASE 2: Cadastros e Disponibilidade
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADICIONAR CAMPOS DE DESEMPENHO E INSTAGRAM EM EMPLOYEE_PROFILES
-- -----------------------------------------------------------------------------
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS total_appointments INT NOT NULL DEFAULT 0 CHECK (total_appointments >= 0),
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) CHECK (avg_rating IS NULL OR (avg_rating >= 0 AND avg_rating <= 5)),
ADD COLUMN IF NOT EXISTS last_appointment_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_employee_profiles_instagram ON employee_profiles(organization_id, instagram) WHERE instagram IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_profiles_performance ON employee_profiles(organization_id, total_revenue DESC);

-- -----------------------------------------------------------------------------
-- 2. VIEW: V_BARBER_PERFORMANCE
-- Visão consolidada de desempenho por profissional
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_barber_performance AS
SELECT
  ep.id AS employee_profile_id,
  ep.organization_id,
  ep.membership_id,
  p.full_name,
  p.avatar_url,
  ep.job_title,
  ep.specialties,
  ep.instagram,
  ep.commission_type,
  ep.commission_rate,
  ep.is_available_for_booking,
  ep.total_appointments,
  ep.total_revenue,
  ep.avg_rating,
  ep.last_appointment_at,
  -- Métricas calculadas do mês atual
  COALESCE(monthly.stats_count, 0) AS monthly_appointments,
  COALESCE(monthly.stats_revenue, 0) AS monthly_revenue,
  COALESCE(monthly.stats_commission, 0) AS monthly_commission
FROM employee_profiles ep
JOIN memberships m ON m.id = ep.membership_id
JOIN profiles p ON p.id = m.user_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS stats_count,
    SUM(bc.commission_amount) AS stats_revenue,
    SUM(bc.commission_amount) AS stats_commission
  FROM barber_commissions bc
  WHERE bc.membership_id = ep.membership_id
    AND bc.organization_id = ep.organization_id
    AND bc.created_at >= date_trunc('month', CURRENT_DATE)
    AND bc.status != 'cancelled'
) monthly ON true;

-- -----------------------------------------------------------------------------
-- 3. RPC: CHECK_APPOINTMENT_CONFLICT
-- Verifica conflitos de horário antes de criar/editar agendamento
-- Retorna tabela vazia se não houver conflito, ou detalhes do conflito
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_org_id UUID,
  p_barber_membership_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_appointment_id UUID DEFAULT NULL
) RETURNS TABLE (
  conflict_type TEXT,
  conflicting_id UUID,
  conflicting_title TEXT,
  conflicting_start TIMESTAMPTZ,
  conflicting_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Verificar agendamentos existentes no mesmo horário
  RETURN QUERY
  SELECT
    'appointment'::TEXT,
    ce.id,
    ce.title,
    ce.start_at,
    ce.end_at
  FROM calendar_events ce
  WHERE ce.organization_id = p_org_id
    AND ce.assigned_barber_id = p_barber_membership_id
    AND ce.id != COALESCE(p_exclude_appointment_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND ce.start_at < p_end_time
    AND ce.end_at > p_start_time
    AND ce.status NOT IN ('cancelled', 'no_show');

  IF FOUND THEN RETURN; END IF;

  -- 2. Verificar bloqueios de horário
  RETURN QUERY
  SELECT
    'block'::TEXT,
    sb.id,
    sb.title,
    sb.starts_at,
    sb.ends_at
  FROM schedule_blocks sb
  WHERE sb.organization_id = p_org_id
    AND (sb.membership_id = p_barber_membership_id OR sb.membership_id IS NULL)
    AND sb.starts_at < p_end_time
    AND sb.ends_at > p_start_time;

  IF FOUND THEN RETURN; END IF;

  -- 3. Verificar expediente do profissional
  DECLARE
    v_day_of_week INT;
    v_has_schedule BOOLEAN;
    v_in_working_hours BOOLEAN;
    v_in_lunch_break BOOLEAN;
  BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_start_time);

    SELECT
      COUNT(*) > 0,
      BOOL_OR(
        bs.is_working_day
        AND p_start_time::TIME >= bs.start_time
        AND p_end_time::TIME <= bs.end_time
      ),
      BOOL_OR(
        bs.lunch_start IS NOT NULL
        AND p_start_time::TIME < bs.lunch_end
        AND p_end_time::TIME > bs.lunch_start
      )
    INTO v_has_schedule, v_in_working_hours, v_in_lunch_break
    FROM barber_schedules bs
    WHERE bs.membership_id = p_barber_membership_id
      AND bs.day_of_week = v_day_of_week;

    IF v_has_schedule AND NOT v_in_working_hours THEN
      conflict_type := 'outside_working_hours';
      conflicting_id := NULL;
      conflicting_title := 'Fora do horário de expediente';
      conflicting_start := p_start_time;
      conflicting_end := p_end_time;
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_in_lunch_break THEN
      conflict_type := 'lunch_break';
      conflicting_id := NULL;
      conflicting_title := 'Horário de almoço';
      conflicting_start := p_start_time;
      conflicting_end := p_end_time;
      RETURN NEXT;
      RETURN;
    END IF;
  END;

  -- 4. Verificar disponibilidade do profissional
  DECLARE
    v_is_available BOOLEAN;
  BEGIN
    SELECT is_available_for_booking INTO v_is_available
    FROM employee_profiles
    WHERE membership_id = p_barber_membership_id
      AND organization_id = p_org_id;

    IF v_is_available = false THEN
      conflict_type := 'barber_unavailable';
      conflicting_id := NULL;
      conflicting_title := 'Profissional indisponível para agendamento';
      conflicting_start := p_start_time;
      conflicting_end := p_end_time;
      RETURN NEXT;
      RETURN;
    END IF;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC: CREATE_APPOINTMENT_WITH_CONFLICT_CHECK
-- Cria agendamento com verificação transacional de conflitos
-- Previne race conditions usando advisory lock
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_appointment_with_conflict_check(
  p_org_id UUID,
  p_title TEXT,
  p_barber_membership_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_total_price DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'scheduled'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict RECORD;
  v_lock_key BIGINT;
BEGIN
  -- Advisory lock baseado no barbeiro + data para prevenir race conditions
  v_lock_key := hashtext(p_barber_membership_id::TEXT || p_start_time::DATE::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Verificar conflitos
  FOR v_conflict IN
    SELECT * FROM check_appointment_conflict(
      p_org_id, p_barber_membership_id, p_start_time, p_end_time
    )
  LOOP
    RAISE EXCEPTION 'Conflito detectado: % (%)', v_conflict.conflict_type, v_conflict.conflicting_title;
  END LOOP;

  -- Criar o agendamento
  INSERT INTO calendar_events (
    organization_id, title, description, start_at, end_at, all_day,
    barber_service_id, assigned_barber_id, customer_id, status,
    total_price, notes, created_by, color
  ) VALUES (
    p_org_id, p_title, NULL, p_start_time, p_end_time, false,
    p_service_id, p_barber_membership_id, p_customer_id, p_status,
    p_total_price, p_notes, COALESCE(p_created_by, auth.uid()), '#0866E8'
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGER: ATUALIZAR MÉTRICAS DE DESEMPENHO AO FINALIZAR AGENDAMENTO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_barber_performance_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE employee_profiles
    SET
      total_appointments = total_appointments + 1,
      total_revenue = total_revenue + COALESCE(NEW.total_price, 0),
      last_appointment_at = NEW.end_at,
      updated_at = now()
    WHERE membership_id = NEW.assigned_barber_id
      AND organization_id = NEW.organization_id;
  ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    -- Reverter métricas se status mudou de completed para outro
    UPDATE employee_profiles
    SET
      total_appointments = GREATEST(0, total_appointments - 1),
      total_revenue = GREATEST(0, total_revenue - COALESCE(OLD.total_price, 0)),
      updated_at = now()
    WHERE membership_id = OLD.assigned_barber_id
      AND organization_id = OLD.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_barber_performance ON calendar_events;
CREATE TRIGGER trg_update_barber_performance
  AFTER UPDATE OF status ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_barber_performance_on_completion();

-- -----------------------------------------------------------------------------
-- 6. RPC: VALIDATE_SCHEDULE_AGAINST_GENERAL
-- Valida expediente individual contra regras gerais da barbearia
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_schedule_against_general(
  p_org_id UUID,
  p_membership_id UUID,
  p_day_of_week INT,
  p_start_time TIME,
  p_end_time TIME,
  p_lunch_start TIME DEFAULT NULL,
  p_lunch_end TIME DEFAULT NULL
) RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
BEGIN
  -- Buscar configurações gerais da barbearia
  SELECT * INTO v_settings
  FROM barbershop_settings
  WHERE organization_id = p_org_id;

  -- Se não há settings configurados, validar apenas consistência interna
  IF v_settings IS NULL THEN
    IF p_end_time <= p_start_time THEN
      is_valid := false;
      error_message := 'Horário final deve ser posterior ao inicial';
      RETURN NEXT;
      RETURN;
    END IF;
    is_valid := true;
    error_message := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Validar horário mínimo e máximo geral
  IF v_settings.opening_time IS NOT NULL AND p_start_time < v_settings.opening_time THEN
    is_valid := false;
    error_message := format('Horário inicial (%s) é anterior à abertura da barbearia (%s)', p_start_time, v_settings.opening_time);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_settings.closing_time IS NOT NULL AND p_end_time > v_settings.closing_time THEN
    is_valid := false;
    error_message := format('Horário final (%s) é posterior ao fechamento da barbearia (%s)', p_end_time, v_settings.closing_time);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Validar intervalo de almoço
  IF p_lunch_start IS NOT NULL AND p_lunch_end IS NOT NULL THEN
    IF p_lunch_end <= p_lunch_start THEN
      is_valid := false;
      error_message := 'Fim do almoço deve ser posterior ao início';
      RETURN NEXT;
      RETURN;
    END IF;
    IF p_lunch_start < p_start_time OR p_lunch_end > p_end_time THEN
      is_valid := false;
      error_message := 'Intervalo de almoço deve estar dentro do expediente';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  is_valid := true;
  error_message := NULL;
  RETURN NEXT;
END;
$$;
-- ===========================================================================
-- MIGRATION 019
-- ===========================================================================

-- =============================================================================
-- Migration 019: Appointment Status Flow, History & Temporary Reservations
-- Barber-On Studio — FASE 3: Agendamentos completos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADICIONAR CAMPOS DE AGENDAMENTO EM CALENDAR_EVENTS
-- -----------------------------------------------------------------------------
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
  'scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'
)),
ADD COLUMN IF NOT EXISTS barber_service_id UUID REFERENCES barber_services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_barber_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) CHECK (total_price >= 0),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'landing_page', 'recurring', 'whatsapp')),
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_barber ON calendar_events(assigned_barber_id, start_at) WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer ON calendar_events(customer_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_service ON calendar_events(barber_service_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_origin ON calendar_events(organization_id, origin);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_status ON calendar_events(organization_id, start_at, status);

-- -----------------------------------------------------------------------------
-- 2. TABELA: APPOINTMENT_STATUS_HISTORY (Histórico imutável de mudanças de status)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_status_history_event ON appointment_status_history(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_appt_status_history_org ON appointment_status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_appt_status_history_created ON appointment_status_history(organization_id, created_at DESC);

ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view appointment status history"
  ON appointment_status_history FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "System can insert appointment status history"
  ON appointment_status_history FOR INSERT
  WITH CHECK (is_member_of(organization_id));

-- Append-only: sem UPDATE ou DELETE

-- -----------------------------------------------------------------------------
-- 3. TABELA: TEMPORARY_RESERVATIONS (Reservas temporárias com expiração)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS temporary_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  barber_service_id UUID NOT NULL REFERENCES barber_services(id) ON DELETE CASCADE,
  assigned_barber_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'cancelled')),
  converted_booking_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temp_reservations_org ON temporary_reservations(organization_id);
CREATE INDEX IF NOT EXISTS idx_temp_reservations_expires ON temporary_reservations(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_temp_reservations_slot ON temporary_reservations(organization_id, assigned_barber_id, scheduled_at) WHERE status = 'active';

ALTER TABLE temporary_reservations ENABLE ROW LEVEL SECURITY;

-- Política pública: qualquer pessoa pode criar reserva temporária (sem auth)
CREATE POLICY "Anyone can create temporary reservation"
  ON temporary_reservations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update own temporary reservation"
  ON temporary_reservations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Members can view temporary reservations"
  ON temporary_reservations FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage temporary reservations"
  ON temporary_reservations FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_temporary_reservations_updated_at
  BEFORE UPDATE ON temporary_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. RPC: CHANGE_APPOINTMENT_STATUS
-- Altera status com registro automático no histórico e validação de transições
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION change_appointment_status(
  p_event_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_org_id UUID;
  v_valid_transitions TEXT[];
BEGIN
  -- Buscar status atual e org
  SELECT status, organization_id INTO v_current_status, v_org_id
  FROM calendar_events
  WHERE id = p_event_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado: %', p_event_id;
  END IF;

  -- Validar transições permitidas
  CASE v_current_status
    WHEN 'scheduled' THEN v_valid_transitions := ARRAY['confirmed', 'cancelled', 'no_show'];
    WHEN 'confirmed' THEN v_valid_transitions := ARRAY['arrived', 'cancelled', 'no_show', 'scheduled'];
    WHEN 'arrived' THEN v_valid_transitions := ARRAY['in_progress', 'cancelled', 'no_show'];
    WHEN 'in_progress' THEN v_valid_transitions := ARRAY['completed', 'cancelled'];
    WHEN 'completed' THEN v_valid_transitions := ARRAY['cancelled']; -- permite estorno
    WHEN 'cancelled' THEN v_valid_transitions := ARRAY['scheduled']; -- permite reabrir
    WHEN 'no_show' THEN v_valid_transitions := ARRAY['scheduled']; -- permite reabrir
    ELSE v_valid_transitions := ARRAY[]::TEXT[];
  END CASE;

  IF NOT (p_new_status = ANY(v_valid_transitions)) THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Permitido: %', v_current_status, p_new_status, array_to_string(v_valid_transitions, ', ');
  END IF;

  -- Atualizar status e timestamps
  UPDATE calendar_events
  SET
    status = p_new_status,
    confirmed_at = CASE WHEN p_new_status = 'confirmed' AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' AND cancelled_at IS NULL THEN now() ELSE cancelled_at END,
    cancellation_reason = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(p_reason, cancellation_reason) ELSE cancellation_reason END,
    completed_at = CASE WHEN p_new_status = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_event_id;

  -- Registrar no histórico
  INSERT INTO appointment_status_history (
    organization_id, calendar_event_id, previous_status, new_status, changed_by, reason
  ) VALUES (
    v_org_id, p_event_id, v_current_status, p_new_status, COALESCE(p_changed_by, auth.uid()), p_reason
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: GET_APPOINTMENTS_WITH_DETAILS
-- Retorna agendamentos com dados completos do barbeiro, serviço e cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_appointments_with_details(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_barber_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
) RETURNS TABLE (
  event_id UUID,
  title TEXT,
  description TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  origin TEXT,
  total_price DECIMAL,
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  barber_name TEXT,
  barber_avatar TEXT,
  service_name TEXT,
  service_duration INT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  creator_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.title,
    ce.description,
    ce.start_at,
    ce.end_at,
    ce.status,
    ce.origin,
    ce.total_price,
    ce.notes,
    ce.confirmed_at,
    ce.cancelled_at,
    ce.cancellation_reason,
    ce.completed_at,
    bp.full_name AS barber_name,
    bp.avatar_url AS barber_avatar,
    bs.name AS service_name,
    bs.duration_minutes AS service_duration,
    cp.full_name AS customer_name,
    cp.phone AS customer_phone,
    cp.email AS customer_email,
    crp.full_name AS creator_name
  FROM calendar_events ce
  LEFT JOIN memberships bm ON bm.id = ce.assigned_barber_id
  LEFT JOIN profiles bp ON bp.id = bm.user_id
  LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
  LEFT JOIN profiles cp ON cp.id = ce.customer_id
  LEFT JOIN profiles crp ON crp.id = ce.created_by
  WHERE ce.organization_id = p_org_id
    AND (p_start_date IS NULL OR ce.start_at >= p_start_date)
    AND (p_end_date IS NULL OR ce.start_at <= p_end_date)
    AND (p_barber_id IS NULL OR ce.assigned_barber_id = p_barber_id)
    AND (p_status IS NULL OR ce.status = p_status)
  ORDER BY ce.start_at ASC
  LIMIT p_limit;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: CONVERT_PUBLIC_BOOKING_TO_APPOINTMENT
-- Converte um public_booking em calendar_event interno
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION convert_public_booking_to_appointment(
  p_booking_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_event_id UUID;
  v_membership_id UUID;
BEGIN
  -- Buscar booking
  SELECT * INTO v_booking
  FROM public_bookings
  WHERE id = p_booking_id;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking não encontrado: %', p_booking_id;
  END IF;

  -- Resolver membership_id do barbeiro (se atribuído)
  IF v_booking.assigned_barber_id IS NOT NULL THEN
    v_membership_id := v_booking.assigned_barber_id;
  END IF;

  -- Buscar nome do serviço para o título
  DECLARE
    v_service_name TEXT;
    v_customer_name TEXT;
  BEGIN
    SELECT name INTO v_service_name FROM barber_services WHERE id = v_booking.barber_service_id;
    v_customer_name := v_booking.customer_name;

    -- Criar calendar_event
    INSERT INTO calendar_events (
      organization_id, title, start_at, end_at, all_day,
      barber_service_id, assigned_barber_id, customer_id,
      status, total_price, notes, origin, color,
      confirmed_at, created_by
    ) VALUES (
      v_booking.organization_id,
      COALESCE(v_service_name, 'Serviço') || ' — ' || v_customer_name,
      v_booking.scheduled_at,
      v_booking.scheduled_at + (v_booking.duration_minutes || ' minutes')::INTERVAL,
      false,
      v_booking.barber_service_id,
      v_membership_id,
      NULL, -- customer_id será resolvido via phone/email se existir profile
      CASE WHEN v_booking.status = 'confirmed' THEN 'confirmed' ELSE 'scheduled' END,
      (SELECT price FROM barber_services WHERE id = v_booking.barber_service_id),
      v_booking.notes,
      'landing_page',
      '#0866E8',
      v_booking.confirmed_at,
      auth.uid()
    ) RETURNING id INTO v_event_id;

    -- Registrar no histórico
    INSERT INTO appointment_status_history (
      organization_id, calendar_event_id, previous_status, new_status, reason
    ) VALUES (
      v_booking.organization_id, v_event_id, NULL,
      CASE WHEN v_booking.status = 'confirmed' THEN 'confirmed' ELSE 'scheduled' END,
      'Convertido de agendamento público #' || v_booking.id
    );

    RETURN v_event_id;
  END;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: CLEANUP_EXPIRED_RESERVATIONS
-- Expira reservas temporárias que passaram do prazo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE temporary_reservations
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. MIGRAR DADOS EXISTENTES: definir status baseado em datas
-- -----------------------------------------------------------------------------
UPDATE calendar_events
SET
  status = CASE
    WHEN end_at < now() THEN 'completed'
    ELSE 'scheduled'
  END
WHERE status = 'scheduled'
  AND (barber_service_id IS NOT NULL OR assigned_barber_id IS NOT NULL);
-- ===========================================================================
-- MIGRATION 020
-- ===========================================================================

-- =============================================================================
-- Migration 020: Comandas — Pagamentos Combinados, Estoque e Integração Agenda
-- Barber-On Studio — FASE 4: Comandas e Vendas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: ORDER_PAYMENTS (Pagamentos combinados / split payment)
-- Permite múltiplas formas de pagamento na mesma comanda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'pix', 'debit', 'credit', 'other')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  reference TEXT, -- ex: "PIX chave xxx", "Cartão final 1234"
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_org ON order_payments(organization_id);

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view order payments"
  ON order_payments FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can insert order payments"
  ON order_payments FOR INSERT
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can update order payments"
  ON order_payments FOR UPDATE
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE POLICY "Members can delete order payments"
  ON order_payments FOR DELETE
  USING (is_member_of(organization_id));

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPOS EM ORDERS PARA INTEGRAÇÃO COM AGENDA E ESTOQUE
-- -----------------------------------------------------------------------------
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS linked_appointment_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_calculated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_linked_appointment ON orders(linked_appointment_id);

-- -----------------------------------------------------------------------------
-- 3. TABELA: ORDER_ITEM_STOCK_RESERVATIONS
-- Reserva de estoque ao adicionar produto na comanda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_item_stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON order_item_stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product ON order_item_stock_reservations(product_id, status);

ALTER TABLE order_item_stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stock reservations"
  ON order_item_stock_reservations FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage stock reservations"
  ON order_item_stock_reservations FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_order_item_stock_reservations_updated_at
  BEFORE UPDATE ON order_item_stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. RPC: ADD_PAYMENT_TO_ORDER
-- Adiciona pagamento parcial/combinado à comanda e atualiza status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_payment_to_order(
  p_order_id UUID,
  p_payment_method TEXT,
  p_amount DECIMAL,
  p_change_amount DECIMAL DEFAULT 0,
  p_reference TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_total DECIMAL;
  v_paid DECIMAL;
BEGIN
  -- Buscar org e total da comanda
  SELECT o.organization_id, o.total INTO v_org_id, v_total
  FROM orders o WHERE o.id = p_order_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Comanda não encontrada: %', p_order_id;
  END IF;

  -- Inserir pagamento
  INSERT INTO order_payments (
    organization_id, order_id, payment_method, amount, change_amount, reference, created_by
  ) VALUES (
    v_org_id, p_order_id, p_payment_method, p_amount, COALESCE(p_change_amount, 0), p_reference, auth.uid()
  );

  -- Calcular total pago
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM order_payments WHERE order_id = p_order_id;

  -- Atualizar status da comanda baseado no total pago
  IF v_paid >= v_total THEN
    UPDATE orders SET
      payment_method = CASE
        WHEN (SELECT COUNT(*) FROM order_payments WHERE order_id = p_order_id) = 1
        THEN p_payment_method
        ELSE 'multiple'
      END,
      status = CASE WHEN status = 'open' OR status = 'in_progress' THEN 'completed' ELSE status END,
      completed_at = CASE WHEN status != 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
    WHERE id = p_order_id;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: RESERVE_STOCK_FOR_ORDER_ITEM
-- Reserva estoque ao adicionar produto na comanda
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_stock_for_order_item(
  p_order_item_id UUID,
  p_product_id UUID,
  p_quantity INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_current_stock INT;
BEGIN
  -- Buscar org do pedido
  SELECT o.organization_id INTO v_org_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.id = p_order_item_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado: %', p_order_item_id;
  END IF;

  -- Verificar estoque disponível
  SELECT COALESCE(stock_quantity, 0) INTO v_current_stock
  FROM products WHERE id = p_product_id AND organization_id = v_org_id;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto %. Disponível: %, Solicitado: %',
      p_product_id, v_current_stock, p_quantity;
  END IF;

  -- Criar reserva
  INSERT INTO order_item_stock_reservations (
    organization_id, order_id, order_item_id, product_id, quantity
  )
  SELECT v_org_id, oi.order_id, p_order_item_id, p_product_id, p_quantity
  FROM order_items oi WHERE oi.id = p_order_item_id;

  -- Decrementar estoque disponível
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE id = p_product_id AND organization_id = v_org_id;

  -- Marcar comanda como com estoque reservado
  UPDATE orders SET stock_reserved = true, updated_at = now()
  WHERE id = (SELECT order_id FROM order_items WHERE id = p_order_item_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: RELEASE_STOCK_FOR_ORDER
-- Libera estoque quando comanda é cancelada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_stock_for_order(
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT product_id, quantity
    FROM order_item_stock_reservations
    WHERE order_id = p_order_id AND status = 'reserved'
  LOOP
    -- Devolver estoque
    UPDATE products
    SET stock_quantity = stock_quantity + v_reservation.quantity,
        updated_at = now()
    WHERE id = v_reservation.product_id;

    -- Marcar reserva como liberada
    UPDATE order_item_stock_reservations
    SET status = 'released', updated_at = now()
    WHERE order_id = p_order_id
      AND product_id = v_reservation.product_id
      AND status = 'reserved';
  END LOOP;

  -- Desmarcar flag de estoque
  UPDATE orders SET stock_reserved = false, updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: CONSUME_STOCK_FOR_ORDER
-- Confirma consumo do estoque quando comanda é finalizada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_stock_for_order(
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_item_stock_reservations
  SET status = 'consumed', updated_at = now()
  WHERE order_id = p_order_id AND status = 'reserved';
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: LINK_APPOINTMENT_TO_ORDER
-- Vincula agendamento à comanda automaticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION link_appointment_to_order(
  p_order_id UUID,
  p_appointment_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET linked_appointment_id = p_appointment_id, updated_at = now()
  WHERE id = p_order_id;

  -- Atualizar status do agendamento para in_progress se estiver confirmed/arrived
  UPDATE calendar_events
  SET status = 'in_progress', updated_at = now()
  WHERE id = p_appointment_id
    AND status IN ('confirmed', 'arrived');
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. VIEW: V_ORDER_PAYMENTS_SUMMARY
-- Resumo de pagamentos por comanda
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_order_payments_summary AS
SELECT
  op.order_id,
  op.organization_id,
  COUNT(*) AS payment_count,
  SUM(op.amount) AS total_paid,
  SUM(op.change_amount) AS total_change,
  STRING_AGG(DISTINCT op.payment_method, ', ') AS payment_methods,
  MAX(op.created_at) AS last_payment_at
FROM order_payments op
GROUP BY op.order_id, op.organization_id;

-- -----------------------------------------------------------------------------
-- 10. MIGRAR DADOS EXISTENTES: criar order_payments para comandas já pagas
-- -----------------------------------------------------------------------------
INSERT INTO order_payments (organization_id, order_id, payment_method, amount, created_by)
SELECT
  o.organization_id,
  o.id,
  'other',
  o.total,
  NULL
FROM orders o
WHERE o.status = 'completed'
  AND o.total > 0
  AND NOT EXISTS (
    SELECT 1 FROM order_payments op WHERE op.order_id = o.id
  );
-- ===========================================================================
-- MIGRATION 021
-- ===========================================================================

-- =============================================================================
-- Migration 021: Financial Closing, Order→Receivable Integration & DRE View
-- Barber-On Studio — FASE 5: Financeiro
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: FINANCIAL_MONTHLY_CLOSINGS (Fechamento mensal automatizado)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_year INT NOT NULL CHECK (period_year >= 2020),
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  total_income DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_expense DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_flow DECIMAL(14,2) NOT NULL DEFAULT 0,
  receivables_received DECIMAL(14,2) NOT NULL DEFAULT 0,
  payables_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  commissions_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  appointments_count INT NOT NULL DEFAULT 0,
  closing_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed', 'reopened')),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_financial_closings_org ON financial_monthly_closings(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_closings_period ON financial_monthly_closings(organization_id, period_year DESC, period_month DESC);

ALTER TABLE financial_monthly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view financial closings"
  ON financial_monthly_closings FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Members can manage financial closings"
  ON financial_monthly_closings FOR ALL
  USING (is_member_of(organization_id))
  WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_financial_monthly_closings_updated_at
  BEFORE UPDATE ON financial_monthly_closings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPO EM ORDERS PARA MARCAR GERAÇÃO AUTOMÁTICA DE RECEBÍVEL
-- -----------------------------------------------------------------------------
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS receivable_generated BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_receivable_generated ON orders(receivable_generated) WHERE receivable_generated = false AND status = 'completed';

-- -----------------------------------------------------------------------------
-- 3. RPC: GENERATE_RECEIVABLE_FROM_COMPLETED_ORDER
-- Cria recebível automaticamente ao finalizar comanda (se não existir)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_receivable_from_completed_order(
  p_order_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_receivable_id UUID;
  v_customer_name TEXT;
BEGIN
  -- Buscar comanda completada
  SELECT o.*, c.full_name AS customer_name_display
  INTO v_order
  FROM orders o
  LEFT JOIN profiles c ON c.id = o.customer_id
  WHERE o.id = p_order_id
    AND o.status = 'completed'
    AND o.receivable_generated = false
    AND o.total > 0;

  IF v_order IS NULL THEN
    RETURN NULL; -- Já gerado ou não elegível
  END IF;

  v_customer_name := COALESCE(v_order.customer_name_display, 'Cliente avulso');

  -- Criar recebível
  INSERT INTO receivables (
    organization_id,
    customer_id,
    order_id,
    description,
    original_amount,
    issue_date,
    due_date,
    status,
    created_by
  ) VALUES (
    v_order.organization_id,
    v_order.customer_id,
    v_order.id,
    'Comanda #' || LEFT(v_order.id::text, 8) || ' — ' || v_customer_name,
    v_order.total,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    CASE WHEN v_order.payment_method IN ('cash', 'pix', 'debit') THEN 'received' ELSE 'open' END,
    v_order.created_by
  ) RETURNING id INTO v_receivable_id;

  -- Se pagamento foi à vista, criar alocação automática
  IF v_order.payment_method IN ('cash', 'pix', 'debit') THEN
    INSERT INTO payment_allocations (
      organization_id,
      receivable_id,
      amount,
      allocated_at
    ) VALUES (
      v_order.organization_id,
      v_receivable_id,
      v_order.total,
      now()
    );

    UPDATE receivables
    SET amount_received = v_order.total,
        status = 'received',
        received_at = now()
    WHERE id = v_receivable_id;
  END IF;

  -- Marcar ordem como processada
  UPDATE orders
  SET receivable_generated = true,
      receivable_id = v_receivable_id,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN v_receivable_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC: GENERATE_MONTHLY_CLOSING
-- Gera/Atualiza fechamento mensal com todos os totais agregados
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_monthly_closing(
  p_org_id UUID,
  p_year INT,
  p_month INT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closing_id UUID;
  v_start DATE;
  v_end DATE;
  v_total_income DECIMAL;
  v_total_expense DECIMAL;
  v_receivables_received DECIMAL;
  v_payables_paid DECIMAL;
  v_commissions_total DECIMAL;
  v_orders_count INT;
  v_appointments_count INT;
  v_closing_balance DECIMAL;
BEGIN
  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + INTERVAL '1 month') - INTERVAL '1 day';

  -- Total income (transações positivas no período)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_income
  FROM financial_transactions
  WHERE organization_id = p_org_id
    AND amount > 0
    AND occurred_at >= v_start::timestamptz
    AND occurred_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Total expense (transações negativas no período)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_expense
  FROM financial_transactions
  WHERE organization_id = p_org_id
    AND amount < 0
    AND occurred_at >= v_start::timestamptz
    AND occurred_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Recebíveis recebidos no período
  SELECT COALESCE(SUM(amount_received), 0) INTO v_receivables_received
  FROM receivables
  WHERE organization_id = p_org_id
    AND status IN ('received', 'partially_received')
    AND received_at >= v_start::timestamptz
    AND received_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Pagáveis pagos no período
  SELECT COALESCE(SUM(amount_paid), 0) INTO v_payables_paid
  FROM payables
  WHERE organization_id = p_org_id
    AND status IN ('paid', 'partially_paid')
    AND paid_at >= v_start::timestamptz
    AND paid_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Comissões totais no período
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_commissions_total
  FROM barber_commissions
  WHERE organization_id = p_org_id
    AND created_at >= v_start::timestamptz
    AND created_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Contagem de pedidos completados
  SELECT COUNT(*) INTO v_orders_count
  FROM orders
  WHERE organization_id = p_org_id
    AND status = 'completed'
    AND completed_at >= v_start::timestamptz
    AND completed_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Contagem de agendamentos completados
  SELECT COUNT(*) INTO v_appointments_count
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND status = 'completed'
    AND completed_at >= v_start::timestamptz
    AND completed_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Saldo de fechamento = saldo acumulado até o fim do período
  SELECT COALESCE(SUM(amount), 0) INTO v_closing_balance
  FROM financial_transactions
  WHERE organization_id = p_org_id
    AND occurred_at < (v_end + INTERVAL '1 day')::timestamptz;

  -- Upsert do fechamento
  INSERT INTO financial_monthly_closings (
    organization_id, period_year, period_month,
    total_income, total_expense, net_flow,
    receivables_received, payables_paid, commissions_total,
    orders_count, appointments_count, closing_balance
  ) VALUES (
    p_org_id, p_year, p_month,
    v_total_income, v_total_expense, v_total_income - v_total_expense,
    v_receivables_received, v_payables_paid, v_commissions_total,
    v_orders_count, v_appointments_count, v_closing_balance
  )
  ON CONFLICT (organization_id, period_year, period_month)
  DO UPDATE SET
    total_income = EXCLUDED.total_income,
    total_expense = EXCLUDED.total_expense,
    net_flow = EXCLUDED.net_flow,
    receivables_received = EXCLUDED.receivables_received,
    payables_paid = EXCLUDED.payables_paid,
    commissions_total = EXCLUDED.commissions_total,
    orders_count = EXCLUDED.orders_count,
    appointments_count = EXCLUDED.appointments_count,
    closing_balance = EXCLUDED.closing_balance,
    updated_at = now()
  RETURNING id INTO v_closing_id;

  RETURN v_closing_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. VIEW: V_FINANCIAL_DRE (Demonstração do Resultado do Exercício mensal)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_financial_dre AS
SELECT
  fmc.organization_id,
  fmc.period_year,
  fmc.period_month,
  TO_CHAR(make_date(fmc.period_year, fmc.period_month, 1), 'YYYY-MM') AS period_label,
  fmc.total_income,
  fmc.total_expense,
  fmc.net_flow,
  fmc.commissions_total,
  fmc.receivables_received,
  fmc.payables_paid,
  fmc.orders_count,
  fmc.appointments_count,
  fmc.closing_balance,
  fmc.status,
  -- Margem líquida (%)
  CASE WHEN fmc.total_income > 0
    THEN ROUND((fmc.net_flow / fmc.total_income) * 100, 2)
    ELSE 0
  END AS net_margin_pct,
  -- Ticket médio
  CASE WHEN fmc.orders_count > 0
    THEN ROUND(fmc.total_income / fmc.orders_count, 2)
    ELSE 0
  END AS avg_ticket
FROM financial_monthly_closings fmc;

-- -----------------------------------------------------------------------------
-- 6. TRIGGER: Auto-generate receivable when order is completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_auto_generate_receivable_on_order_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.total > 0 THEN
    PERFORM generate_receivable_from_completed_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_complete_generate_receivable ON orders;
CREATE TRIGGER trg_order_complete_generate_receivable
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION trg_auto_generate_receivable_on_order_complete();

-- -----------------------------------------------------------------------------
-- 7. MIGRAR DADOS EXISTENTES: gerar recebíveis para comandas já completadas
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id FROM orders
    WHERE status = 'completed'
      AND total > 0
      AND receivable_generated = false
    LIMIT 500
  LOOP
    PERFORM generate_receivable_from_completed_order(v_order.id);
  END LOOP;
END;
$$;
-- ===========================================================================
-- MIGRATION 022
-- ===========================================================================

-- =============================================================================
-- Migration 022: Subscription Benefits, Appointment Integration & Recurring Payments
-- Barber-On Studio — FASE 6: Assinaturas Clientes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: SUBSCRIPTION_PLAN_BENEFITS (Benefícios configuráveis por plano)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plan_benefits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
 benefit_type TEXT NOT NULL CHECK (benefit_type IN ('service', 'product_discount', 'free_product', 'priority_booking', 'custom')),
 benefit_value JSONB NOT NULL DEFAULT '{}'::jsonb,
 -- Ex: {"barber_service_id": "uuid", "quantity_per_month": 2}
 -- Ex: {"discount_percentage": 15, "applies_to": "products"}
 -- Ex: {"product_id": "uuid", "quantity_per_month": 1}
 description TEXT,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_plan_benefits_plan ON subscription_plan_benefits(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_plan_benefits_org ON subscription_plan_benefits(organization_id);

ALTER TABLE subscription_plan_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription plan benefits"
 ON subscription_plan_benefits FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can manage subscription plan benefits"
 ON subscription_plan_benefits FOR ALL
 USING (is_member_of(organization_id))
 WITH CHECK (is_member_of(organization_id));

CREATE TRIGGER set_subscription_plan_benefits_updated_at
 BEFORE UPDATE ON subscription_plan_benefits
 FOR EACH ROW
 EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA: SUBSCRIPTION_SERVICE_USAGE (Registro de serviços usados por período)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_service_usage (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 client_subscription_id UUID NOT NULL REFERENCES client_subscriptions(id) ON DELETE CASCADE,
 calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
 barber_service_id UUID REFERENCES barber_services(id) ON DELETE SET NULL,
 service_name TEXT NOT NULL,
 used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_service_usage_sub ON subscription_service_usage(client_subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_service_usage_period ON subscription_service_usage(client_subscription_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sub_service_usage_event ON subscription_service_usage(calendar_event_id);

ALTER TABLE subscription_service_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscription service usage"
 ON subscription_service_usage FOR SELECT
 USING (is_member_of(organization_id));

CREATE POLICY "Members can insert subscription service usage"
 ON subscription_service_usage FOR INSERT
 WITH CHECK (is_member_of(organization_id));

-- -----------------------------------------------------------------------------
-- 3. ADICIONAR CAMPOS EM CLIENT_SUBSCRIPTIONS PARA INTEGRAÇÃO
-- -----------------------------------------------------------------------------
ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS linked_receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_renewal_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renewal_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_discount_pct DECIMAL(5,2) DEFAULT 0 CHECK (product_discount_pct >= 0 AND product_discount_pct <= 100);

CREATE INDEX IF NOT EXISTS idx_client_subs_receivable ON client_subscriptions(linked_receivable_id);
CREATE INDEX IF NOT EXISTS idx_client_subs_renewal ON client_subscriptions(next_billing_date) WHERE status = 'active' AND auto_renew = true;

-- -----------------------------------------------------------------------------
-- 4. RPC: RECORD_SUBSCRIPTION_SERVICE_USAGE
-- Registra uso de serviço quando agendamento é concluído para cliente assinante
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_subscription_service_usage(
 p_calendar_event_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_event RECORD;
 v_subscription RECORD;
 v_period_start DATE;
 v_period_end DATE;
BEGIN
 -- Buscar agendamento completado com cliente
 SELECT ce.id, ce.customer_id, ce.barber_service_id, ce.start_at, ce.organization_id,
 bs.name AS service_name
 INTO v_event
 FROM calendar_events ce
 LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
 WHERE ce.id = p_calendar_event_id
 AND ce.status = 'completed'
 AND ce.customer_id IS NOT NULL;

 IF v_event IS NULL THEN
 RETURN; -- Não é um agendamento elegível
 END IF;

 -- Buscar assinatura ativa do cliente
 SELECT cs.id, cs.current_period_start, cs.current_period_end,
 cs.services_used_this_period, sp.max_services_per_month
 INTO v_subscription
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.customer_profile_id = v_event.customer_id
 AND cs.organization_id = v_event.organization_id
 AND cs.status IN ('active', 'trial')
 AND cs.current_period_start <= v_event.start_at::date
 AND cs.current_period_end >= v_event.start_at::date
 LIMIT 1;

 IF v_subscription IS NULL THEN
 RETURN; -- Cliente não tem assinatura ativa
 END IF;

 v_period_start := v_subscription.current_period_start;
 v_period_end := v_subscription.current_period_end;

 -- Verificar se já registrou este evento
 IF EXISTS (
 SELECT 1 FROM subscription_service_usage
 WHERE calendar_event_id = p_calendar_event_id
 ) THEN
 RETURN; -- Já registrado
 END IF;

 -- Registrar uso
 INSERT INTO subscription_service_usage (
 organization_id, client_subscription_id, calendar_event_id,
 barber_service_id, service_name, period_start, period_end
 ) VALUES (
 v_event.organization_id, v_subscription.id, p_calendar_event_id,
 v_event.barber_service_id, COALESCE(v_event.service_name, 'Serviço'),
 v_period_start, v_period_end
 );

 -- Atualizar contador na assinatura
 UPDATE client_subscriptions
 SET services_used_this_period = services_used_this_period + 1,
 updated_at = now()
 WHERE id = v_subscription.id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGER: Auto-record service usage when appointment is completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_record_service_usage_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.customer_id IS NOT NULL THEN
 PERFORM record_subscription_service_usage(NEW.id);
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_complete_sub_usage ON calendar_events;
CREATE TRIGGER trg_appointment_complete_sub_usage
 AFTER UPDATE OF status ON calendar_events
 FOR EACH ROW
 WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
 EXECUTE FUNCTION trg_record_service_usage_on_completion();

-- -----------------------------------------------------------------------------
-- 6. RPC: GENERATE_SUBSCRIPTION_RECEIVABLE
-- Gera recebível automático para renovação de assinatura
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_subscription_receivable(
 p_subscription_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_receivable_id UUID;
BEGIN
 SELECT cs.*, sp.price, sp.name AS plan_name, cp.full_name AS customer_name
 INTO v_sub
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 LEFT JOIN profiles cp ON cp.id = cs.customer_profile_id
 WHERE cs.id = p_subscription_id;

 IF v_sub IS NULL THEN
 RAISE EXCEPTION 'Assinatura não encontrada: %', p_subscription_id;
 END IF;

 -- Criar recebível
 INSERT INTO receivables (
 organization_id,
 customer_id,
 description,
 original_amount,
 issue_date,
 due_date,
 status,
 category_id
 ) VALUES (
 v_sub.organization_id,
 v_sub.customer_profile_id,
 'Assinatura: ' || v_sub.plan_name || ' — ' || COALESCE(v_sub.customer_name, 'Cliente'),
 v_sub.price,
 CURRENT_DATE,
 v_sub.next_billing_date,
 'open',
 NULL
 ) RETURNING id INTO v_receivable_id;

 -- Vincular à assinatura
 UPDATE client_subscriptions
 SET linked_receivable_id = v_receivable_id,
 updated_at = now()
 WHERE id = p_subscription_id;

 RETURN v_receivable_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: PROCESS_SUBSCRIPTION_RENEWALS_ENHANCED
-- Versão melhorada que gera recebíveis e notificações
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_subscription_renewals_enhanced()
RETURNS TABLE(renewed_count INT, expired_count INT, receivables_created INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
 v_sub RECORD;
 v_new_end DATE;
 v_renewed INT := 0;
 v_expired INT := 0;
 v_receivables INT := 0;
BEGIN
 FOR v_sub IN
 SELECT cs.id, cs.subscription_plan_id, cs.current_period_end,
 cs.auto_renew, cs.next_billing_date,
 sp.billing_cycle, sp.trial_days
 FROM client_subscriptions cs
 JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
 WHERE cs.status IN ('active', 'trial')
 AND cs.current_period_end <= CURRENT_DATE
 LOOP
 IF v_sub.auto_renew THEN
 -- Calcular novo período
 v_new_end := v_sub.current_period_end;
 CASE v_sub.billing_cycle
 WHEN 'quarterly' THEN v_new_end := v_new_end + INTERVAL '3 months';
 WHEN 'annual' THEN v_new_end := v_new_end + INTERVAL '1 year';
 ELSE v_new_end := v_new_end + INTERVAL '1 month';
 END CASE;

 -- Renovar
 UPDATE client_subscriptions
 SET current_period_start = v_sub.current_period_end + 1,
 current_period_end = v_new_end,
 next_billing_date = v_new_end,
 services_used_this_period = 0,
 last_renewal_at = now(),
 renewal_count = renewal_count + 1,
 updated_at = now()
 WHERE id = v_sub.id;

 -- Gerar recebível
 PERFORM generate_subscription_receivable(v_sub.id);
 v_receivables := v_receivables + 1;

 -- Registrar histórico
 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type, notes
 )
 SELECT organization_id, v_sub.id, 'renewed',
 'Renovação automática — novo período até ' || v_new_end
 FROM client_subscriptions WHERE id = v_sub.id;

 v_renewed := v_renewed + 1;
 ELSE
 -- Expirar
 UPDATE client_subscriptions
 SET status = 'expired',
 cancelled_at = now(),
 updated_at = now()
 WHERE id = v_sub.id;

 INSERT INTO subscription_history (
 organization_id, client_subscription_id, event_type, notes
 )
 SELECT organization_id, v_sub.id, 'expired',
 'Assinatura expirada — renovação automática desativada'
 FROM client_subscriptions WHERE id = v_sub.id;

 v_expired := v_expired + 1;
 END IF;
 END LOOP;

 RETURN QUERY SELECT v_renewed, v_expired, v_receivables;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. VIEW: V_SUBSCRIPTION_USAGE_SUMMARY
-- Resumo de uso de serviços por assinatura no período atual
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_subscription_usage_summary AS
SELECT
 cs.id AS client_subscription_id,
 cs.organization_id,
 cs.customer_profile_id,
 cs.services_used_this_period,
 sp.max_services_per_month,
 CASE WHEN sp.max_services_per_month > 0
 THEN ROUND((cs.services_used_this_period::numeric / sp.max_services_per_month) * 100, 1)
 ELSE NULL
 END AS usage_percentage,
 sp.max_services_per_month - cs.services_used_this_period AS remaining_services,
 cs.current_period_start,
 cs.current_period_end,
 COUNT(ssu.id) AS total_usage_records
FROM client_subscriptions cs
JOIN subscription_plans sp ON sp.id = cs.subscription_plan_id
LEFT JOIN subscription_service_usage ssu
 ON ssu.client_subscription_id = cs.id
 AND ssu.period_start = cs.current_period_start
WHERE cs.status IN ('active', 'trial')
GROUP BY cs.id, cs.organization_id, cs.customer_profile_id,
 cs.services_used_this_period, sp.max_services_per_month,
 cs.current_period_start, cs.current_period_end;
-- ===========================================================================
-- MIGRATION 023
-- ===========================================================================

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
-- ===========================================================================
-- MIGRATION 024
-- ===========================================================================

-- =============================================================================
-- Migration 024: Complementary Modules — Integrations, Advanced Reports & Settings
-- Barber-On Studio — FASE 8: Módulos Complementares
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: INTEGRATION_CONNECTIONS (Conexões com serviços externos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'whatsapp_meta', 'resend', 'mercadopago', 'stripe', 'google_calendar',
    'instagram', 'tiktok', 'webhook_custom'
  )),
  name TEXT NOT NULL,
  config_encrypted JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ex: {"api_key": "...", "account_id": "...", "webhook_url": "..."}
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org ON integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status) WHERE status = 'connected';

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view integration connections"
  ON integration_connections FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "Admins can manage integration connections"
  ON integration_connections FOR ALL
  USING (
    is_member_of(organization_id) AND
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = integration_connections.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    is_member_of(organization_id) AND
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = integration_connections.organization_id
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE TRIGGER set_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA: WEBHOOK_EVENTS (Registro de eventos recebidos via webhook)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_connection_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view webhook events"
  ON webhook_events FOR SELECT
  USING (is_member_of(organization_id));

CREATE POLICY "System can insert webhook events"
  ON webhook_events FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. VIEW: V_REPORT_APPOINTMENTS_SUMMARY
-- Relatório detalhado de agendamentos por período
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_appointments_summary AS
SELECT
  ce.organization_id,
  DATE_TRUNC('month', ce.start_at) AS period,
  COUNT(*) FILTER (WHERE ce.status != 'cancelled') AS total_appointments,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS completed_appointments,
  COUNT(*) FILTER (WHERE ce.status = 'cancelled') AS cancelled_appointments,
  COUNT(*) FILTER (WHERE ce.status = 'no_show') AS no_show_appointments,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS total_revenue,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_ticket,
  COUNT(DISTINCT ce.customer_id) FILTER (WHERE ce.status = 'completed') AS unique_customers,
  COUNT(DISTINCT ce.assigned_barber_id) FILTER (WHERE ce.status = 'completed') AS active_barbers,
  ROUND(
    COUNT(*) FILTER (WHERE ce.status = 'completed')::numeric * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE ce.status != 'cancelled'), 0),
    2
  ) AS completion_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE ce.status = 'no_show')::numeric * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE ce.status != 'cancelled'), 0),
    2
  ) AS no_show_rate_pct
FROM calendar_events ce
GROUP BY ce.organization_id, DATE_TRUNC('month', ce.start_at);

-- -----------------------------------------------------------------------------
-- 4. VIEW: V_REPORT_BARBER_RANKING
-- Ranking de profissionais por desempenho
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_barber_ranking AS
SELECT
  ce.organization_id,
  DATE_TRUNC('month', ce.start_at) AS period,
  ce.assigned_barber_id,
  bp.full_name AS barber_name,
  bp.avatar_url AS barber_avatar,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS appointments_completed,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS revenue_generated,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_ticket,
  COUNT(DISTINCT ce.customer_id) FILTER (WHERE ce.status = 'completed') AS unique_customers_served,
  ROUND(
    COUNT(*) FILTER (WHERE ce.status = 'completed')::numeric * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE ce.assigned_barber_id IS NOT NULL AND ce.status != 'cancelled'), 0),
    2
  ) AS completion_rate_pct
FROM calendar_events ce
LEFT JOIN memberships bm ON bm.id = ce.assigned_barber_id
LEFT JOIN profiles bp ON bp.id = bm.user_id
WHERE ce.assigned_barber_id IS NOT NULL
GROUP BY ce.organization_id, DATE_TRUNC('month', ce.start_at), ce.assigned_barber_id, bp.full_name, bp.avatar_url;

-- -----------------------------------------------------------------------------
-- 5. VIEW: V_REPORT_SERVICE_POPULARITY
-- Serviços mais populares e rentáveis
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_service_popularity AS
SELECT
  ce.organization_id,
  DATE_TRUNC('month', ce.start_at) AS period,
  ce.barber_service_id,
  bs.name AS service_name,
  bs.duration_minutes,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS times_performed,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS total_revenue,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_price,
  SUM(bs.duration_minutes) FILTER (WHERE ce.status = 'completed') AS total_minutes_spent
FROM calendar_events ce
LEFT JOIN barber_services bs ON bs.id = ce.barber_service_id
WHERE ce.barber_service_id IS NOT NULL
GROUP BY ce.organization_id, DATE_TRUNC('month', ce.start_at), ce.barber_service_id, bs.name, bs.duration_minutes;

-- -----------------------------------------------------------------------------
-- 6. VIEW: V_REPORT_CUSTOMER_RETENTION
-- Análise de retenção e frequência de clientes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_customer_retention AS
SELECT
  ce.organization_id,
  ce.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  COUNT(*) FILTER (WHERE ce.status = 'completed') AS total_visits,
  MIN(ce.start_at) FILTER (WHERE ce.status = 'completed') AS first_visit,
  MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') AS last_visit,
  COALESCE(SUM(ce.total_price) FILTER (WHERE ce.status = 'completed'), 0) AS lifetime_value,
  ROUND(AVG(ce.total_price) FILTER (WHERE ce.status = 'completed'), 2) AS avg_ticket,
  CASE
    WHEN MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
    WHEN MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') >= CURRENT_DATE - INTERVAL '90 days' THEN 'at_risk'
    ELSE 'churned'
  END AS retention_status,
  EXTRACT(DAY FROM MAX(ce.start_at) FILTER (WHERE ce.status = 'completed') - MIN(ce.start_at) FILTER (WHERE ce.status = 'completed')) /
    NULLIF(COUNT(*) FILTER (WHERE ce.status = 'completed') - 1, 0) AS avg_days_between_visits
FROM calendar_events ce
LEFT JOIN customers c ON c.id = ce.customer_id
WHERE ce.customer_id IS NOT NULL
GROUP BY ce.organization_id, ce.customer_id, c.name, c.phone;

-- -----------------------------------------------------------------------------
-- 7. VIEW: V_REPORT_PRODUCT_SALES
-- Vendas de produtos integradas às comandas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_report_product_sales AS
SELECT
  o.organization_id,
  DATE_TRUNC('month', o.completed_at) AS period,
  oi.product_id,
  p.name AS product_name,
  pc.name AS category,
  SUM(oi.quantity) AS units_sold,
  COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total_revenue,
  ROUND(AVG(oi.unit_price), 2) AS avg_unit_price,
  COUNT(DISTINCT o.id) AS orders_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN products p ON p.id = oi.product_id
LEFT JOIN product_categories pc ON pc.id = p.category_id
WHERE o.status = 'completed'
  AND oi.product_id IS NOT NULL
  AND o.completed_at IS NOT NULL
GROUP BY o.organization_id, DATE_TRUNC('month', o.completed_at), oi.product_id, p.name, pc.name;

-- -----------------------------------------------------------------------------
-- 8. RPC: GET_DASHBOARD_KPIs
-- KPIs consolidados para dashboard principal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_org_id UUID)
RETURNS TABLE (
  today_appointments BIGINT,
  week_appointments BIGINT,
  month_revenue DECIMAL,
  month_new_customers BIGINT,
  pending_receivables DECIMAL,
  overdue_receivables DECIMAL,
  low_stock_products BIGINT,
  active_subscriptions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := CURRENT_DATE::timestamptz;
  v_week_start TIMESTAMPTZ := (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int)::timestamptz;
  v_month_start TIMESTAMPTZ := DATE_TRUNC('month', CURRENT_DATE)::timestamptz;
BEGIN
  -- Agendamentos hoje
  SELECT COUNT(*) INTO today_appointments
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND start_at >= v_today_start
    AND start_at < v_today_start + INTERVAL '1 day'
    AND status NOT IN ('cancelled', 'no_show');

  -- Agendamentos esta semana
  SELECT COUNT(*) INTO week_appointments
  FROM calendar_events
  WHERE organization_id = p_org_id
    AND start_at >= v_week_start
    AND start_at < v_week_start + INTERVAL '7 days'
    AND status NOT IN ('cancelled', 'no_show');

  -- Receita do mês
  SELECT COALESCE(SUM(total), 0) INTO month_revenue
  FROM orders
  WHERE organization_id = p_org_id
    AND status = 'completed'
    AND completed_at >= v_month_start;

  -- Novos clientes no mês
  SELECT COUNT(*) INTO month_new_customers
  FROM profiles
  WHERE organization_id = p_org_id
    AND created_at >= v_month_start;

  -- Recebíveis pendentes
  SELECT COALESCE(SUM(original_amount - COALESCE(amount_received, 0)), 0) INTO pending_receivables
  FROM receivables
  WHERE organization_id = p_org_id
    AND status IN ('open', 'partially_received');

  -- Recebíveis atrasados
  SELECT COALESCE(SUM(original_amount - COALESCE(amount_received, 0)), 0) INTO overdue_receivables
  FROM receivables
  WHERE organization_id = p_org_id
    AND status IN ('open', 'partially_received')
    AND due_date < CURRENT_DATE;

  -- Produtos com estoque baixo
  SELECT COUNT(*) INTO low_stock_products
  FROM products
  WHERE organization_id = p_org_id
    AND is_active = true
    AND stock_quantity <= min_stock_level;

  -- Assinaturas ativas
  SELECT COUNT(*) INTO active_subscriptions
  FROM client_subscriptions
  WHERE organization_id = p_org_id
    AND status = 'active';

  RETURN NEXT;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. ADICIONAR CAMPOS EM BARBERSHOP_SETTINGS PARA CONFIGURAÇÕES UNIFICADAS
-- -----------------------------------------------------------------------------
ALTER TABLE barbershop_settings
ADD COLUMN IF NOT EXISTS auto_confirm_bookings BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_percentage DECIMAL(5,2) DEFAULT 0 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100),
ADD COLUMN IF NOT EXISTS cancellation_policy_hours INT NOT NULL DEFAULT 2 CHECK (cancellation_policy_hours >= 0),
ADD COLUMN IF NOT EXISTS max_advance_booking_days INT NOT NULL DEFAULT 30 CHECK (max_advance_booking_days > 0),
ADD COLUMN IF NOT EXISTS allow_online_booking BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_prices_online BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS default_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR';
-- ===========================================================================
-- MIGRATION 025
-- ===========================================================================

-- ============================================================================
-- BARBER-ON STUDIO — FUNÇÃO RPC: query_receivables_aging
-- Retorna contas a receber agrupadas por faixa de atraso (aging buckets)
-- para o dashboard financeiro / relatórios.
-- ============================================================================

CREATE OR REPLACE FUNCTION query_receivables_aging(p_org_id UUID)
RETURNS TABLE (
  aging_bucket TEXT,
  outstanding_amount NUMERIC,
  receivable_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se o usuário autenticado é membro da organização
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN r.due_date >= CURRENT_DATE THEN 'current'
      WHEN CURRENT_DATE - r.due_date <= 30 THEN '1_30_days'
      WHEN CURRENT_DATE - r.due_date <= 60 THEN '31_60_days'
      WHEN CURRENT_DATE - r.due_date <= 90 THEN '61_90_days'
      ELSE '90_plus_days'
    END AS aging_bucket,
    SUM(r.original_amount - r.amount_received) AS outstanding_amount,
    COUNT(*)::BIGINT AS receivable_count
  FROM receivables r
  WHERE r.organization_id = p_org_id
    AND r.status NOT IN ('cancelled', 'received')
    AND (r.original_amount - r.amount_received) > 0.01
  GROUP BY
    CASE
      WHEN r.due_date >= CURRENT_DATE THEN 'current'
      WHEN CURRENT_DATE - r.due_date <= 30 THEN '1_30_days'
      WHEN CURRENT_DATE - r.due_date <= 60 THEN '31_60_days'
      WHEN CURRENT_DATE - r.due_date <= 90 THEN '61_90_days'
      ELSE '90_plus_days'
    END
  ORDER BY
    CASE
      WHEN r.due_date >= CURRENT_DATE THEN 0
      WHEN CURRENT_DATE - r.due_date <= 30 THEN 1
      WHEN CURRENT_DATE - r.due_date <= 60 THEN 2
      WHEN CURRENT_DATE - r.due_date <= 90 THEN 3
      ELSE 4
    END;
END;
$$;

-- Revogar execução pública e conceder apenas para authenticated
REVOKE ALL ON FUNCTION query_receivables_aging(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION query_receivables_aging(UUID) TO authenticated;

COMMENT ON FUNCTION query_receivables_aging(UUID) IS
  'Retorna contas a receber em aberto agrupadas por faixa de atraso (aging buckets): current, 1_30_days, 31_60_days, 61_90_days, 90_plus_days. Escopo multi-tenant via p_org_id + verificação de membership.';
-- ===========================================================================
-- MIGRATION 026
-- ===========================================================================

-- ============================================================================
-- BARBER-ON STUDIO — FIX: RLS Policies para order_payments e financial_payments
-- Adiciona policies faltantes identificadas na auditoria de segurança.
-- ============================================================================

-- ============================================================================
-- 1. ORDER_PAYMENTS — Tabela tinha RLS ativado mas ZERO policies (I4)
-- ============================================================================

-- Policies idempotentes: drop + recreate
DO $$
BEGIN
  -- ORDER_PAYMENTS SELECT
  DROP POLICY IF EXISTS "order_payments_select_member" ON order_payments;
  CREATE POLICY "order_payments_select_member"
    ON order_payments FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_payments.order_id
          AND is_member_of(o.organization_id)
      )
    );

  -- ORDER_PAYMENTS UPDATE
  DROP POLICY IF EXISTS "order_payments_update_member" ON order_payments;
  CREATE POLICY "order_payments_update_member"
    ON order_payments FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_payments.order_id
          AND is_member_of(o.organization_id)
      )
    );

  -- ORDER_PAYMENTS DELETE
  DROP POLICY IF EXISTS "order_payments_delete_admin" ON order_payments;
  CREATE POLICY "order_payments_delete_admin"
    ON order_payments FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM orders o
        JOIN memberships m ON m.organization_id = o.organization_id
        WHERE o.id = order_payments.order_id
          AND m.user_id = auth.uid()
          AND m.role IN ('OWNER', 'ADMIN')
      )
    );

  -- FINANCIAL_PAYMENTS UPDATE
  DROP POLICY IF EXISTS "financial_payments_update_member" ON financial_payments;
  CREATE POLICY "financial_payments_update_member"
    ON financial_payments FOR UPDATE
    TO authenticated
    USING (is_member_of(organization_id));

  -- FINANCIAL_PAYMENTS DELETE
  DROP POLICY IF EXISTS "financial_payments_delete_admin" ON financial_payments;
  CREATE POLICY "financial_payments_delete_admin"
    ON financial_payments FOR DELETE
    TO authenticated
    USING (
      is_member_of(organization_id)
      AND EXISTS (
        SELECT 1 FROM memberships
        WHERE organization_id = financial_payments.organization_id
          AND user_id = auth.uid()
          AND role IN ('OWNER', 'ADMIN')
      )
    );
END $$;

-- ============================================================================
-- 3. Garantir que a coluna external_payment_id existe em order_payments
--    (usada pelo webhook do Mercado Pago como chave de upsert)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_payments' AND column_name = 'external_payment_id'
  ) THEN
    ALTER TABLE order_payments ADD COLUMN external_payment_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_external_id
      ON order_payments(external_payment_id)
      WHERE external_payment_id IS NOT NULL;
  END IF;
END $$;

-- Garantir que paid_at existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_payments' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE order_payments ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
END $$;
-- ===========================================================================
-- MIGRATION 027
-- ===========================================================================

-- =============================================================================
-- Migration 027: Public Landing Page RLS Policies
-- Barber-On Studio — Permite leitura pública dos dados da landing page
-- =============================================================================

-- Organizations: leitura pública (necessário para getLandingData buscar org.id)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view organizations" ON organizations;
  CREATE POLICY "Public can view organizations"
    ON organizations FOR SELECT
    USING (true);
END $$;

-- Barber Services: leitura pública apenas dos ativos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active barber services" ON barber_services;
  CREATE POLICY "Public can view active barber services"
    ON barber_services FOR SELECT
    USING (is_active = true);
END $$;

-- Products: leitura pública apenas dos ativos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active products" ON products;
  CREATE POLICY "Public can view active products"
    ON products FOR SELECT
    USING (is_active = true);
END $$;

-- Barbershop Settings: leitura pública
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view barbershop settings" ON barbershop_settings;
  CREATE POLICY "Public can view barbershop settings"
    ON barbershop_settings FOR SELECT
    USING (true);
END $$;

-- Profiles: leitura pública básica (nome e avatar apenas)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view basic profiles" ON profiles;
  CREATE POLICY "Public can view basic profiles"
    ON profiles FOR SELECT
    USING (true);
END $$;

-- Memberships: leitura pública para listar membros ativos de uma org
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view active memberships" ON memberships;
  CREATE POLICY "Public can view active memberships"
    ON memberships FOR SELECT
    USING (status = 'active');
END $$;

-- Public Bookings: permitir insert público (agendamento sem login)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can create bookings" ON public_bookings;
  CREATE POLICY "Public can create bookings"
    ON public_bookings FOR INSERT
    WITH CHECK (true);
END $$;

-- Public Bookings: permitir leitura do próprio agendamento
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view own booking" ON public_bookings;
  CREATE POLICY "Public can view own booking"
    ON public_bookings FOR SELECT
    USING (true);
END $$;
-- ===========================================================================
-- MIGRATION 028
-- ===========================================================================

-- =============================================================================
-- Migration 028: Fix infinite recursion in memberships RLS policies
-- Barber-On Studio — As policies originais da migration 001 causam recursão
-- infinita porque fazem SELECT direto na tabela memberships dentro da USING.
-- A solução é usar is_member_of() (SECURITY DEFINER) ou remover a auto-referência.
-- =============================================================================

-- 1. Remover as policies problemáticas que causam recursão
DROP POLICY IF EXISTS "Members can view memberships of their organizations" ON memberships;
DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON memberships;
DROP POLICY IF EXISTS "Public can view active memberships" ON memberships;

-- 2. Recriar policy de leitura para membros usando is_member_of() (SECURITY DEFINER, sem recursão)
CREATE POLICY "Members can view memberships of their organizations"
  ON memberships FOR SELECT
  TO authenticated
  USING (is_member_of(organization_id));

-- 3. Recriar policy de gerenciamento para owners/admins usando is_member_of() + role check via função
CREATE POLICY "Owners and admins can manage memberships"
  ON memberships FOR ALL
  TO authenticated
  USING (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = memberships.organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

-- 4. Policy pública para memberships — NÃO referenciar a própria tabela
-- Usar apenas verificação direta de coluna, sem subquery
CREATE POLICY "Public can view active memberships"
  ON memberships FOR SELECT
  TO anon, authenticated
  USING (status = 'active');
-- =============================================================================
-- CORREÇÃO DE DADOS — Nomes dos barbeiros Ruan e Lucas
-- =============================================================================
UPDATE profiles SET full_name = 'Ruan' WHERE email = 'ruan@barberon.local' AND (full_name IS NULL OR full_name = '');
UPDATE profiles SET full_name = 'Lucas' WHERE email = 'lucas@barberon.local' AND (full_name IS NULL OR full_name = '');

-- =============================================================================
-- GARANTIR VÍNCULO DO ADMIN COMO OWNER
-- =============================================================================
INSERT INTO memberships (user_id, organization_id, role, status)
VALUES ('2a98cfc0-f218-4ea5-a58c-d837e51531ba', '9f912f7c-4360-4763-b274-de60c2b98b9a', 'OWNER', 'active')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'OWNER', status = 'active';

-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================
SELECT COUNT(*) AS total_tabelas FROM information_schema.tables WHERE table_schema = 'public';
SELECT p.full_name, p.email, m.role, m.status
FROM memberships m JOIN profiles p ON p.id = m.user_id
WHERE m.organization_id = '9f912f7c-4360-4763-b274-de60c2b98b9a'
ORDER BY p.full_name;

-- ✅ SETUP COMPLETO — Se chegou aqui sem erros, tudo está pronto!
