-- Weekly email logs: track sent portfolio report emails
create table if not exists weekly_email_logs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  recipient_type text not null default 'group' check (recipient_type in ('group', 'individual')),
  sent_at timestamptz not null default now(),
  email_content_preview text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'preview')),
  created_by uuid references auth.users(id)
);

create index idx_weekly_email_logs_class on weekly_email_logs(class_id);
create index idx_weekly_email_logs_sent on weekly_email_logs(sent_at desc);

-- Add auto_email_enabled to classes
alter table classes add column if not exists auto_email_enabled boolean not null default false;

-- RLS: teachers can read/insert logs
alter table weekly_email_logs enable row level security;

create policy "Teachers and admins can read email logs"
  on weekly_email_logs for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('teacher', 'admin')
    )
  );

create policy "Teachers and admins can insert email logs"
  on weekly_email_logs for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('teacher', 'admin')
    )
  );
