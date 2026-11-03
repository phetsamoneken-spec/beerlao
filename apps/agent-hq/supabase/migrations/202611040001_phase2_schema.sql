-- DRAFT: apply only to an approved empty/local Supabase database. No production execution authorized.
-- docs/schema.sql is the earlier design, NOT a migration to run alongside these files.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 160),created_at timestamptz not null default now());

create table public.memberships(organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),role text not null check(role in ('admin','manager','member')),department text not null check(length(department) between 1 and 100),active boolean not null default true,created_at timestamptz not null default now(),primary key(organization_id,user_id));

create table public.agents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),department text not null check(length(department) between 1 and 100),name text not null,kind text not null check(kind in ('ceo','budget','baf','sales','marketing','custom')),active boolean not null default true,configuration jsonb not null check(jsonb_typeof(configuration)='object' and octet_length(configuration::text)<=65536),revision integer not null default 1 check(revision>0),created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,id,department));

create table public.agent_revisions(organization_id uuid not null,agent_id uuid not null,revision integer not null check(revision>0),department text not null,configuration jsonb not null,kind text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(organization_id,agent_id,revision),unique(organization_id,agent_id,revision,department),foreign key(organization_id,agent_id,department) references public.agents(organization_id,id,department));

create table public.tasks(id uuid primary key default gen_random_uuid(),organization_id uuid not null,department text not null,agent_id uuid not null,agent_revision integer not null,requester_id uuid not null references auth.users(id),title text not null check(length(title) between 1 and 240),inputs jsonb not null check(jsonb_typeof(inputs)='object' and octet_length(inputs::text)<=131072),status text not null default 'New' check(status in ('New','Waiting for information','In progress','Draft ready','Awaiting approval','Approved','Rejected','Completed','Failed')),current_draft_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,agent_id,agent_revision,department) references public.agent_revisions(organization_id,agent_id,revision,department));

create table public.ai_runs(id uuid primary key default gen_random_uuid(),organization_id uuid not null,task_id uuid not null,requested_by uuid not null references auth.users(id),request_key uuid not null,status text not null check(status in ('running','succeeded','failed')),provider text not null default 'openai',model text,error_code text,started_at timestamptz not null default now(),finished_at timestamptz,unique(organization_id,id),unique(organization_id,task_id,request_key),foreign key(organization_id,task_id) references public.tasks(organization_id,id));
create unique index one_active_ai_run on public.ai_runs(organization_id,task_id) where status='running';

create table public.drafts(id uuid primary key default gen_random_uuid(),organization_id uuid not null,task_id uuid not null,run_id uuid not null,revision integer not null check(revision>0),content text not null check(octet_length(content)<=65536),content_hash text not null,provenance jsonb not null,created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,task_id,revision),unique(organization_id,run_id),foreign key(organization_id,task_id) references public.tasks(organization_id,id),foreign key(organization_id,run_id) references public.ai_runs(organization_id,id));
alter table public.tasks add foreign key(organization_id,current_draft_id) references public.drafts(organization_id,id);

create table public.reviews(id uuid primary key default gen_random_uuid(),organization_id uuid not null,draft_id uuid not null,reviewer_id uuid not null references auth.users(id),content_hash text not null,decision text not null check(decision in ('approved','rejected')),reason text not null default '' check(length(reason)<=2000),created_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,draft_id) references public.drafts(organization_id,id));

create table public.artifacts(id uuid primary key default gen_random_uuid(),organization_id uuid not null,task_id uuid not null,draft_id uuid not null,review_id uuid not null,format text not null check(format='txt'),content_hash text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,draft_id,format),foreign key(organization_id,task_id) references public.tasks(organization_id,id),foreign key(organization_id,draft_id) references public.drafts(organization_id,id),foreign key(organization_id,review_id) references public.reviews(organization_id,id));

create table public.connections(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),department text not null,provider text not null check(provider='google'),account_label text not null,granted_scopes text[] not null default '{}',revoked_at timestamptz,created_at timestamptz not null default now(),unique(organization_id,id,department));

create table public.data_sources(id uuid primary key default gen_random_uuid(),organization_id uuid not null,department text not null,connection_id uuid not null,agent_id uuid not null,source_type text not null check(source_type in ('drive_file','drive_folder','sheet')),source_reference text not null,allowed_ranges jsonb not null default '[]',field_mapping jsonb not null default '{}',foreign key(organization_id,connection_id,department) references public.connections(organization_id,id,department),foreign key(organization_id,agent_id,department) references public.agents(organization_id,id,department));

