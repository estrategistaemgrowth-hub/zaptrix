-- Zaptrix Micro SaaS - Foundation Schema
-- Multi-tenant architecture with platform admin layer
-- 2026-09-09

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE workspace_status AS ENUM ('active', 'suspended', 'blocked');
CREATE TYPE workspace_member_role AS ENUM ('owner', 'admin', 'atendente');
CREATE TYPE whatsapp_connection_status AS ENUM ('disconnected', 'connecting', 'connected', 'error');
CREATE TYPE conversation_status AS ENUM ('open', 'closed', 'archived');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_sender_type AS ENUM ('customer', 'ai', 'human', 'system');
CREATE TYPE message_type AS ENUM ('text');
CREATE TYPE product_import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE ai_run_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE ai_provider AS ENUM ('gemini', 'groq', 'openai', 'anthropic');

-- ============================================================================
-- TABLES: PLATFORM LAYER (Super Admin)
-- ============================================================================

CREATE TABLE platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE platform_admins IS 'Super admins of the Zaptrix platform (non-workspace-specific)';

-- ============================================================================
-- TABLES: WORKSPACES & MEMBERSHIPS
-- ============================================================================

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  site_url text,
  segment text,

  -- Platform management
  status workspace_status NOT NULL DEFAULT 'active',
  status_reason text,
  status_changed_at timestamp with time zone DEFAULT now(),
  status_changed_by uuid REFERENCES auth.users(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  plan_notes text,
  created_by uuid REFERENCES auth.users(id),

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role workspace_member_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),

  UNIQUE(workspace_id, user_id)
);

-- ============================================================================
-- TABLES: WHATSAPP & MESSAGING
-- ============================================================================

CREATE TABLE whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  phone_number text,
  status whatsapp_connection_status NOT NULL DEFAULT 'disconnected',
  webhook_secret text NOT NULL UNIQUE,
  last_connection_at timestamp with time zone,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  external_id text,
  phone text NOT NULL,
  name text,
  push_name text,
  first_contact_at timestamp with time zone DEFAULT now(),
  last_contact_at timestamp with time zone DEFAULT now(),

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  UNIQUE(workspace_id, phone)
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  whatsapp_connection_id uuid REFERENCES whatsapp_connections(id),
  status conversation_status NOT NULL DEFAULT 'open',
  ai_enabled boolean DEFAULT true,
  processing boolean DEFAULT false,
  last_message_at timestamp with time zone,
  last_ai_message_at timestamp with time zone,
  last_human_message_at timestamp with time zone,
  unread_count integer DEFAULT 0,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_message_id text,
  direction message_direction NOT NULL,
  sender_type message_sender_type NOT NULL,
  message_type message_type NOT NULL DEFAULT 'text',
  content text,
  status text,
  provider_payload jsonb,

  created_at timestamp with time zone DEFAULT now(),

  UNIQUE(workspace_id, external_message_id)
);

-- ============================================================================
-- TABLES: PRODUCTS & CATALOG
-- ============================================================================

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  description text,
  category text,
  tags text[],
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  promotional_price numeric(10, 2) CHECK (promotional_price IS NULL OR promotional_price >= 0),
  purchase_url text,
  image_url text,
  active boolean DEFAULT true,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE product_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  filename text NOT NULL,
  status product_import_status NOT NULL DEFAULT 'pending',
  total_rows integer,
  created_count integer,
  updated_count integer,
  error_count integer,

  created_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone
);

-- ============================================================================
-- TABLES: KNOWLEDGE BASE & RAG
-- ============================================================================

CREATE TABLE knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  content text NOT NULL,
  active boolean DEFAULT true,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  knowledge_entry_id uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer,

  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- TABLES: AI CONFIGURATION
-- ============================================================================

CREATE TABLE ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_name text,
  company_name text,
  objective text,
  persona text,
  tone text,
  custom_tone text,
  response_style text,
  allowed_topics text,
  forbidden_topics text,
  business_rules text,
  enabled boolean DEFAULT true,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE llm_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider ai_provider NOT NULL,
  encrypted_api_key text NOT NULL,
  key_hint text,
  model_id text,
  enabled boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  is_fallback boolean DEFAULT false,

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id),
  input_message_id uuid REFERENCES messages(id),
  provider ai_provider,
  model text,
  status ai_run_status NOT NULL DEFAULT 'pending',
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  error_message text,

  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- TABLES: ANALYTICS & TRACKING
