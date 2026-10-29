\set ON_ERROR_STOP on
-- OWNER RELEASE OPERATION ONLY, after reviewed schema and release approval.
-- Supply privately reviewed author_id and message_ids (UUID array, exactly four).
-- Run through the trusted database-owner connection, never a browser session.
BEGIN;
SELECT set_config('ceac.owner_removal.author_id',:'author_id',true);
SELECT set_config('ceac.owner_removal.message_ids',:'message_ids',true);
DO $remove$
DECLARE expected uuid[]:=current_setting('ceac.owner_removal.message_ids')::uuid[];
 author uuid:=current_setting('ceac.owner_removal.author_id')::uuid;
BEGIN
 IF cardinality(expected)<>4 OR (SELECT count(DISTINCT x) FROM unnest(expected) x)<>4
  OR (SELECT count(*) FROM public.room_messages WHERE author_id=author)<>4
  OR (SELECT count(*) FROM public.room_messages WHERE id=ANY(expected) AND author_id=author)<>4
  OR (SELECT count(DISTINCT room_id) FROM public.room_messages WHERE id=ANY(expected))<>2
 THEN RAISE EXCEPTION 'Historical removal scope changed. Reinspect before proceeding.'; END IF;
 IF EXISTS(SELECT 1 FROM public.room_messages WHERE reply_to_id=ANY(expected))
  OR EXISTS(SELECT 1 FROM public.room_message_refs WHERE message_id=ANY(expected))
  OR EXISTS(SELECT 1 FROM public.operational_file_links WHERE context_type='room_message' AND context_id=ANY(expected))
 THEN RAISE EXCEPTION 'Message dependencies changed. Review their preservation first.'; END IF;
 INSERT INTO private.room_message_removals(message_id,org_id,removed_by,reason)
 SELECT id,org_id,NULL,'Explicit product-owner instruction: remove the four reviewed historical messages; executed by database owner.'
 FROM public.room_messages WHERE id=ANY(expected) AND author_id=author ON CONFLICT DO NOTHING;
 IF (SELECT count(*) FROM private.room_message_removals WHERE message_id=ANY(expected))<>4
 THEN RAISE EXCEPTION 'All four auditable removals could not be confirmed.'; END IF;
END; $remove$;
COMMIT;
