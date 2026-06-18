
create table public.calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index calendar_tokens_user_idx on public.calendar_tokens(user_id);
create index calendar_tokens_token_idx on public.calendar_tokens(token);

grant select, insert, update, delete on public.calendar_tokens to authenticated;
grant all on public.calendar_tokens to service_role;

alter table public.calendar_tokens enable row level security;

create policy "calendar_tokens: owner all" on public.calendar_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "calendar_tokens: super_admin all" on public.calendar_tokens
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));