-- ============================================================================

CREATE TABLE product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id),
  product_id uuid NOT NULL REFERENCES products(id),

  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE product_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  conversation_id uuid REFERENCES conversations(id),
  contact_id uuid REFERENCES contacts(id),
  recommendation_id uuid REFERENCES product_recommendations(id),

  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES whatsapp_connections(id),
  event_type text NOT NULL,
  external_event_id text,
  payload jsonb,
  processed boolean DEFAULT false,

  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- SECURITY FUNCTIONS (DEFINER for RLS) — Must come AFTER table definitions
-- ============================================================================

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid, min_role text[] DEFAULT '{}')
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND (min_role = '{}' OR role::text = ANY(min_role))
  );
$$;

CREATE OR REPLACE FUNCTION current_workspace_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_contacts_workspace_phone ON contacts(workspace_id, phone);
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_messages_workspace ON messages(workspace_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_external_id ON messages(external_message_id);
CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_knowledge_workspace ON knowledge_entries(workspace_id);
CREATE INDEX idx_knowledge_chunks_entry ON knowledge_chunks(knowledge_entry_id);
CREATE INDEX idx_ai_runs_workspace ON ai_runs(workspace_id);
CREATE INDEX idx_ai_runs_conversation ON ai_runs(conversation_id);
CREATE INDEX idx_product_recs_conversation ON product_recommendations(conversation_id);
CREATE INDEX idx_whatsapp_connections_workspace ON whatsapp_connections(workspace_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies: platform_admins
CREATE POLICY "Platform admins can view their own row"
  ON platform_admins FOR SELECT
  USING (user_id = auth.uid());

-- Policies: workspaces
CREATE POLICY "Users can view their workspace"
  ON workspaces FOR SELECT
  USING (
    is_platform_admin() OR
    EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Platform admins can update any workspace"
  ON workspaces FOR UPDATE
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Policies: workspace_members
CREATE POLICY "Users can view members of their workspace"
  ON workspace_members FOR SELECT
  USING (
    is_workspace_member(workspace_id) OR
    is_platform_admin()
  );

-- Policies: contacts (workspace isolation)
CREATE POLICY "Users can view workspace contacts"
  ON contacts FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can create contacts in their workspace"
  ON contacts FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update contacts in their workspace"
  ON contacts FOR UPDATE
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

-- Policies: conversations (workspace isolation, role-based)
CREATE POLICY "Workspace members can view conversations"
  ON conversations FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can update conversations"
  ON conversations FOR UPDATE
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

-- Policies: messages (workspace isolation)
CREATE POLICY "Workspace members can view messages"
  ON messages FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can insert messages"
  ON messages FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- Policies: products (owner/admin only)
CREATE POLICY "Workspace members can view products"
  ON products FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can manage products"
  ON products FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update products"
  ON products FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can delete products"
  ON products FOR DELETE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- Policies: knowledge_entries (owner/admin only)
CREATE POLICY "Workspace members can view knowledge"
  ON knowledge_entries FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can manage knowledge"
  ON knowledge_entries FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update knowledge"
  ON knowledge_entries FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- Policies: ai_profiles (owner/admin only)
CREATE POLICY "Workspace members can view AI profile"
  ON ai_profiles FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owner/admin can manage AI profile"
  ON ai_profiles FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- Policies: llm_credentials (owner/admin only)
CREATE POLICY "Owner/admin can view credentials"
  ON llm_credentials FOR SELECT
  USING (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can manage credentials"
  ON llm_credentials FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update credentials"
  ON llm_credentials FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- Policies: whatsapp_connections (owner/admin only)
CREATE POLICY "Owner/admin can view connections"
  ON whatsapp_connections FOR SELECT
  USING (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can manage connections"
  ON whatsapp_connections FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, array['owner','admin']));

CREATE POLICY "Owner/admin can update connections"
  ON whatsapp_connections FOR UPDATE
  USING (is_workspace_member(workspace_id, array['owner','admin']));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION is_platform_admin() IS 'Check if current user is a platform admin (super admin)';
COMMENT ON FUNCTION is_workspace_member(uuid, text[]) IS 'Check if current user is a member of a workspace with optional role filter';
COMMENT ON FUNCTION current_workspace_id() IS 'Get the current user primary workspace ID';
