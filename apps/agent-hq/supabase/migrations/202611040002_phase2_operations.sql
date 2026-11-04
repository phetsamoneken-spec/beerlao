-- DRAFT RPCs. Mutations are checked here even when called directly without the Edge Function.
begin;

create function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'UNAUTHENTICATED';
end if;
return uid;
end$$;

create function private.rate_limit(action_name text,max_count integer) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
win timestamptz:=date_trunc('minute',now());
n integer;
begin perform pg_advisory_xact_lock(hashtextextended(uid::text||action_name,0));
select count into n from private.request_limits where user_id=uid and action=action_name and window_start=win;
if coalesce(n,0)>=max_count then raise exception 'RATE_LIMITED';
end if;
insert into private.request_limits values(uid,action_name,win,1) on conflict(user_id,action,window_start) do update set count=private.request_limits.count+1;
end$$;

create function public.create_organization(org_name text,dept text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
org uuid;
begin if coalesce(length(org_name),0) not between 1 and 160 or coalesce(length(dept),0) not between 1 and 100 then raise exception 'INVALID_INPUT';
end if;
perform private.rate_limit('organization',2);
insert into public.organizations(name) values(org_name) returning id into org;
insert into public.memberships(organization_id,user_id,role,department) values(org,uid,'admin',dept);
insert into public.audit_events(organization_id,department,actor_id,action) values(org,dept,uid,'organization.created');
return org;
end$$;

create function public.set_membership(org uuid,target_user uuid,new_role text,dept text,is_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
old public.memberships;
begin perform pg_advisory_xact_lock(hashtextextended(org::text,1));
if private.role_in(org) is distinct from 'admin' then raise exception 'FORBIDDEN';
end if;
if new_role is null or new_role not in ('admin','manager','member') or is_active is null or coalesce(length(dept),0) not between 1 and 100 then raise exception 'INVALID_INPUT';
end if;
select * into old from public.memberships where organization_id=org and user_id=target_user;
if old.role='admin' and old.active and (not is_active or new_role<>'admin') and (select count(*) from public.memberships where organization_id=org and role='admin' and active)<=1 then raise exception 'LAST_ADMIN';
end if;
perform private.rate_limit('write',60);
insert into public.memberships(organization_id,user_id,role,department,active) values(org,target_user,new_role,dept,is_active) on conflict(organization_id,user_id) do update set role=excluded.role,department=excluded.department,active=excluded.active;
insert into public.audit_events(organization_id,department,actor_id,action,metadata) values(org,dept,uid,'membership.updated',jsonb_build_object('user_id',target_user,'role',new_role,'active',is_active));
end$$;

-- The Edge validator is not the only entry point: authenticated clients can call
-- these RPCs through PostgREST. Validate stored configuration here as well.
create function private.validate_agent_configuration(config jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  spec record;
  value text;
  item jsonb;
begin
  if jsonb_typeof(config) is distinct from 'object' or octet_length(config::text)>65536 then
    raise exception 'INVALID_INPUT';
  end if;
  if exists(select 1 from jsonb_object_keys(config) as keys(name) where name<>all(array[
    'id','name','title','department','color','avatar','active','description','prompt',
    'responsibilities','allowedTasks','restrictedTasks','workflow','requirements',
    'language','folder','files','spreadsheet','tabs','ranges','templates',
    'additionalSources','formats','permissions','access','fields'
  ])) then raise exception 'INVALID_INPUT';end if;
  for spec in select * from (values
    ('id',100,false),('name',100,true),('title',160,true),('department',100,true),
    ('color',7,false),('avatar',20,false),('description',2000,false),('prompt',12000,true),
    ('responsibilities',6000,false),('allowedTasks',4000,false),('restrictedTasks',4000,false),
    ('workflow',6000,false),('requirements',6000,false),('language',7,false),
    ('folder',1000,false),('files',4000,false),('spreadsheet',1000,false),('tabs',1000,false),
    ('ranges',1000,false),('templates',4000,false),('additionalSources',4000,false),
    ('access',2000,false),('fields',2000,false)
  ) as limits(field_name,max_length,required_text) loop
    if jsonb_typeof(config->spec.field_name) is distinct from 'string' then
      raise exception 'INVALID_INPUT';
    end if;
    value:=config->>spec.field_name;
    if spec.required_text then
      value:=btrim(value,E' \t\n\r\f\013');
      if length(value)=0 then raise exception 'INVALID_INPUT';end if;
      config:=jsonb_set(config,array[spec.field_name],to_jsonb(value));
    end if;
    if length(value)>spec.max_length then raise exception 'INVALID_INPUT';end if;
  end loop;
  if jsonb_typeof(config->'active') is distinct from 'boolean'
     or (config->>'color')!~'^#[0-9a-fA-F]{6}$'
     or config->>'avatar' not in ('robot','orb','capsule','chibi-mint','chibi-violet','chibi-amber')
     or config->>'language' not in ('Lao','Thai','English') then
    raise exception 'INVALID_INPUT';
  end if;
  if jsonb_typeof(config->'formats') is distinct from 'array'
     or jsonb_typeof(config->'permissions') is distinct from 'array' then
    raise exception 'INVALID_INPUT';
  end if;
  if jsonb_array_length(config->'formats')>10 or jsonb_array_length(config->'permissions')>5 then
    raise exception 'INVALID_INPUT';
  end if;
  for item in select * from jsonb_array_elements(config->'formats') loop
    if jsonb_typeof(item)<>'string' or length(item#>>'{}')>80 then raise exception 'INVALID_INPUT';end if;
  end loop;
  for item in select * from jsonb_array_elements(config->'permissions') loop
    if jsonb_typeof(item)<>'string' or item#>>'{}' not in (
      'Read data','Generate drafts','Export documents','Save approved documents','Request human approval'
    ) then raise exception 'INVALID_INPUT';end if;
  end loop;
  return config;
end$$;

create function private.validate_task_inputs(inputs jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(inputs) is distinct from 'object' or octet_length(inputs::text)>65536 then
    raise exception 'INVALID_INPUT';
  end if;
  if exists(select 1 from jsonb_object_keys(inputs) as keys(name) where length(name)>200) then
    raise exception 'INVALID_INPUT';
  end if;
end$$;

create function public.save_agent(org uuid,agent uuid,expected_revision integer,agent_kind text,config jsonb) returns public.agents language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
row public.agents;
dept text:=config->>'department';
begin if private.role_in(org) is distinct from 'admin' then raise exception 'FORBIDDEN';
end if;
if agent_kind is null or agent_kind not in ('ceo','budget','baf','sales','marketing','custom')
  or (agent is null and expected_revision is not null) then raise exception 'INVALID_INPUT';end if;
config:=private.validate_agent_configuration(config);
dept:=config->>'department';
perform private.rate_limit('write',60);
if agent is null then insert into public.agents(organization_id,department,name,kind,active,configuration) values(org,dept,config->>'name',agent_kind,coalesce((config->>'active')::boolean,false),config) returning * into row;
else select * into row from public.agents where organization_id=org and id=agent for update;
if row.id is null then raise exception 'NOT_FOUND';
end if;
if row.revision is distinct from expected_revision then raise exception 'STALE_REVISION';
end if;
if row.department<>dept then raise exception 'DEPARTMENT_IMMUTABLE';
end if;
update public.agents set name=config->>'name',kind=agent_kind,active=coalesce((config->>'active')::boolean,false),configuration=config,revision=revision+1 where organization_id=org and id=agent returning * into row;
end if;
insert into public.agent_revisions(organization_id,agent_id,revision,department,configuration,kind,created_by) values(org,row.id,row.revision,dept,config,agent_kind,uid);
insert into public.audit_events(organization_id,department,actor_id,action,metadata) values(org,dept,uid,'agent.saved',jsonb_build_object('agent_id',row.id,'revision',row.revision));
return row;
end$$;

create function public.create_task(org uuid,agent uuid,task_title text,task_inputs jsonb) returns public.tasks language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
a public.agents;
t public.tasks;
begin select * into a from public.agents where organization_id=org and id=agent;
if a.id is null or not a.active or not private.department_access(org,a.department) then raise exception 'FORBIDDEN';
end if;
task_title:=btrim(task_title,E' \t\n\r\f\013');
if coalesce(length(task_title),0) not between 1 and 240 then raise exception 'INVALID_INPUT';end if;
perform private.validate_task_inputs(task_inputs);
perform private.rate_limit('task',20);
insert into public.tasks(organization_id,department,agent_id,agent_revision,requester_id,title,inputs) values(org,a.department,a.id,a.revision,uid,task_title,task_inputs) returning * into t;
insert into public.audit_events(organization_id,department,actor_id,task_id,action) values(org,a.department,uid,t.id,'task.created');
return t;
end$$;

create function public.route_limit(org uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_user();
if private.role_in(org) not in ('admin','manager') or private.role_in(org) is null then raise exception 'FORBIDDEN';
end if;
perform private.rate_limit('route',10);
insert into public.audit_events(organization_id,department,actor_id,action) select org,department,auth.uid(),'ceo.routing_requested' from public.memberships where organization_id=org and user_id=auth.uid();
end$$;

create function public.begin_ai_run(org uuid,tid uuid,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
t public.tasks;
r public.ai_runs;
a public.agents;
v public.agent_revisions;
missing jsonb;
begin if not private.task_access(org,tid) then raise exception 'FORBIDDEN';
end if;
if key is null then raise exception 'INVALID_INPUT';end if;
select * into t from public.tasks where organization_id=org and id=tid for update;
-- Reclaim only expired runs during an explicit retry. Never replay a provider call automatically.
if t.status='In progress' and exists(select 1 from public.ai_runs where organization_id=org and task_id=tid and status='running' and started_at<now()-interval '5 minutes') then
update public.ai_runs set status='failed',error_code='RUN_EXPIRED',finished_at=now() where organization_id=org and task_id=tid and status='running';
update public.tasks set status='Failed',updated_at=now() where organization_id=org and id=tid returning * into t;
insert into public.audit_events(organization_id,department,actor_id,task_id,action) values(org,t.department,uid,tid,'ai.expired');
end if;
select * into r from public.ai_runs where organization_id=org and task_id=tid and request_key=key;
if r.id is not null then return jsonb_build_object('created',false,'run',to_jsonb(r));
end if;
if t.status in ('In progress','Awaiting approval','Approved','Completed') then raise exception 'INVALID_TRANSITION';
end if;
select * into a from public.agents where organization_id=org and id=t.agent_id;
if not a.active or not (a.configuration->'permissions' ? 'Generate drafts') then raise exception 'FORBIDDEN';
end if;
select * into v from public.agent_revisions where organization_id=org and agent_id=t.agent_id and revision=t.agent_revision;
select coalesce(jsonb_agg(field),'[]') into missing from (select btrim(x) field from unnest(string_to_array(coalesce(v.configuration->>'fields',''),',')) x) f where field<>'' and (not (t.inputs ? field) or t.inputs->field='null'::jsonb or btrim(coalesce(t.inputs->>field,''))='');
if jsonb_array_length(missing)>0 then update public.tasks set status='Waiting for information',updated_at=now() where id=tid and organization_id=org;
return jsonb_build_object('created',false,'missing',missing);
end if;
perform private.rate_limit('execute',5);
insert into public.ai_runs(organization_id,task_id,requested_by,request_key,status) values(org,tid,uid,key,'running') returning * into r;
update public.tasks set status='In progress',updated_at=now() where id=tid and organization_id=org;
insert into public.audit_events(organization_id,department,actor_id,task_id,action,metadata) values(org,t.department,uid,tid,'ai.started',jsonb_build_object('run_id',r.id));
return jsonb_build_object('created',true,'run',to_jsonb(r),'task',to_jsonb(t),'configuration',v.configuration,'kind',v.kind);
end$$;

create function public.update_task_inputs(org uuid,tid uuid,new_inputs jsonb) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;
uid uuid:=private.require_user();
begin if not private.task_access(org,tid) then raise exception 'FORBIDDEN';
end if;
select * into t from public.tasks where organization_id=org and id=tid for update;
if t.status in ('In progress','Approved','Completed') then raise exception 'INVALID_TRANSITION';
end if;
perform private.validate_task_inputs(new_inputs);
perform private.rate_limit('write',60);
update public.tasks set inputs=new_inputs,status='New',current_draft_id=null,updated_at=now() where organization_id=org and id=tid;
insert into public.audit_events(organization_id,department,actor_id,task_id,action) values(org,t.department,uid,tid,'task.inputs_updated');
end$$;
-- Only the Edge Function's service client may record an inference result.

create function public.finish_ai_run(run uuid,model_name text,result_content text,provenance_data jsonb,failure_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.ai_runs;
t public.tasks;
draft uuid;
rev integer;
allowed boolean;
begin select * into r from public.ai_runs where id=run;
if r.id is null then raise exception 'NOT_FOUND';
end if;
select * into t from public.tasks where organization_id=r.organization_id and id=r.task_id for update;
select * into r from public.ai_runs where id=run for update;
if r.status<>'running' then raise exception 'INVALID_TRANSITION';
end if;
select exists(select 1 from public.memberships m where m.organization_id=t.organization_id and m.user_id=r.requested_by and m.active and exists(select 1 from auth.users u where u.id=m.user_id and u.email_confirmed_at is not null) and (m.role='admin' or (m.department=t.department and (m.role='manager' or t.requester_id=m.user_id)))) into allowed;
if not allowed or not exists(select 1 from public.agents a where a.organization_id=t.organization_id and a.id=t.agent_id and a.active and a.configuration->'permissions' ? 'Generate drafts') then failure_code:='AUTHORIZATION_REVOKED';
end if;
if t.status<>'In progress' then raise exception 'INVALID_TRANSITION';
end if;
if failure_code is null then if result_content is null or length(result_content)=0 or octet_length(result_content)>65536 then raise exception 'INVALID_OUTPUT';
end if;
select coalesce(max(revision),0)+1 into rev from public.drafts where organization_id=t.organization_id and task_id=t.id;
insert into public.drafts(organization_id,task_id,run_id,revision,content,content_hash,provenance) values(t.organization_id,t.id,r.id,rev,result_content,encode(sha256(convert_to(result_content,'UTF8')),'hex'),provenance_data) returning id into draft;
update public.tasks set status='Draft ready',current_draft_id=draft,updated_at=now() where id=t.id;
else update public.tasks set status=case when failure_code in ('NEEDS_INFORMATION','OFFICIAL_TEMPLATE_REQUIRED','INVALID_BUDGET_AMOUNT','INVALID_SALES_ROWS','INVALID_SALES_PRECISION') then 'Waiting for information' else 'Failed' end,updated_at=now() where id=t.id;
end if;
update public.ai_runs set status=case when failure_code is null then 'succeeded' else 'failed' end,model=model_name,error_code=failure_code,finished_at=now() where id=run;
insert into public.audit_events(organization_id,department,actor_id,task_id,action,metadata) values(t.organization_id,t.department,r.requested_by,t.id,case when failure_code is null then 'ai.succeeded' else 'ai.failed' end,jsonb_build_object('run_id',run,'error_code',failure_code));
return draft;
end$$;

create function public.submit_review(org uuid,tid uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;
uid uuid:=private.require_user();
begin if not private.task_access(org,tid) then raise exception 'FORBIDDEN';
end if;
select * into t from public.tasks where organization_id=org and id=tid for update;
if t.status<>'Draft ready' or t.current_draft_id is null then raise exception 'INVALID_TRANSITION';
end if;
perform private.rate_limit('write',60);
update public.tasks set status='Awaiting approval',updated_at=now() where id=tid;
insert into public.audit_events(organization_id,department,actor_id,task_id,action) values(org,t.department,uid,tid,'review.requested');
end$$;

create function public.review_draft(org uuid,tid uuid,draft uuid,expected_hash text,decision_value text,reason_value text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
t public.tasks;
d public.drafts;
rid uuid;
begin if private.role_in(org) is null or private.role_in(org) not in ('admin','manager') or not private.task_access(org,tid) then raise exception 'FORBIDDEN';
end if;
select * into t from public.tasks where organization_id=org and id=tid for update;
select * into d from public.drafts where organization_id=org and id=draft and task_id=tid;
if t.status<>'Awaiting approval' or t.current_draft_id is distinct from draft or d.content_hash is distinct from expected_hash then raise exception 'STALE_REVIEW';
end if;
if decision_value is null or decision_value not in ('approved','rejected') or reason_value is null or length(reason_value)>2000 or (decision_value='rejected' and btrim(reason_value,E' \t\n\r\f\013')='') then raise exception 'INVALID_INPUT';
end if;
perform private.rate_limit('write',60);
insert into public.reviews(organization_id,draft_id,reviewer_id,content_hash,decision,reason) values(org,draft,uid,expected_hash,decision_value,reason_value) returning id into rid;
update public.tasks set status=case when decision_value='approved' then 'Approved' else 'Rejected' end,updated_at=now() where id=tid;
insert into public.audit_events(organization_id,department,actor_id,task_id,action,metadata) values(org,t.department,uid,tid,'review.'||decision_value,jsonb_build_object('review_id',rid,'draft_id',draft));
return rid;
end$$;

create function public.export_approved(org uuid,tid uuid,expected_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_user();
t public.tasks;
d public.drafts;
r public.reviews;
a public.artifacts;
begin if not private.task_access(org,tid) then raise exception 'FORBIDDEN';
end if;
select * into t from public.tasks where organization_id=org and id=tid for update;
select * into d from public.drafts where organization_id=org and id=t.current_draft_id;
select * into r from public.reviews where organization_id=org and draft_id=d.id order by created_at desc limit 1;
if t.status not in ('Approved','Completed') or r.decision is distinct from 'approved' or r.content_hash is distinct from expected_hash or d.content_hash is distinct from expected_hash then raise exception 'APPROVAL_REQUIRED';
end if;
if not exists(select 1 from public.agents x where x.organization_id=org and x.id=t.agent_id and x.active and x.configuration->'permissions' ? 'Export documents') then raise exception 'FORBIDDEN';
end if;
perform private.rate_limit('write',60);
insert into public.artifacts(organization_id,task_id,draft_id,review_id,format,content_hash,created_by) values(org,tid,d.id,r.id,'txt',d.content_hash,uid) on conflict(organization_id,draft_id,format) do nothing;
select * into a from public.artifacts where organization_id=org and draft_id=d.id and format='txt';
update public.tasks set status='Completed',updated_at=now() where id=tid;
insert into public.audit_events(organization_id,department,actor_id,task_id,action,metadata) values(org,t.department,uid,tid,'artifact.exported',jsonb_build_object('artifact_id',a.id));
return jsonb_build_object('artifact',to_jsonb(a),'content',d.content,'title',t.title);
end$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.role_in(uuid),private.department_access(uuid,text),private.task_access(uuid,uuid) to authenticated;
revoke all on function public.create_organization(text,text),public.set_membership(uuid,uuid,text,text,boolean),public.save_agent(uuid,uuid,integer,text,jsonb),public.create_task(uuid,uuid,text,jsonb),public.route_limit(uuid),public.begin_ai_run(uuid,uuid,uuid),public.update_task_inputs(uuid,uuid,jsonb),public.submit_review(uuid,uuid),public.review_draft(uuid,uuid,uuid,text,text,text),public.export_approved(uuid,uuid,text) from public,anon;
grant execute on function public.create_organization(text,text),public.set_membership(uuid,uuid,text,text,boolean),public.save_agent(uuid,uuid,integer,text,jsonb),public.create_task(uuid,uuid,text,jsonb),public.route_limit(uuid),public.begin_ai_run(uuid,uuid,uuid),public.update_task_inputs(uuid,uuid,jsonb),public.submit_review(uuid,uuid),public.review_draft(uuid,uuid,uuid,text,text,text),public.export_approved(uuid,uuid,text) to authenticated;
revoke all on function public.finish_ai_run(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.finish_ai_run(uuid,text,text,jsonb,text) to service_role;
commit;
