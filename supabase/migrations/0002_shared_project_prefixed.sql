-- דפ"ר עילאי: סכמה בפרויקט Supabase משותף (cultura-GH)
-- זהה לוגית ל-0001_init.sql, עם קידומת dapar_ לכל טבלה ופונקציה, כדי לא להתנגש באפליקציות אחרות.
-- תוספת: עמודה figure בשאלות, לתיאור צורות בחשיבה צורנית (מצוירות ב-SVG בממשק).

create extension if not exists pgcrypto;

create table if not exists public.dapar_domains (
  code text primary key,
  name_he text not null,
  weight_hint text not null
);

insert into public.dapar_domains (code, name_he, weight_hint) values
  ('verbal', 'חשיבה מילולית', '50 עד 60 אחוז מהזמן, מקבל את העיקר'),
  ('quant', 'חשיבה כמותית', 'מתחזק; מעלים לפי אבחון'),
  ('figural', 'חשיבה צורנית', 'תחזוקה כ-10 אחוז'),
  ('instructions', 'הבנת הוראות', 'נרשמת כסוג טעות נפרד')
on conflict (code) do nothing;

create table if not exists public.dapar_admins (
  email text primary key
);

create or replace function public.dapar_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dapar_admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
  );
$$;

create table if not exists public.dapar_questions (
  id uuid primary key default gen_random_uuid(),
  domain text not null references public.dapar_domains(code),
  layer text not null check (layer in ('knowledge', 'understanding', 'application')),
  skill text not null,
  difficulty int not null check (difficulty between 1 and 3),
  prompt text not null,
  instruction_text text,
  figure jsonb,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_index int not null check (correct_index >= 0),
  explanation text not null,
  source text not null check (source in ('official', 'reconstructed', 'new')),
  time_limit_seconds int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists dapar_questions_domain_layer_idx on public.dapar_questions (domain, layer);

create table if not exists public.dapar_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('diagnostic', 'daily', 'practice', 'mock_partial', 'mock_full')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score_estimate numeric,
  constraint dapar_score_is_internal check (score_estimate is null or kind in ('diagnostic', 'mock_partial', 'mock_full'))
);

create index if not exists dapar_attempts_user_idx on public.dapar_attempts (user_id, started_at desc);

create table if not exists public.dapar_attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.dapar_attempts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  question_id uuid not null references public.dapar_questions(id) on delete cascade,
  selected_index int,
  is_correct boolean not null,
  seconds_taken int,
  error_type text not null default 'none'
    check (error_type in ('none', 'knowledge', 'understanding', 'instruction', 'calculation', 'time')),
  answered_at timestamptz not null default now()
);

create index if not exists dapar_attempt_items_user_idx on public.dapar_attempt_items (user_id, question_id);

create table if not exists public.dapar_error_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  skill text not null,
  error_type text not null check (error_type in ('knowledge', 'understanding', 'instruction', 'calculation', 'time')),
  rule_restatement text not null,
  created_at timestamptz not null default now()
);

alter table public.dapar_domains enable row level security;
alter table public.dapar_admins enable row level security;
alter table public.dapar_questions enable row level security;
alter table public.dapar_attempts enable row level security;
alter table public.dapar_attempt_items enable row level security;
alter table public.dapar_error_notes enable row level security;

create policy "dapar_domains_read" on public.dapar_domains
  for select to authenticated using (true);

create policy "dapar_admins_read_admin" on public.dapar_admins
  for select to authenticated using (public.dapar_is_admin());

create policy "dapar_questions_read" on public.dapar_questions
  for select to authenticated using (true);
create policy "dapar_questions_insert_admin" on public.dapar_questions
  for insert to authenticated with check (public.dapar_is_admin());
create policy "dapar_questions_update_admin" on public.dapar_questions
  for update to authenticated using (public.dapar_is_admin()) with check (public.dapar_is_admin());
create policy "dapar_questions_delete_admin" on public.dapar_questions
  for delete to authenticated using (public.dapar_is_admin());

create policy "dapar_attempts_own" on public.dapar_attempts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dapar_attempt_items_own" on public.dapar_attempt_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dapar_error_notes_own" on public.dapar_error_notes
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke execute on function public.dapar_is_admin() from anon;

-- האדמין נוסף ידנית, לא בקוד:
-- insert into public.dapar_admins (email) values ('<ADMIN_EMAIL>');
