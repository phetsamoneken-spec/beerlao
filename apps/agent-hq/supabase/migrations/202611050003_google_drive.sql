-- DRAFT: additive Drive OAuth/read integration. Review before live execution.
begin;
alter table private.google_tokens add constraint google_connection_fk foreign key(connection_id) references public.connections(id);
alter table private.google_tokens add column refresh_claim uuid;
alter table private.google_tokens add column refresh_until timestamptz;
alter table public.data_sources add column display_name text not null default '';
alter table public.data_sources add column mime_type text not null default '';
create table private.drive_attempts(
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id), session_id uuid not null, department text not null,
 state_hash text not null unique check(state_hash ~ '^[0-9a-f]{64}$'),
 verifier_cipher text, token_cipher text, account_label text, account_subject text,
 scopes text[], token_expires_at timestamptz,
 status text not null default 'pending' check(status in ('pending','exchanging','ready','completed','failed')),
 expires_at timestamptz not null default now()+interval '10 minutes', error_code text,
 created_at timestamptz not null default now()
);
revoke all on private.drive_attempts from public,anon,authenticated;

create function private.drive_require(actor uuid,org uuid,dept text) returns void
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id
 where m.organization_id=org and m.user_id=actor and m.active and u.email_confirmed_at is not null
 and (m.role='admin' or (m.role='manager' and m.department=dept))) then raise exception 'FORBIDDEN';end if;
end$$;
create function private.drive_limit(actor uuid,action_name text,max_count integer) returns void
language plpgsql security definer set search_path='' as $$declare win timestamptz:=date_trunc('minute',now());n integer;begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text||action_name,0));
 select count into n from private.request_limits where user_id=actor and action=action_name and window_start=win;
 if coalesce(n,0)>=max_count then raise exception 'RATE_LIMITED';end if;
 insert into private.request_limits values(actor,action_name,win,1) on conflict(user_id,action,window_start) do update set count=private.request_limits.count+1;
end$$;
create function public.drive_begin(actor uuid,sid uuid,org uuid,dept text,attempt uuid,state_digest text,verifier text) returns void
language plpgsql security definer set search_path='' as $$begin
 perform private.drive_require(actor,org,dept);perform private.drive_limit(actor,'drive.connect',5);
 if sid is null or attempt is null or dept is null or verifier is null or length(btrim(dept)) not between 1 and 100 or length(verifier) not between 20 and 4096 then raise exception 'INVALID_INPUT';end if;
 update private.drive_attempts set verifier_cipher=null,token_cipher=null,status='failed',error_code='OAUTH_EXPIRED' where expires_at<now() and status in ('pending','exchanging','ready');
 insert into private.drive_attempts(id,organization_id,actor_id,session_id,department,state_hash,verifier_cipher) values(attempt,org,actor,sid,dept,state_digest,verifier);
 insert into public.audit_events(organization_id,department,actor_id,action) values(org,dept,actor,'drive.connect_requested');
