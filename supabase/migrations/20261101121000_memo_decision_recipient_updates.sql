CREATE OR REPLACE FUNCTION private.ceac_memo_response_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_memo public.memos; v_recipient uuid;
BEGIN
 SELECT * INTO v_memo FROM public.memos WHERE id=NEW.memo_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 FOR v_recipient IN
  SELECT DISTINCT profile_id FROM public.memo_recipients WHERE memo_id=v_memo.id
  UNION SELECT v_memo.sender_id
 LOOP
  IF v_recipient IS DISTINCT FROM NEW.author_id THEN
   PERFORM private.ceac_emit_notification(v_memo.org_id,v_recipient,'memo',v_memo.id,'memo_response',NEW.id);
  END IF;
 END LOOP;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION private.ceac_memo_response_notification() FROM PUBLIC,anon,authenticated;
