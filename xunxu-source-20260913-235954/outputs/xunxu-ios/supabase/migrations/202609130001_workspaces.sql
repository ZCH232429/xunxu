-- Run once in your Supabase project's SQL Editor.
create table public.workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version integer not null default 1 check(version > 0),
 state jsonb not null check(jsonb_typeof(state)='object'),
 updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create policy own_workspace_read on public.workspaces for select to authenticated using(user_id=(select auth.uid()));
-- Writes are only allowed through the version-checked function below.
revoke all on public.workspaces from anon,authenticated;
grant select on public.workspaces to authenticated;

create function public.save_workspace(expected_version integer,new_state jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare next_version integer; current_user_id uuid := auth.uid();
begin
 if current_user_id is null then raise exception 'authentication_required'; end if;
 if expected_version is null or expected_version<0 or new_state is null
    or jsonb_typeof(new_state)<>'object' or octet_length(new_state::text)>20000000 then
   raise exception 'invalid_workspace';
 end if;
 if expected_version=0 then
   insert into public.workspaces(user_id,version,state) values(current_user_id,1,new_state)
   on conflict(user_id) do nothing returning version into next_version;
 else
   update public.workspaces set state=new_state,version=version+1,updated_at=now()
   where user_id=current_user_id and version=expected_version returning version into next_version;
 end if;
 if next_version is null then raise exception 'version_conflict'; end if;
 return next_version;
end;
$$;
revoke all on function public.save_workspace(integer,jsonb) from public,anon;
grant execute on function public.save_workspace(integer,jsonb) to authenticated;
