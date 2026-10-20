-- דפ"ר עילאי: סכמה ראשונית
-- להריץ בפרויקט Supabase אחד בלבד. לא לשנות את הקובץ אחרי הרצה. לשינוי: מיגרציה חדשה.

create extension if not exists pgcrypto;

-- תחומים
create table if not exists public.domains (
  code text primary key,
  name_he text not null,
  weight_hint text not null
);

insert into public.domains (code, name_he, weight_hint) values
  ('verbal', 'חשיבה מילולית', '50 עד 60 אחוז מהזמן, מקבל את העיקר'),
  ('quant', 'חשיבה כמותית', 'מתחזק; מעלים לפי אבחון'),
  ('figural', 'חשיבה צורנית', 'תחזוקה כ-10 אחוז'),
  ('instructions', 'הבנת הוראות', 'נרשמת כסוג טעות נפרד')
on conflict (code) do nothing;

-- אדמינים (email בלבד; מוסיפים ידנית ב-Supabase, לא בקוד)
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- בנק שאלות
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  domain text not null references public.domains(code),
  layer text not null check (layer in ('knowledge', 'understanding', 'application')),
  skill text not null,
  difficulty int not null check (difficulty between 1 and 3),
  prompt text not null,
  instruction_text text,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_index int not null check (correct_index >= 0),
  explanation text not null,
  source text not null check (source in ('official', 'reconstructed', 'new')),
  time_limit_seconds int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists questions_domain_layer_idx on public.questions (domain, layer);

-- ניסיונות
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('diagnostic', 'daily', 'practice', 'mock_partial', 'mock_full')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score_estimate numeric,
  constraint score_is_internal check (score_estimate is null or kind in ('diagnostic', 'mock_partial', 'mock_full'))
);

create index if not exists attempts_user_idx on public.attempts (user_id, started_at desc);

-- פריטים בניסיון
create table if not exists public.attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  question_id uuid not null references public.questions(id),
  selected_index int,
  is_correct boolean not null,
  seconds_taken int,
  error_type text not null default 'none'
    check (error_type in ('none', 'knowledge', 'understanding', 'instruction', 'calculation', 'time')),
  answered_at timestamptz not null default now()
);

create index if not exists attempt_items_user_skill_idx on public.attempt_items (user_id, question_id);

-- ניסוח הכלל במילים של עילאי
create table if not exists public.error_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  skill text not null,
  error_type text not null check (error_type in ('knowledge', 'understanding', 'instruction', 'calculation', 'time')),
  rule_restatement text not null,
  created_at timestamptz not null default now()
);

-- RLS: פעיל בכל טבלה
alter table public.domains enable row level security;
alter table public.admins enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_items enable row level security;
alter table public.error_notes enable row level security;

-- domains: קריאה למשתמש מחובר
create policy "domains_read" on public.domains
  for select to authenticated using (true);

-- admins: קריאה רק לאדמין
create policy "admins_read_admin" on public.admins
  for select to authenticated using (public.is_admin());

-- questions: קריאה למשתמש מחובר, כתיבה לאדמין בלבד
create policy "questions_read" on public.questions
  for select to authenticated using (true);
create policy "questions_write_admin" on public.questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- attempts: כל שורה שייכת למשתמש
create policy "attempts_own" on public.attempts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- attempt_items: כל שורה שייכת למשתמש
create policy "attempt_items_own" on public.attempt_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- error_notes: כל שורה שייכת למשתמש
create policy "error_notes_own" on public.error_notes
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- הערה: להוסיף את האדמין ידנית אחרי ההרצה, למשל:
-- insert into public.admins (email) values ('<ADMIN_EMAIL>');
