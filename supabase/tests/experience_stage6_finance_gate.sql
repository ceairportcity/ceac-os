-- Experience Stage 6 gate: department-owned spending stays scoped and append-only.
\set ON_ERROR_STOP on

do $gate$
declare
  v_policy text;
  v_def text;
begin
  select coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')
    into v_policy
  from pg_policy p
  where p.polrelid='public.spend_lines'::regclass
    and p.polname='sp_insert';

  if v_policy not ilike '%app_managed_units%'
     or v_policy not ilike '%unit_id%' then
    raise exception 'Stage 6 finance gate failure: manager spend policy is not scoped to managed units.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='spend_lines'
      and cmd in ('UPDATE','DELETE','ALL')
      and permissive='PERMISSIVE' -- A restrictive Stage 2 TOTP guard cannot grant mutation.
  ) then
    raise exception 'Stage 6 finance gate failure: spend_lines is no longer append-only.';
  end if;

  if to_regprocedure('public.unit_operating_position(uuid)') is null then
    raise exception 'Stage 6 finance gate failure: unit_operating_position is missing.';
  end if;

  select pg_get_functiondef('public.unit_operating_position(uuid)'::regprocedure)
    into v_def;
  if v_def not ilike '%state = ''confirmed''%'
     or v_def not ilike '%reverses_id%'
     or v_def not ilike '%state = ''approved''%'
     or v_def not ilike '%app_managed_units%' then
    raise exception 'Stage 6 finance gate failure: operating position lost its confirmed-in / append-only-out / commitment / authority contract.';
  end if;

  if (select p.prosecdef from pg_proc p where p.oid='public.unit_operating_position(uuid)'::regprocedure) then
    raise exception 'Stage 6 finance gate failure: read-only operating position must remain SECURITY INVOKER and respect RLS.';
  end if;

  if not has_function_privilege('authenticated','public.unit_operating_position(uuid)','EXECUTE')
     or has_function_privilege('anon','public.unit_operating_position(uuid)','EXECUTE') then
    raise exception 'Stage 6 finance gate failure: operating position grants are wrong.';
  end if;
end
$gate$;
