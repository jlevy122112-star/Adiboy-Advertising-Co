-- Digital HQ — Supabase SQL Migration
-- Run this in your Supabase SQL editor to create all tables and RLS policies

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── users ──────────────────────────────────
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  role text not null default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── workspaces ─────────────────────────────
create table if not exists workspaces (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- ── brands ─────────────────────────────────
create table if not exists brands (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null default '',
  industry text,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz default now()
);

-- ── user_progress ──────────────────────────
create table if not exists user_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade unique,
  level int not null default 1,
  xp int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── campaigns ──────────────────────────────
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  name text not null,
  objective text not null default '',
  status text not null default 'draft',
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── campaign_channels ──────────────────────
create table if not exists campaign_channels (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  channel text not null
);

-- ── campaign_metrics ───────────────────────
create table if not exists campaign_metrics (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  impressions int default 0,
  reach int default 0,
  clicks int default 0,
  conversions int default 0,
  spend numeric(12,2) default 0,
  roas numeric(8,2) default 0,
  updated_at timestamptz default now()
);

-- ── content_items ──────────────────────────
create table if not exists content_items (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  channel text not null,
  type text not null default 'post',
  title text not null,
  status text not null default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── content_variants ───────────────────────
create table if not exists content_variants (
  id uuid primary key default uuid_generate_v4(),
  content_id uuid references content_items(id) on delete cascade,
  copy text not null,
  media_url text,
  created_at timestamptz default now()
);

-- ── content_status_history ─────────────────
create table if not exists content_status_history (
  id uuid primary key default uuid_generate_v4(),
  content_id uuid references content_items(id) on delete cascade,
  status text not null,
  changed_at timestamptz default now(),
  changed_by uuid references users(id) on delete set null
);

-- ── tasks ──────────────────────────────────
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  content_id uuid references content_items(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'todo',
  due_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── task_dependencies ──────────────────────
create table if not exists task_dependencies (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  depends_on_task_id uuid references tasks(id) on delete cascade
);

-- ── task_activity_log ──────────────────────
create table if not exists task_activity_log (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  timestamp timestamptz default now()
);

-- ── task_suggestions ───────────────────────
create table if not exists task_suggestions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  suggestion_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── metrics_raw ────────────────────────────
create table if not exists metrics_raw (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  provider text not null,
  external_id text,
  payload jsonb not null default '{}',
  fetched_at timestamptz default now()
);

-- ── metrics_aggregated ─────────────────────
create table if not exists metrics_aggregated (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  content_id uuid references content_items(id) on delete set null,
  channel text not null,
  date date not null,
  impressions int default 0,
  reach int default 0,
  clicks int default 0,
  conversions int default 0,
  spend numeric(12,2) default 0,
  roas numeric(8,2) default 0,
  created_at timestamptz default now()
);

-- ── integrations ───────────────────────────
create table if not exists integrations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(workspace_id, provider)
);

-- ── unlocks ────────────────────────────────
create table if not exists unlocks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  scene_key text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, scene_key)
);

-- ── achievements ───────────────────────────
create table if not exists achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  achievement text not null,
  unlocked_at timestamptz default now()
);

-- ── cosmetics ──────────────────────────────
create table if not exists cosmetics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  item_key text not null,
  unlocked_at timestamptz default now()
);

-- ── lootboxes ──────────────────────────────
create table if not exists lootboxes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  opened boolean not null default false,
  contents jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── generations ────────────────────────────
create table if not exists generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  brief jsonb not null default '{}',
  artifacts jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ── password_reset_tokens ──────────────────
create table if not exists password_reset_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- ── notifications ──────────────────────────
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  priority text not null default 'routine',
  read boolean not null default false,
  created_at timestamptz default now()
);

-- ── ai_insights ────────────────────────────
create table if not exists ai_insights (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  insight text not null,
  created_at timestamptz default now()
);

-- ── Row Level Security ──────────────────────
-- Users can only access their own workspace data
alter table users enable row level security;
alter table workspaces enable row level security;
alter table brands enable row level security;
alter table user_progress enable row level security;
alter table campaigns enable row level security;
alter table campaign_channels enable row level security;
alter table campaign_metrics enable row level security;
alter table content_items enable row level security;
alter table content_variants enable row level security;
alter table content_status_history enable row level security;
alter table tasks enable row level security;
alter table integrations enable row level security;
alter table unlocks enable row level security;
alter table achievements enable row level security;
alter table notifications enable row level security;
alter table generations enable row level security;
alter table ai_insights enable row level security;

-- Service role bypasses RLS (used by backend)
-- Anon/authenticated policies can be added here as needed