end$$;
create function public.drive_claim_callback(state_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$declare a private.drive_attempts;v text;begin
 select * into a from private.drive_attempts where state_hash=state_digest for update;
 if not found or a.expires_at<now() or a.status<>'pending' then raise exception 'OAUTH_STATE_INVALID';end if;
 perform private.drive_require(a.actor_id,a.organization_id,a.department);
 v:=a.verifier_cipher;
 update private.drive_attempts set status='exchanging',verifier_cipher=null where id=a.id;
 return jsonb_build_object('id',a.id,'organization_id',a.organization_id,'verifier_cipher',v);
end$$;
create function public.drive_complete_callback(attempt uuid,cipher text,label text,subject text,granted text[],expiry timestamptz,failure text) returns void
language plpgsql security definer set search_path='' as $$declare a private.drive_attempts;begin
 select * into a from private.drive_attempts where id=attempt for update;
 if not found or a.status<>'exchanging' or a.expires_at<now() then raise exception 'OAUTH_STATE_INVALID';end if;
 perform private.drive_require(a.actor_id,a.organization_id,a.department);
 if failure is null and (cipher is null or length(cipher)>32768 or label is null or length(label)>320 or subject is null or length(subject)>255 or expiry is null or expiry<=now() or granted is null or not ('https://www.googleapis.com/auth/drive.readonly'=any(granted))) then raise exception 'INVALID_INPUT';end if;
 update private.drive_attempts set status=case when failure is null then 'ready' else 'failed' end,token_cipher=case when failure is null then cipher end,account_label=label,account_subject=subject,scopes=granted,token_expires_at=expiry,error_code=case when failure is not null then 'OAUTH_FAILED' end where id=attempt;
end$$;
create function public.drive_status(actor uuid,sid uuid,org uuid,attempt uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare a private.drive_attempts;begin
 select * into a from private.drive_attempts where id=attempt and actor_id=actor and session_id=sid and organization_id=org;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.drive_require(actor,a.organization_id,a.department);
 return jsonb_build_object('id',a.id,'status',case when a.expires_at<now() and a.status<>'completed' then 'expired' else a.status end,'account_label',a.account_label);
end$$;
create function public.drive_activate(actor uuid,sid uuid,org uuid,attempt uuid) returns uuid
language plpgsql security definer set search_path='' as $$declare a private.drive_attempts;begin
 select * into a from private.drive_attempts where id=attempt and actor_id=actor and session_id=sid and organization_id=org for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.drive_require(actor,a.organization_id,a.department);
 if a.status='completed' then return a.id;end if;
 if a.status<>'ready' or a.expires_at<now() or a.token_expires_at<=now() then raise exception 'OAUTH_STATE_INVALID';end if;
 insert into public.connections(id,organization_id,department,provider,account_label,granted_scopes) values(a.id,a.organization_id,a.department,'google',a.account_label,a.scopes);
 insert into private.google_tokens(connection_id,encrypted_token,key_version,expires_at) values(a.id,convert_to(a.token_cipher,'UTF8'),1,a.token_expires_at);
 update private.drive_attempts set status='completed',token_cipher=null,verifier_cipher=null where id=a.id;
 insert into public.audit_events(organization_id,department,actor_id,action,metadata) values(a.organization_id,a.department,actor,'drive.connected',jsonb_build_object('connection_id',a.id));
 return a.id;
end$$;
create function public.drive_connection_context(actor uuid,org uuid,connection uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare c public.connections;t private.google_tokens;begin
 select * into c from public.connections where id=connection and organization_id=org;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.drive_require(actor,org,c.department);perform private.drive_limit(actor,'drive.read',20);
 if c.revoked_at is not null then raise exception 'DRIVE_DISCONNECTED';end if;
 select * into t from private.google_tokens where connection_id=c.id;
 if not found then raise exception 'DRIVE_DISCONNECTED';end if;
 return jsonb_build_object('id',c.id,'organization_id',org,'department',c.department,'cipher',convert_from(t.encrypted_token,'UTF8'),'expires_at',t.expires_at);
end$$;
create function public.drive_claim_refresh(connection uuid,claim uuid) returns boolean
language plpgsql security definer set search_path='' as $$begin
 if claim is null then raise exception 'INVALID_INPUT';end if;
 update private.google_tokens t set refresh_claim=claim,refresh_until=now()+interval '60 seconds' where t.connection_id=connection and (t.refresh_until is null or t.refresh_until<now()) and exists(select 1 from public.connections c where c.id=connection and c.revoked_at is null);
 return found;
end$$;
create function public.drive_store_refresh(connection uuid,claim uuid,cipher text,expiry timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$begin
 if cipher is null or length(cipher)>32768 or expiry is null or expiry<=now() then raise exception 'INVALID_INPUT';end if;
 update private.google_tokens t set encrypted_token=convert_to(cipher,'UTF8'),expires_at=expiry,refresh_claim=null,refresh_until=null where t.connection_id=connection and t.refresh_claim=claim and t.refresh_until>now() and exists(select 1 from public.connections c where c.id=connection and c.revoked_at is null);
 return found;
end$$;
create function public.drive_release_refresh(connection uuid,claim uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 update private.google_tokens set refresh_claim=null,refresh_until=null where connection_id=connection and refresh_claim=claim;
end$$;
create function public.drive_add_source(actor uuid,org uuid,connection uuid,agent uuid,file_id text,file_name text,file_mime text) returns uuid
language plpgsql security definer set search_path='' as $$declare c public.connections;a public.agents;source uuid;begin
 select * into c from public.connections where id=connection and organization_id=org and revoked_at is null for update;
 if not found then raise exception 'DRIVE_DISCONNECTED';end if;
 perform private.drive_require(actor,org,c.department);
 select * into a from public.agents where organization_id=org and id=agent and department=c.department and active;
 if not found or not (a.configuration->'permissions' ? 'Read data') then raise exception 'FORBIDDEN';end if;
 if file_id is null or file_id !~ '^[A-Za-z0-9_-]{10,200}$' or file_name is null or length(file_name)>500 or file_mime is null or file_mime not in ('text/plain','text/csv','application/vnd.google-apps.document') then raise exception 'INVALID_INPUT';end if;
 select id into source from public.data_sources where organization_id=org and connection_id=connection and agent_id=agent and source_reference=file_id;
 if source is null then
 insert into public.data_sources(organization_id,department,connection_id,agent_id,source_type,source_reference,display_name,mime_type) values(org,c.department,connection,agent,'drive_file',file_id,file_name,file_mime) returning id into source;
 insert into public.audit_events(organization_id,department,actor_id,action,metadata) values(org,c.department,actor,'drive.source_approved',jsonb_build_object('source_id',source,'agent_id',agent));end if;
 return source;
end$$;
create function public.drive_read_context(actor uuid,org uuid,source uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare s public.data_sources;result jsonb;begin
 select * into s from public.data_sources where id=source and organization_id=org and source_type='drive_file';
 if not found then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from public.agents a where a.id=s.agent_id and a.organization_id=org and a.department=s.department and a.active and a.configuration->'permissions' ? 'Read data') then raise exception 'FORBIDDEN';end if;
 result:=public.drive_connection_context(actor,org,s.connection_id);
 return result||jsonb_build_object('file_id',s.source_reference,'source_id',s.id,'mime_type',s.mime_type);
end$$;
create function public.drive_finish_read(actor uuid,org uuid,source uuid,checksum text,byte_count integer) returns void
language plpgsql security definer set search_path='' as $$declare s public.data_sources;begin
 perform public.drive_read_context(actor,org,source);
 if checksum is null or checksum !~ '^[0-9a-f]{64}$' or byte_count is null or byte_count not between 0 and 1048576 then raise exception 'INVALID_INPUT';end if;
 select * into s from public.data_sources where id=source and organization_id=org;
 insert into public.audit_events(organization_id,department,actor_id,action,metadata) values(org,s.department,actor,'drive.file_read',jsonb_build_object('source_id',source,'sha256',checksum,'bytes',byte_count));
end$$;
create function public.drive_disconnect(actor uuid,org uuid,connection uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare c public.connections;cipher text;begin
 select * into c from public.connections where id=connection and organization_id=org for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.drive_require(actor,org,c.department);
 select convert_from(encrypted_token,'UTF8') into cipher from private.google_tokens where connection_id=connection;
 update public.connections set revoked_at=coalesce(revoked_at,now()) where id=connection;
 delete from private.google_tokens where connection_id=connection;
 insert into public.audit_events(organization_id,department,actor_id,action,metadata) values(org,c.department,actor,'drive.disconnected',jsonb_build_object('connection_id',connection));
 return jsonb_build_object('id',c.id,'organization_id',org,'cipher',cipher);
end$$;

revoke all on function private.drive_require(uuid,uuid,text),private.drive_limit(uuid,text,integer) from public,anon,authenticated;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'drive\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end$$;
commit;
