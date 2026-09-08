-- Minimal pgTAP-compatible shim for running supabase/tests/*.sql against a
-- plain Postgres without the pgtap extension. Failures raise immediately.
-- On Supabase local (`supabase test db`) the real pgTAP is used instead.
create schema if not exists extensions;

create or replace function extensions.plan(n int) returns text language sql as $$ select '1..' || n $$;
create or replace function extensions.finish() returns setof text language sql as $$ select ''::text where false $$;

create or replace function extensions.ok(p_ok boolean, p_desc text default '') returns text
language plpgsql as $$
begin
  if coalesce(p_ok, false) then return 'ok - ' || p_desc; end if;
  raise exception 'not ok - %', p_desc;
end $$;

create or replace function extensions.is(p_have anyelement, p_want anyelement, p_desc text default '') returns text
language plpgsql as $$
begin
  if p_have is not distinct from p_want then return 'ok - ' || p_desc; end if;
  raise exception 'not ok - % (have: %, want: %)', p_desc, p_have, p_want;
end $$;

create or replace function extensions.isnt(p_have anyelement, p_want anyelement, p_desc text default '') returns text
language plpgsql as $$
begin
  if p_have is distinct from p_want then return 'ok - ' || p_desc; end if;
  raise exception 'not ok - % (both: %)', p_desc, p_have;
end $$;

create or replace function extensions.throws_ok(p_sql text, p_errcode text default null, p_ermsg text default null, p_desc text default '') returns text
language plpgsql as $$
declare v_code text; v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text;
    if p_errcode is not null and v_code <> p_errcode then
      raise exception 'not ok - % (threw % "%", wanted %)', p_desc, v_code, v_msg, p_errcode;
    end if;
    if p_ermsg is not null and v_msg <> p_ermsg then
      raise exception 'not ok - % (message "%", wanted "%")', p_desc, v_msg, p_ermsg;
    end if;
    return 'ok - ' || p_desc;
  end;
  raise exception 'not ok - % (no exception thrown)', p_desc;
end $$;

create or replace function extensions.lives_ok(p_sql text, p_desc text default '') returns text
language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    raise exception 'not ok - % (threw: %)', p_desc, v_msg;
  end;
  return 'ok - ' || p_desc;
end $$;

grant usage on schema extensions to public;
grant execute on all functions in schema extensions to public;
