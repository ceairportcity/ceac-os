-- Official-CLI forward correction177. Preserve the restrictive Storage policy and pending-owner guard.
-- Revalidate the exact dated contributor through the canonical cover authority.
alter policy routine_date_evidence_current_writer on storage.objects
 to authenticated with check (
 bucket_id<>'ceac-operational-private'
 or coalesce((storage.foldername(storage.objects.name))[2],'')<>'routine-date'
 or (
  public.app_stage2_universal_aal_allowed()
  and exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.org_id=public.app_org_id() and actor.active)
  and exists(select 1 from public.routine_date_progress p
   join public.recurring_operations r on r.id=p.operation_id and r.org_id=p.org_id
   join public.work_items w on w.id=r.work_item_id and w.org_id=r.org_id
   join public.units u on u.id=r.unit_id and u.org_id=r.org_id and u.active
   where p.id::text=(storage.foldername(storage.objects.name))[3] and p.org_id=public.app_org_id()
    and p.actor_id=auth.uid() and r.active and r.paused_at is null
    and w.visibility='unit' and not w.confidential and public.app_can_see_item(w.id)
    and private.routine_date_can_record(r.id,p.scheduled_on))
 ));
