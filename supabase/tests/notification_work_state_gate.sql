\set ON_ERROR_STOP on
begin;

do $surface$
declare
  signature text;
  definition text;
begin
  foreach signature in array array[
    'public.app_responsible_reviewer_id(uuid)',
    'public.app_can_review_item(uuid)',
    'public.my_work_attention_queue()'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Phase 4 function is missing: %',signature;
    end if;
    if not has_function_privilege('authenticated',signature,'EXECUTE')
       or has_function_privilege('anon',signature,'EXECUTE') then
      raise exception 'Phase 4 execution grant is unsafe: %',signature;
    end if;
    definition:=pg_get_functiondef(to_regprocedure(signature));
    if definition not ilike '%auth.uid()%' or definition not ilike '%app_org_id()%' then
      raise exception 'Phase 4 function lacks actor/organisation binding: %',signature;
    end if;
  end loop;

  if (select prosecdef from pg_proc where oid=to_regprocedure('public.app_responsible_reviewer_id(uuid)'))
     or (select prosecdef from pg_proc where oid=to_regprocedure('public.my_work_attention_queue()')) then
    raise exception 'Phase 4 read helpers must retain invoker security';
  end if;
end
$surface$;

insert into public.work_items(
  id,org_id,ref,kind,unit_id,assignee_id,assigned_by,title,origin,visibility,status,created_at,last_movement_at,confidential
) values
  ('27000000-0000-4000-8000-000000000401','10000000-0000-4000-8000-000000000010','P4-NEW-401','task','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','Phase 4 new assignment','assigned','unit','not_started',now()-interval '4 hours',now()-interval '4 hours',false),
  ('27000000-0000-4000-8000-000000000402','10000000-0000-4000-8000-000000000010','P4-RETURN-402','task','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','Phase 4 returned work','assigned','unit','returned',now()-interval '3 days',now()-interval '3 hours',false),
  ('27000000-0000-4000-8000-000000000403','10000000-0000-4000-8000-000000000010','P4-REVIEW-403','task','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','Phase 4 manager review','assigned','unit','in_review',now()-interval '2 days',now()-interval '2 hours',false),
  ('27000000-0000-4000-8000-000000000404','10000000-0000-4000-8000-000000000010','P4-UPWARD-404','task','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000004','Phase 4 executive review','assigned_by_exec','unit','in_review',now()-interval '2 days',now()-interval '90 minutes',false),
  ('27000000-0000-4000-8000-000000000405','10000000-0000-4000-8000-000000000010','P4-AGREED-405','task','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000006','31000000-0000-4000-8000-000000000006','Phase 4 agreed review','self_created','unit','in_review',now()-interval '1 day',now()-interval '1 hour',false),
  ('27000000-0000-4000-8000-000000000406','10000000-0000-4000-8000-000000000010','P4-CONFIDENTIAL-406','task','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','Phase 4 confidential review','assigned','unit','in_review',now()-interval '1 day',now()-interval '45 minutes',true);

insert into public.submissions(id,org_id,work_item_id,profile_id,note,submitted_at) values
  ('28000000-0000-4000-8000-000000000403','10000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000403','31000000-0000-4000-8000-000000000001','Manager route',now()-interval '2 hours'),
  ('28000000-0000-4000-8000-000000000404','10000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000404','31000000-0000-4000-8000-000000000002','Executive route',now()-interval '90 minutes'),
  ('28000000-0000-4000-8000-000000000405','10000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000405','31000000-0000-4000-8000-000000000006','Fallback route',now()-interval '1 hour'),
  ('28000000-0000-4000-8000-000000000406','10000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000406','31000000-0000-4000-8000-000000000001','Confidential route',now()-interval '45 minutes');

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
do $staff$
declare
  room_receipts bigint;
  announcement_receipts bigint;
begin
  select count(*) into room_receipts from public.room_reads where profile_id=auth.uid();
  select count(*) into announcement_receipts from public.announcement_receipts where profile_id=auth.uid();

  if (select count(*) from public.my_work_attention_queue() where action_kind='new_assignment' and work_item_id='27000000-0000-4000-8000-000000000401')<>1 then
    raise exception 'Staff new assignment is not explicit';
  end if;
  if (select count(*) from public.my_work_attention_queue() where action_kind='returned_work' and work_item_id='27000000-0000-4000-8000-000000000402')<>1 then
    raise exception 'Staff returned work is not explicit';
  end if;
  if exists(select 1 from public.my_work_attention_queue() where action_kind='review_required') then
    raise exception 'Staff gained a review action';
  end if;
  if (select status from public.work_items where id='27000000-0000-4000-8000-000000000401')<>'not_started'
     or (select status from public.work_items where id='27000000-0000-4000-8000-000000000402')<>'returned' then
    raise exception 'Reading the action queue mutated work state';
  end if;
  if room_receipts<>(select count(*) from public.room_reads where profile_id=auth.uid())
     or announcement_receipts<>(select count(*) from public.announcement_receipts where profile_id=auth.uid()) then
    raise exception 'Reading the action queue mutated communication receipts';
  end if;
end
$staff$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
do $manager$
begin
  if public.app_responsible_reviewer_id('27000000-0000-4000-8000-000000000403') is distinct from auth.uid()
     or not public.app_can_review_item('27000000-0000-4000-8000-000000000403') then
    raise exception 'Recorded assigning Manager did not retain review authority';
  end if;
  if public.app_responsible_reviewer_id('27000000-0000-4000-8000-000000000405') is distinct from auth.uid()
     or not public.app_can_review_item('27000000-0000-4000-8000-000000000405') then
    raise exception 'Agreed work did not fall back to the Unit Head';
  end if;
  if public.app_can_review_item('27000000-0000-4000-8000-000000000404') then
    raise exception 'Assignee gained authority to review upward work';
  end if;
  if public.app_responsible_reviewer_id('27000000-0000-4000-8000-000000000406') is not null
     or public.app_can_review_item('27000000-0000-4000-8000-000000000406') then
    raise exception 'Confidential work escaped its existing Administration boundary';
  end if;
  if (select count(*) from public.my_work_attention_queue() where action_kind='review_required' and work_item_id in (
    '27000000-0000-4000-8000-000000000403','27000000-0000-4000-8000-000000000405'
  ))<>2 then
    raise exception 'Manager review queue does not match per-item authority';
  end if;
  if exists(select 1 from public.my_work_attention_queue() where work_item_id='27000000-0000-4000-8000-000000000404') then
    raise exception 'Manager queue included work assigned upward to the Executive';
  end if;
end
$manager$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
do $assignee_self_review$
begin
  if public.app_can_review_item('27000000-0000-4000-8000-000000000405')
     or exists(
       select 1 from public.my_work_attention_queue()
       where action_kind='review_required'
         and work_item_id='27000000-0000-4000-8000-000000000405'
     ) then
    raise exception 'An assignee gained authority to review their own submission';
  end if;
end
$assignee_self_review$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
do $executive$
begin
  if public.app_responsible_reviewer_id('27000000-0000-4000-8000-000000000404') is distinct from auth.uid()
     or not public.app_can_review_item('27000000-0000-4000-8000-000000000404') then
    raise exception 'Executive-origin review did not follow its assigning authority';
  end if;
  if (select count(*) from public.my_work_attention_queue() where action_kind='review_required' and work_item_id='27000000-0000-4000-8000-000000000404')<>1 then
    raise exception 'Executive review action is missing';
  end if;
  if exists(select 1 from public.my_work_attention_queue() where action_kind='review_required' and work_item_id='27000000-0000-4000-8000-000000000403') then
    raise exception 'Executive queue claimed an ordinary Manager review';
  end if;
end
$executive$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
do $other_unit$
begin
  if public.app_responsible_reviewer_id('27000000-0000-4000-8000-000000000403') is not null
     or public.app_can_review_item('27000000-0000-4000-8000-000000000403') then
    raise exception 'Another Unit Head learned or gained the review route';
  end if;
  if exists(select 1 from public.my_work_attention_queue() where work_item_id in (
    '27000000-0000-4000-8000-000000000401','27000000-0000-4000-8000-000000000402',
    '27000000-0000-4000-8000-000000000403','27000000-0000-4000-8000-000000000404',
    '27000000-0000-4000-8000-000000000405'
  )) then
    raise exception 'Cross-unit action leakage';
  end if;
end
$other_unit$;

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
do $administration$
begin
  if not public.app_can_review_item('27000000-0000-4000-8000-000000000403')
     or not public.app_can_review_item('27000000-0000-4000-8000-000000000404') then
    raise exception 'Administration recovery authority was removed';
  end if;
  if (select count(*) from public.my_work_attention_queue() where action_kind='review_required' and work_item_id in (
    '27000000-0000-4000-8000-000000000403','27000000-0000-4000-8000-000000000404',
    '27000000-0000-4000-8000-000000000405','27000000-0000-4000-8000-000000000406'
  ))<>4 then
    raise exception 'Administration review queue does not match its server authority';
  end if;
end
$administration$;

reset role;
rollback;
select 'Phase 4 notification and work-state gate passed' as result;
