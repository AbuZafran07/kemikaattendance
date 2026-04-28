-- ============================================================
-- KPI Module Migration
-- Tambahkan file ini ke: supabase/migrations/[timestamp]_kpi_tables.sql
-- ============================================================

-- 1. KPI Indicators (definisi indikator per karyawan per tahun)
create table if not exists kpi_indicators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  year integer not null,
  name text not null,
  description text,
  weight numeric not null default 0,
  target text not null default '100',
  unit text not null default '%',
  formula_type text not null default 'ratio',
  -- formula_type: ratio | akumulasi | avg | lower | threshold | custom
  thresholds jsonb default '[]'::jsonb,
  custom_vars jsonb default '[]'::jsonb,
  custom_expr text default '',
  sort_order integer default 0,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. KPI Realizations (input nilai realisasi bulanan)
create table if not exists kpi_realizations (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid references kpi_indicators(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  month integer not null,  -- 0 = Jan, 11 = Des
  year integer not null,
  value numeric,           -- untuk formula non-custom
  custom_values jsonb default '{}'::jsonb, -- untuk formula custom: {v0: x, v1: y}
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(indicator_id, month, year)
);

-- 3. KPI Grade Settings (mapping grade → bonus %)
create table if not exists kpi_grade_settings (
  id uuid primary key default gen_random_uuid(),
  grade text not null unique,
  min_score numeric not null,
  bonus_percent numeric not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Insert default grade settings
insert into kpi_grade_settings (grade, min_score, bonus_percent) values
  ('A', 90, 15),
  ('B', 75, 10),
  ('C', 60, 5),
  ('D', 0,  0)
on conflict (grade) do nothing;

-- RLS Policies
alter table kpi_indicators enable row level security;
alter table kpi_realizations enable row level security;
alter table kpi_grade_settings enable row level security;

-- kpi_indicators: admin bisa semua, karyawan bisa lihat milik sendiri
create policy "Admin full access kpi_indicators"
  on kpi_indicators for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'hr')
    )
  );

create policy "Employee read own kpi_indicators"
  on kpi_indicators for select
  using (user_id = auth.uid());

-- kpi_realizations: admin bisa semua, karyawan bisa input milik sendiri
create policy "Admin full access kpi_realizations"
  on kpi_realizations for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'hr')
    )
  );

create policy "Employee read own kpi_realizations"
  on kpi_realizations for select
  using (user_id = auth.uid());

create policy "Employee insert own kpi_realizations"
  on kpi_realizations for insert
  with check (user_id = auth.uid());

create policy "Employee update own kpi_realizations"
  on kpi_realizations for update
  using (user_id = auth.uid());

-- kpi_grade_settings: semua bisa baca, admin bisa edit
create policy "All read kpi_grade_settings"
  on kpi_grade_settings for select
  using (true);

create policy "Admin manage kpi_grade_settings"
  on kpi_grade_settings for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'hr')
    )
  );

-- Index untuk performa query
create index if not exists idx_kpi_indicators_user_year on kpi_indicators(user_id, year);
create index if not exists idx_kpi_realizations_indicator on kpi_realizations(indicator_id, year);
create index if not exists idx_kpi_realizations_user_year on kpi_realizations(user_id, year);
