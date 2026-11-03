-- Proposed Phase 2 migration; NOT executed by this prototype.
-- Target: Supabase Postgres. Review and test before applying to any database.
-- Core tenant isolation below; department scope requires a further restrictive
-- policy in the implementation. Default-deny browser writes to execution tables.
create extension if not exists pgcrypto;
create type public.task_status as enum ('New','Waiting for information','In progress','Draft ready','Awaiting approval','Approved','Rejected','Completed','Failed');
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null);
create table public.memberships (
 organization_id uuid not null references public.organizations,
 user_id uuid not null references auth.users,
 role text not null check (role in ('admin','member','reviewer')),
 department text not null default '',
 primary key (organization_id,user_id)
);
create table public.agents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null, title text not null, department text not null,
 active boolean not null default true,
 avatar jsonb not null default '{}',
 configuration jsonb not null, -- typed Agent configuration, validated by API
 revision integer not null default 1 check (revision>0),
 created_at timestamptz not null default now(),
 unique(organization_id,id)
);
create table public.agent_revisions (
 organization_id uuid not null, agent_id uuid not null, revision integer not null,
 configuration jsonb not null, created_by uuid not null references auth.users,
 created_at timestamptz not null default now(),
 primary key(organization_id,agent_id,revision),
 foreign key(organization_id,agent_id) references public.agents(organization_id,id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 agent_id uuid not null, agent_revision integer not null,
 requester_id uuid not null references auth.users,
 title text not null, status public.task_status not null default 'New',
 inputs jsonb not null default '{}', progress integer not null default 0 check(progress between 0 and 100),
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 foreign key(organization_id,agent_id,agent_revision) references public.agent_revisions(organization_id,agent_id,revision)
);
create table public.drafts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 task_id uuid not null, revision integer not null, content_hash text not null,
 private_storage_path text not null, provenance jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(organization_id,task_id,revision), unique(organization_id,id),
 foreign key(organization_id,task_id) references public.tasks(organization_id,id)
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 draft_id uuid not null, reviewer_id uuid not null references auth.users,
 content_hash text not null, decision text not null check(decision in ('approved','rejected')),
 reason text, approved_actions jsonb not null default '[]', created_at timestamptz not null default now(),
 foreign key(organization_id,draft_id) references public.drafts(organization_id,id)
);
create table public.artifacts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 draft_id uuid not null, format text not null, private_storage_path text not null,
 created_at timestamptz not null default now(),
 foreign key(organization_id,draft_id) references public.drafts(organization_id,id)
);
create table public.connections (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 provider text not null check(provider='google'), account_reference text not null,
 granted_scopes text[] not null, revoked_at timestamptz,
 unique(organization_id,id)
); -- metadata only; encrypted credentials belong in a separate non-exposed schema
create table public.data_sources (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 connection_id uuid not null, agent_id uuid not null,
 source_type text not null, source_reference text not null,
 allowed_ranges jsonb not null default '[]', field_mapping jsonb not null default '{}',
 foreign key(organization_id,connection_id) references public.connections(organization_id,id),
 foreign key(organization_id,agent_id) references public.agents(organization_id,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 actor_id uuid references auth.users, task_id uuid, action text not null,
 metadata jsonb not null default '{}', occurred_at timestamptz not null default now(),
 foreign key(organization_id,task_id) references public.tasks(organization_id,id)
); -- append-only through trusted API; redact secrets and sensitive source data

-- Helper functions use a pinned search_path and no dynamic SQL. Membership changes
-- are restricted to trusted server operations, not client self-assignment.
create function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid())
$$;
create function public.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.role='admin')
$$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_member(uuid), public.is_org_admin(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
create policy org_read on public.organizations for select to authenticated using(public.is_org_member(id));
create policy membership_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.is_org_admin(organization_id));
alter table public.agents enable row level security;
create policy agent_read on public.agents for select to authenticated using(public.is_org_member(organization_id));
-- Configuration writes go through the API to atomically version config and audit.
alter table public.agent_revisions enable row level security;
create policy revision_read on public.agent_revisions for select to authenticated using(public.is_org_admin(organization_id));
alter table public.tasks enable row level security;
create policy task_read on public.tasks for select to authenticated using(public.is_org_member(organization_id) and (requester_id=auth.uid() or public.is_org_admin(organization_id)));
alter table public.drafts enable row level security;
alter table public.reviews enable row level security;
alter table public.artifacts enable row level security;
alter table public.connections enable row level security;
alter table public.data_sources enable row level security;
alter table public.audit_events enable row level security;
-- No client policies on sensitive tables: serve authorized filtered reads via API.
-- Private storage buckets must also have RLS; no public artifact buckets.
create index tasks_org_created on public.tasks(organization_id,created_at desc);
create index tasks_agent_status on public.tasks(organization_id,agent_id,status);
create index audit_org_time on public.audit_events(organization_id,occurred_at desc);
