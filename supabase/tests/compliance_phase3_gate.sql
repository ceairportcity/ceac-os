\set ON_ERROR_STOP on

begin;

do $phase3_contract$
begin
  if not exists(
    select 1 from public.capability_definitions
    where capability='post_announcement' and sensitive
  ) then
    raise exception 'Phase 3 gate failure: canonical post_announcement capability is missing.';
  end if;

  if has_function_privilege('anon','public.app_can_publish_announcements()','EXECUTE')
     or has_function_privilege('authenticated','public.app_can_publish_announcements()','EXECUTE') then
    raise exception 'Phase 3 gate failure: internal announcement authority helper is browser-callable.';
  end if;

  if pg_get_functiondef('public.app_can_publish_announcements()'::regprocedure)
       not ilike '%app_has_capability(''post_announcement'',null)%' then
    raise exception 'Phase 3 gate failure: announcement publishing does not use canonical grants.';
  end if;

  if pg_get_functiondef('public.app_can_publish_announcements()'::regprocedure)
       ilike '%app_has_capability(''compliance.manage'',null)%' then
    raise exception 'Phase 3 gate failure: compliance.manage silently grants announcement authority.';
  end if;
end
$phase3_contract$;

-- Give an ordinary Staff fixture only organisation-wide Compliance authority.
insert into public.capability_grants(org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason)
select '10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000005',
       'compliance.manage',null,'31000000-0000-4000-8000-000000000003','Phase 3 isolated Compliance fixture'
where not exists(
  select 1 from public.capability_grants
  where profile_id='31000000-0000-4000-8000-000000000005'
    and capability='compliance.manage' and scope_unit_id is null and revoked_at is null
);

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);

do $phase3_separation$
begin
  if not public.app_has_capability('compliance.manage',null) then
    raise exception 'Phase 3 gate failure: Compliance fixture lacks compliance.manage.';
  end if;

  begin
    perform public.create_announcement(
      'Unauthorised Compliance instruction','Must not persist','normal',false,null,true,'{}'::uuid[],'{}'::text[]
    );
    raise exception 'Phase 3 gate failure: Compliance published without post_announcement.';
  exception when insufficient_privilege then null;
  end;
end
$phase3_separation$;

reset role;

insert into public.capability_grants(org_id,profile_id,capability,scope_unit_id,granted_by,grant_reason)
values(
  '10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000005',
  'post_announcement',null,'31000000-0000-4000-8000-000000000003','Phase 3 explicit policy instruction authority'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000005',true);

do $phase3_attribution$
declare v_id uuid;
begin
  v_id:=public.create_announcement(
    'Recorded policy instruction','Attributable Phase 3 instruction.','important',true,null,true,'{}'::uuid[],'{}'::text[]
  );
  perform public.publish_announcement(v_id);

  if not exists(
    select 1 from public.announcements
    where id=v_id and author_id=auth.uid() and status='published'
  ) then
    raise exception 'Phase 3 gate failure: policy instruction lost its real author or lifecycle.';
  end if;
end
$phase3_attribution$;

reset role;

rollback;

select 'CEAC OS Phase 3 Compliance operating surface gate passed' as result;
