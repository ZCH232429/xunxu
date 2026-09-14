import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
try{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${a}'),('${b}');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202609130001_workspaces.sql',import.meta.url),'utf8'));
 const asUser=async id=>{await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 const save=(version,state)=>db.query('select public.save_workspace($1,$2::jsonb) as version',[version,JSON.stringify(state)]);
 await asUser(a);assert.equal((await save(0,{name:'A'})).rows[0].version,1);
 await assert.rejects(save(0,{name:'overwrite'}),/version_conflict/);
 await asUser(b);assert.equal((await db.query('select * from public.workspaces')).rows.length,0);
 await save(0,{name:'B'});assert.equal((await db.query('select * from public.workspaces')).rows[0].user_id,b);
 await assert.rejects(db.query('update public.workspaces set state=$1 where user_id=$2',['{}',a]),/permission denied/);
 await asUser(a);assert.equal((await save(1,{name:'A2'})).rows[0].version,2);
 await assert.rejects(save(1,{name:'stale'}),/version_conflict/);
 assert.equal((await db.query('select state from public.workspaces')).rows[0].state.name,'A2');
 await assert.rejects(save(2,[]),/invalid_workspace/);
 await asUser('');await assert.rejects(save(0,{}),/authentication_required/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.workspaces'),/permission denied/);
 await assert.rejects(save(0,{}),/permission denied/);
 console.log('PASS: account isolation, anonymous denial, RPC-only writes, version conflicts, invalid payloads. Local PostgreSQL-compatible test; live Supabase verification still required.');
}finally{await db.close()}
