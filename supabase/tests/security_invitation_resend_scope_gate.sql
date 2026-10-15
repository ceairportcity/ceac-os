\set ON_ERROR_STOP on
begin;

do $contract$
declare
  v_def text;
  v_org_pos integer;
  v_lock_pos integer;
begin
  if to_regprocedure('public.prepare_staff_invitation_resend(uuid)') is null then
    raise exception 'S3 resend gate failure: resend RPC is missing.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.prepare_staff_invitation_resend(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.prepare_staff_invitation_resend(uuid)',
       'EXECUTE'
     ) then
    raise exception 'S3 resend gate failure: resend RPC privileges are incorrect.';
  end if;

  v_def:=lower(pg_get_functiondef(
    'public.prepare_staff_invitation_resend(uuid)'::regprocedure
  ));

  if v_def not like '%v_org uuid:=public.app_org_id()%' then
    raise exception 'S3 resend gate failure: caller organisation is not resolved before resend lookup.';
  end if;

  v_org_pos:=position('and org_id=v_org' in v_def);
  v_lock_pos:=position('for update' in v_def);

  if v_org_pos=0 or v_lock_pos=0 or v_org_pos>v_lock_pos then
    raise exception 'S3 resend gate failure: invitation row is not organisation-scoped before row lock.';
  end if;

  if v_def like '%where id=p_invitation_id for update%' then
    raise exception 'S3 resend gate failure: legacy cross-organisation lock pattern remains.';
  end if;
end
$contract$;

-- Normal same-organisation resend must still work for the Unit A Manager.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select (public.create_pending_invitation(
  's3.resend.scope@ceac.local.test',
  'S3 Resend Scope Fixture',
  '20000000-0000-4000-8000-000000000011',
  'staff'
)).id as invitation_id
\gset

select set_config('ceac.test.resend_invitation_id', :'invitation_id', true);

do $same_org_resend$
declare
  v_result jsonb;
begin
  v_result:=public.prepare_staff_invitation_resend(
    current_setting('ceac.test.resend_invitation_id')::uuid
  );

  if v_result->>'email'<>'s3.resend.scope@ceac.local.test' then
    raise exception 'S3 resend gate failure: authorised same-org resend returned the wrong invitation.';
  end if;
end
$same_org_resend$;

reset role;

-- A second organisation row is deliberately unreachable from the CEAC actor.
insert into public.organisations(id,name,short_code)
values(
  '10000000-0000-4000-8000-000000000099',
  'Other Org Fixture',
  'OTH'
);

insert into public.units(id,org_id,name,code)
values(
  '20000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000099',
  'Other Unit Fixture',
  'OTH'
);

insert into public.pending_invitations(
  id,org_id,email,full_name,unit_id,role,invited_by,expires_at
) values (
  '40000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000099',
  'other.org.resend@ceac.local.test',
  'Other Org Resend Fixture',
  '20000000-0000-4000-8000-000000000099',
  'staff',
  '31000000-0000-4000-8000-000000000003',
  now()+interval '1 day'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

do $cross_org_denied$
begin
  begin
    perform public.prepare_staff_invitation_resend(
      '40000000-0000-4000-8000-000000000099'
    );
    raise exception 'S3 resend gate failure: cross-organisation resend was allowed.';
  exception when insufficient_privilege then
    null;
  end;
end
$cross_org_denied$;

reset role;
rollback;

select 'CEAC OS S3 invitation resend scope gate passed' as result;
