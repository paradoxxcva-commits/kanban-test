
-- ============ ENUMS ============
create type public.app_role as enum ('super_admin', 'admin', 'user');

-- ============ ORGANIZATIONS ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  email text not null,
  full_name text,
  avatar_url text,
  paid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles(org_id);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  org_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, role, org_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- ============ SECURITY DEFINER HELPERS ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = 'super_admin')
$$;

create or replace function public.get_user_org(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = _user_id
$$;

create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id and role = 'admin' and org_id = _org_id
  )
$$;

-- ============ TRIGGER: auto-create profile on signup ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ POLICIES: organizations ============
create policy "orgs: super_admin all" on public.organizations
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "orgs: members read own" on public.organizations
  for select to authenticated
  using (id = public.get_user_org(auth.uid()));

-- ============ POLICIES: profiles ============
create policy "profiles: super_admin all" on public.profiles
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "profiles: read self" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles: read org members" on public.profiles
  for select to authenticated
  using (org_id is not null and org_id = public.get_user_org(auth.uid()));

create policy "profiles: update self limited" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: org admin manage org members" on public.profiles
  for update to authenticated
  using (org_id is not null and public.is_org_admin(auth.uid(), org_id))
  with check (org_id is not null and public.is_org_admin(auth.uid(), org_id));

create policy "profiles: read super_admin for support" on public.profiles
  for select to authenticated
  using (exists (select 1 from public.user_roles where user_id = id and role = 'super_admin'));

-- ============ POLICIES: user_roles ============
create policy "roles: super_admin all" on public.user_roles
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create policy "roles: read self" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create policy "roles: org admin read org" on public.user_roles
  for select to authenticated
  using (org_id is not null and public.is_org_admin(auth.uid(), org_id));

create policy "roles: read super_admin for support" on public.user_roles
  for select to authenticated
  using (role = 'super_admin');

-- ============ BOARDS ============
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  color text default 'brand',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index boards_org_idx on public.boards(org_id);
grant select, insert, update, delete on public.boards to authenticated;
grant all on public.boards to service_role;
alter table public.boards enable row level security;

create policy "boards: org members read" on public.boards for select to authenticated
  using (org_id = public.get_user_org(auth.uid()) or public.is_super_admin(auth.uid()));
create policy "boards: org members write" on public.boards for insert to authenticated
  with check (org_id = public.get_user_org(auth.uid()));
create policy "boards: org members update" on public.boards for update to authenticated
  using (org_id = public.get_user_org(auth.uid()))
  with check (org_id = public.get_user_org(auth.uid()));
create policy "boards: org members delete" on public.boards for delete to authenticated
  using (org_id = public.get_user_org(auth.uid()));

-- ============ BOARD COLUMNS ============
create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index board_columns_board_idx on public.board_columns(board_id);
grant select, insert, update, delete on public.board_columns to authenticated;
grant all on public.board_columns to service_role;
alter table public.board_columns enable row level security;

create policy "columns: by board access" on public.board_columns for all to authenticated
  using (exists(select 1 from public.boards b where b.id = board_id and (b.org_id = public.get_user_org(auth.uid()) or public.is_super_admin(auth.uid()))))
  with check (exists(select 1 from public.boards b where b.id = board_id and b.org_id = public.get_user_org(auth.uid())));

-- ============ TASKS ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid references public.board_columns(id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date timestamptz,
  completed_at timestamptz,
  position int not null default 0,
  priority text default 'normal',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_board_idx on public.tasks(board_id);
create index tasks_completed_idx on public.tasks(completed_at);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;

create policy "tasks: by board access" on public.tasks for all to authenticated
  using (exists(select 1 from public.boards b where b.id = board_id and (b.org_id = public.get_user_org(auth.uid()) or public.is_super_admin(auth.uid()))))
  with check (exists(select 1 from public.boards b where b.id = board_id and b.org_id = public.get_user_org(auth.uid())));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ============ DIRECT MESSAGES ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text,
  attachment_url text,
  attachment_name text,
  attachment_size int,
  attachment_mime text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  check (body is not null or attachment_url is not null)
);
create index messages_pair_idx on public.messages(
  least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create policy "messages: participants read" on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages: sender insert" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists(
      select 1 from public.profiles p
      where p.id = recipient_id and p.org_id = public.get_user_org(auth.uid())
    )
  );
create policy "messages: recipient mark read" on public.messages for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
create policy "messages: sender delete" on public.messages for delete to authenticated
  using (sender_id = auth.uid());

alter publication supabase_realtime add table public.messages;

-- ============ DASHBOARD AGGREGATION RPC ============
create or replace function public.tasks_completed_by_period(_days int)
returns table(bucket date, count bigint)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select date_trunc('day', now())::date - (_days - 1) as start_day,
           date_trunc('day', now())::date as end_day
  ),
  series as (
    select generate_series((select start_day from bounds), (select end_day from bounds), interval '1 day')::date as bucket
  )
  select s.bucket,
         coalesce(count(t.id), 0) as count
  from series s
  left join public.tasks t
    on t.completed_at is not null
   and date_trunc('day', t.completed_at)::date = s.bucket
   and exists(
     select 1 from public.boards b
     where b.id = t.board_id
       and (b.org_id = public.get_user_org(auth.uid()) or public.is_super_admin(auth.uid()))
   )
  group by s.bucket
  order by s.bucket;
$$;

grant execute on function public.tasks_completed_by_period(int) to authenticated;
