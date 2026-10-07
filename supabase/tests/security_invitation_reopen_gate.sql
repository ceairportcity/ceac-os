\set ON_ERROR_STOP on
begin;

do $contract$
begin
  if pg_get_functiondef(
       'public.create_pending_invitation(text,text,uuid,text)'::regprocedure
     ) not ilike '%cancelled invitation requires People Administration review%' then
    raise exception 'S3 invitation gate failure: cancelled-invitation authority guard is missing.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.create_pending_invitation(text,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.create_pending_invitation(text,text,uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'S3 invitation gate failure: invitation RPC privileges are incorrect.';
  end if;
end
$contract$;

-- Unit A Manager may create an ordinary Staff invitation in their managed unit.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select (public.create_pending_invitation(
  's3.cancelled.reopen@ceac.local.test',
  'S3 Cancelled Reopen Fixture',
  '20000000-0000-4000-8000-000000000011',
  'staff'
)).id as invitation_id
\gset

select set_config('ceac.test.invitation_id', :'invitation_id', true);

reset role;

-- People Administration cancels it.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select public.admin_revoke_staff_invitation(
  current_setting('ceac.test.invitation_id')::uuid,
  'S3 cancelled-invitation authority gate'
);

reset role;

-- The Unit Manager must not be able to undo Administration's cancellation.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

do $manager_cannot_reopen$
begin
  begin
    perform public.create_pending_invitation(
      's3.cancelled.reopen@ceac.local.test',
      'S3 Cancelled Reopen Fixture',
      '20000000-0000-4000-8000-000000000011',
      'staff'
    );
    raise exception 'S3 invitation gate failure: Unit Manager reopened an Administration-cancelled invitation.';
  exception when insufficient_privilege then
    if sqlerrm not ilike '%cancelled invitation requires People Administration review%' then
      raise;
    end if;
  end;
end
$manager_cannot_reopen$;

reset role;

-- People Administration may make the explicit decision to reopen it.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select (public.create_pending_invitation(
  's3.cancelled.reopen@ceac.local.test',
  'S3 Cancelled Reopen Fixture',
  '20000000-0000-4000-8000-000000000011',
  'staff'
)).id as reopened_id
\gset

do $admin_reopened$
begin
  if current_setting('ceac.test.reopened_id',true) is not null then
    null;
  end if;

  if not exists (
    select 1
    from public.pending_invitations
    where id=:'reopened_id'::uuid
      and revoked_at is null
      and revoked_by is null
      and revocation_reason is null
      and resolved_at is null
      and expires_at>now()
      and invited_by='31000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'S3 invitation gate failure: People Administration did not reopen the invitation cleanly.';
  end if;
end
$admin_reopened$;

reset role;
rollback;

select 'CEAC OS S3 cancelled-invitation authority gate passed' as result;
