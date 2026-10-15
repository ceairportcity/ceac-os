-- Idempotent security hardening for legacy office-code RPCs.
-- Migration 124 removes the obsolete definitions on a clean replay. On
-- databases where a historical variant still exists, prevent browser use.
-- No old migration is changed, no business data is deleted, and no privilege
-- or SECURITY DEFINER allowance is increased.
do $legacy$
begin
  if to_regprocedure('public.attendance_create_office_code(uuid,integer)') is not null then
    revoke execute on function public.attendance_create_office_code(uuid,integer)
      from public,anon,authenticated;
  end if;
  if to_regprocedure('public.attendance_verify_office_code(uuid,text)') is not null then
    revoke execute on function public.attendance_verify_office_code(uuid,text)
      from public,anon,authenticated;
  end if;
end
$legacy$;