create table public.audit_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),department text not null,actor_id uuid not null references auth.users(id),task_id uuid,action text not null,metadata jsonb not null default '{}',occurred_at timestamptz not null default now(),foreign key(organization_id,task_id) references public.tasks(organization_id,id));
-- Server-only foundations; no plaintext Google tokens or browser-readable credentials.

create table private.google_tokens(connection_id uuid primary key,encrypted_token bytea not null,key_version integer not null,expires_at timestamptz not null);

create table private.request_limits(user_id uuid not null,action text not null,window_start timestamptz not null,count integer not null,primary key(user_id,action,window_start));
revoke all on all tables in schema private from public,anon,authenticated;

create function private.role_in(org uuid) returns text language sql stable security definer set search_path='' as $$
select role from public.memberships where organization_id=org and user_id=auth.uid() and active and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)$$;

create function private.department_access(org uuid,dept text) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid() and active and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) and (role='admin' or department=dept))$$;

create function private.task_access(org uuid,tid uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.tasks t join public.memberships m on m.organization_id=t.organization_id and m.user_id=auth.uid() and m.active where t.organization_id=org and t.id=tid and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) and (m.role='admin' or (m.department=t.department and (m.role='manager' or t.requester_id=m.user_id))))$$;
revoke all on function private.role_in(uuid),private.department_access(uuid,text),private.task_access(uuid,uuid) from public,anon;
grant execute on function private.role_in(uuid),private.department_access(uuid,text),private.task_access(uuid,uuid) to authenticated;
-- Only SELECT is granted to the browser. All writes use narrow audited RPCs.
do $$declare tab text;
begin foreach tab in array array['organizations','memberships','agents','agent_revisions','tasks','ai_runs','drafts','reviews','artifacts','connections','data_sources','audit_events'] loop execute format('alter table public.%I enable row level security',tab);
execute format('revoke all on public.%I from public, anon, authenticated',tab);
execute format('grant select on public.%I to authenticated',tab);
end loop;
end$$;

create policy organizations_read on public.organizations for select to authenticated using(private.role_in(id) is not null);

create policy memberships_read on public.memberships for select to authenticated using((user_id=auth.uid() and private.role_in(organization_id) is not null) or private.role_in(organization_id)='admin');

create policy agents_read on public.agents for select to authenticated using(private.department_access(organization_id,department));

create policy revisions_read on public.agent_revisions for select to authenticated using(private.department_access(organization_id,department));

create policy tasks_read on public.tasks for select to authenticated using(private.task_access(organization_id,id));

create policy runs_read on public.ai_runs for select to authenticated using(private.task_access(organization_id,task_id));

create policy drafts_read on public.drafts for select to authenticated using(private.task_access(organization_id,task_id));

create policy reviews_read on public.reviews for select to authenticated using(exists(select 1 from public.drafts d where d.organization_id=reviews.organization_id and d.id=reviews.draft_id and private.task_access(d.organization_id,d.task_id)));

create policy artifacts_read on public.artifacts for select to authenticated using(private.task_access(organization_id,task_id));

create policy connections_read on public.connections for select to authenticated using(private.role_in(organization_id) in ('admin','manager') and private.department_access(organization_id,department));

create policy sources_read on public.data_sources for select to authenticated using(private.department_access(organization_id,department));

create policy audit_read on public.audit_events for select to authenticated using(private.role_in(organization_id)='admin' or (private.role_in(organization_id)='manager' and private.department_access(organization_id,department)));

create function private.immutable_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'IMMUTABLE_RECORD';
end$$;
do $$declare tab text;
begin foreach tab in array array['agent_revisions','drafts','reviews','artifacts','audit_events'] loop execute format('create trigger immutable before update or delete on public.%I for each row execute function private.immutable_record()',tab);
end loop;
end$$;
create index tasks_tenant_recent on public.tasks(organization_id,department,created_at desc);
create index audit_tenant_recent on public.audit_events(organization_id,department,occurred_at desc);
create index runs_tenant_status on public.ai_runs(organization_id,status);
commit;
