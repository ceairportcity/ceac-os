-- Owner-authorised Messages / Memos, 28 October. Forward-only; no live data edits.
ALTER TABLE public.work_activity_records ADD COLUMN next_action_on date;
ALTER TABLE public.work_activity_records ADD CONSTRAINT activity_next_action_date_requires_text
 CHECK(next_action_on IS NULL OR nullif(btrim(next_action),'') IS NOT NULL);

-- Preserve the original append-only Room messages. Removal is a separate event.
CREATE TABLE private.room_message_removals (
 message_id uuid PRIMARY KEY REFERENCES public.room_messages(id) ON DELETE RESTRICT,
 org_id uuid NOT NULL REFERENCES public.organisations(id),
 removed_by uuid REFERENCES public.profiles(id), removed_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 600)
);
ALTER TABLE private.room_message_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.room_message_removals FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.app_room_message_is_visible(p_message_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles a
  WHERE a.id=auth.uid() AND a.org_id=public.app_org_id() AND a.active)
 AND NOT EXISTS(SELECT 1 FROM private.room_message_removals r WHERE r.message_id=p_message_id);
$$;
REVOKE ALL ON FUNCTION public.app_room_message_is_visible(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.app_room_message_is_visible(uuid) TO authenticated;
CREATE POLICY room_message_not_removed ON public.room_messages AS RESTRICTIVE
 FOR SELECT TO authenticated USING(public.app_room_message_is_visible(id));
CREATE POLICY room_ref_not_removed ON public.room_message_refs AS RESTRICTIVE
 FOR SELECT TO authenticated USING(public.app_room_message_is_visible(message_id));
CREATE POLICY room_mention_not_removed ON public.room_mentions AS RESTRICTIVE
 FOR SELECT TO authenticated USING(public.app_room_message_is_visible(message_id));
CREATE FUNCTION public.remove_own_room_message(p_message_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.room_messages;
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_stage2_universal_aal_allowed() THEN
  RAISE EXCEPTION 'Sign in to remove your message.' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.room_messages WHERE id=p_message_id FOR UPDATE;
 IF m.id IS NULL OR m.org_id IS DISTINCT FROM public.app_org_id()
  OR m.author_id IS DISTINCT FROM auth.uid() OR NOT public.app_can_access_room(m.room_id)
  OR NOT EXISTS(SELECT 1 FROM public.profiles a WHERE a.id=auth.uid() AND a.active)
 THEN RAISE EXCEPTION 'Only the sender can remove this message.' USING ERRCODE='42501'; END IF;
 INSERT INTO private.room_message_removals(message_id,org_id,removed_by,reason)
 VALUES(m.id,m.org_id,auth.uid(),'Removed by sender') ON CONFLICT DO NOTHING;
 -- No content in the general activity stream.
END; $$;
REVOKE ALL ON FUNCTION public.remove_own_room_message(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.remove_own_room_message(uuid) TO authenticated;

CREATE TABLE public.memos (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES public.organisations(id),
 sender_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','responded','closed','pending_decision','changes_requested','approved','declined')),
 decision_required boolean NOT NULL DEFAULT false,
 decision_scope text NOT NULL DEFAULT 'department' CHECK(decision_scope IN ('department','cross_department')),
 unit_id uuid REFERENCES public.units(id), decision_maker_id uuid REFERENCES public.profiles(id),
 current_version_id uuid, project_id uuid UNIQUE REFERENCES public.projects(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.memo_recipients (
 memo_id uuid NOT NULL REFERENCES public.memos(id), profile_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('to','cc')), last_read_at timestamptz,
 PRIMARY KEY(memo_id,profile_id)
);
CREATE TABLE public.memo_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), memo_id uuid NOT NULL REFERENCES public.memos(id),
 version_no integer NOT NULL CHECK(version_no>0),
 subject text NOT NULL DEFAULT '' CHECK(length(subject)<=240),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=30000),
 sent_at timestamptz, UNIQUE(memo_id,version_no), UNIQUE(memo_id,id)
);
ALTER TABLE public.memos ADD CONSTRAINT memo_current_version_same_memo
 FOREIGN KEY(id,current_version_id) REFERENCES public.memo_versions(memo_id,id);
CREATE TABLE public.memo_exchanges (
 id uuid PRIMARY KEY, memo_id uuid NOT NULL REFERENCES public.memos(id),
 version_id uuid NOT NULL, author_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('reply','changes_requested','approved','declined','closed')),
 body text NOT NULL CHECK(length(body)<=30000), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(memo_id,version_id) REFERENCES public.memo_versions(memo_id,id)
);
CREATE UNIQUE INDEX memo_one_final_decision_per_version ON public.memo_exchanges(version_id)
 WHERE kind IN ('approved','declined','changes_requested');
CREATE INDEX memo_sender_updated ON public.memos(org_id,sender_id,updated_at DESC);
CREATE INDEX memo_recipient_inbox ON public.memo_recipients(profile_id,memo_id);
CREATE INDEX memo_exchanges_timeline ON public.memo_exchanges(memo_id,created_at,id);

CREATE FUNCTION public.app_can_access_memo(p_memo_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.app_stage2_universal_aal_allowed()
 AND EXISTS(SELECT 1 FROM public.profiles a WHERE a.id=auth.uid() AND a.org_id=public.app_org_id() AND a.active)
 AND EXISTS(SELECT 1 FROM public.memos m WHERE m.id=p_memo_id AND m.org_id=public.app_org_id()
  AND (m.sender_id=auth.uid() OR (m.status<>'draft' AND EXISTS(
   SELECT 1 FROM public.memo_recipients r WHERE r.memo_id=m.id AND r.profile_id=auth.uid()))));
$$;
REVOKE ALL ON FUNCTION public.app_can_access_memo(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.app_can_access_memo(uuid) TO authenticated;
-- Communication never grants access to unrelated profiles/projects/Rooms.
CREATE FUNCTION public.memo_recipient_directory() RETURNS TABLE(id uuid,full_name text,job_title text,is_group_pastor boolean,managed_units uuid[],member_units uuid[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.full_name,p.job_title,
  (p.is_exec AND lower(btrim(coalesce(p.job_title,'')))='group pastor'),
  ARRAY(SELECT um.unit_id FROM public.unit_memberships um JOIN public.units u ON u.id=um.unit_id AND u.active WHERE um.profile_id=p.id AND um.org_id=p.org_id AND um.role='manager'),
  ARRAY(SELECT um.unit_id FROM public.unit_memberships um JOIN public.units u ON u.id=um.unit_id AND u.active WHERE um.profile_id=p.id AND um.org_id=p.org_id)
 FROM public.profiles p WHERE auth.uid() IS NOT NULL AND p.org_id=public.app_org_id() AND p.active
 AND public.app_stage2_universal_aal_allowed()
 AND EXISTS(SELECT 1 FROM public.profiles a WHERE a.id=auth.uid() AND a.org_id=p.org_id AND a.active);
$$;
REVOKE ALL ON FUNCTION public.memo_recipient_directory() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.memo_recipient_directory() TO authenticated;

-- Private helper is called by validated mutations, not exposed as an API.
CREATE FUNCTION private.memo_authority_valid(p_actor uuid,p_org uuid,p_scope text,p_unit uuid) RETURNS boolean
 LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_actor AND p.org_id=p_org AND p.active
 AND ((p.is_exec AND lower(btrim(coalesce(p.job_title,'')))='group pastor')
 OR (p_scope='department' AND EXISTS(SELECT 1 FROM public.unit_memberships u
  JOIN public.units d ON d.id=u.unit_id AND d.org_id=p_org AND d.active
  WHERE u.profile_id=p.id AND u.org_id=p_org AND u.unit_id=p_unit AND u.role='manager'))));
$$;
REVOKE ALL ON FUNCTION private.memo_authority_valid(uuid,uuid,text,uuid) FROM public,anon,authenticated,service_role;

CREATE FUNCTION public.save_memo_draft(p_id uuid,p_version_id uuid,p_subject text,p_body text,p_to uuid[],p_cc uuid[],p_decision_required boolean,p_decision_scope text,p_unit_id uuid,p_decision_maker_id uuid,p_expected_updated_at timestamptz DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.memos; v_version uuid; v_saved_at timestamptz; v_person uuid; v_org uuid:=public.app_org_id();
BEGIN
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.app_stage2_universal_aal_allowed()
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.org_id=v_org AND p.active)
 THEN RAISE EXCEPTION 'Sign in to write a memo.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR length(coalesce(p_subject,''))>240 OR length(coalesce(p_body,''))>30000
  OR p_decision_required IS NULL OR p_decision_scope IS NULL OR p_decision_scope NOT IN ('department','cross_department')
  OR cardinality(coalesce(p_to,'{}'))+cardinality(coalesce(p_cc,'{}'))>100
 THEN RAISE EXCEPTION 'Check the memo details and recipients.'; END IF;
 -- Serialize even the very first save and idempotent retry of a client UUID.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO m FROM public.memos WHERE id=p_id FOR UPDATE;
 IF m.id IS NULL THEN
  IF p_version_id IS NOT NULL THEN RAISE EXCEPTION 'Memo version changed. Reload before editing.'; END IF;
  INSERT INTO public.memos(id,org_id,sender_id) VALUES(p_id,v_org,auth.uid()) RETURNING * INTO m;
 ELSE
  IF m.sender_id IS DISTINCT FROM auth.uid() OR m.org_id IS DISTINCT FROM v_org OR m.status NOT IN ('draft','changes_requested')
   THEN RAISE EXCEPTION 'Only the sender can edit a draft or requested revision.' USING ERRCODE='42501'; END IF;
  IF m.updated_at IS DISTINCT FROM p_expected_updated_at OR m.current_version_id IS DISTINCT FROM p_version_id THEN RAISE EXCEPTION 'Memo version changed. Reload before editing.'; END IF;
 END IF;
 IF p_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.units u WHERE u.id=p_unit_id AND u.org_id=v_org AND u.active)
 THEN RAISE EXCEPTION 'Choose an active department.'; END IF;
 IF m.status='changes_requested' AND (
  m.decision_required IS DISTINCT FROM p_decision_required OR m.decision_scope IS DISTINCT FROM p_decision_scope
  OR m.unit_id IS DISTINCT FROM p_unit_id OR m.decision_maker_id IS DISTINCT FROM p_decision_maker_id
  OR (SELECT array_agg(profile_id ORDER BY profile_id) FROM public.memo_recipients WHERE memo_id=m.id AND kind='to') IS DISTINCT FROM (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(p_to,'{}'::uuid[])) x)
  OR (SELECT array_agg(profile_id ORDER BY profile_id) FROM public.memo_recipients WHERE memo_id=m.id AND kind='cc') IS DISTINCT FROM (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(p_cc,'{}'::uuid[])) x)
 ) THEN RAISE EXCEPTION 'Keep the original recipients and decision route when revising.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(coalesce(p_to,'{}'::uuid[])) t JOIN unnest(coalesce(p_cc,'{}'::uuid[])) c ON c=t)
 THEN RAISE EXCEPTION 'A person cannot be both To and Cc.'; END IF;
 FOREACH v_person IN ARRAY coalesce(p_to,'{}'::uuid[])||coalesce(p_cc,'{}'::uuid[]) LOOP
  IF v_person=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_person AND p.org_id=v_org AND p.active)
  THEN RAISE EXCEPTION 'Choose other active CEAC recipients.'; END IF;
 END LOOP;
 IF m.status='draft' THEN
  DELETE FROM public.memo_recipients WHERE memo_id=m.id;
  INSERT INTO public.memo_recipients(memo_id,profile_id,kind)
   SELECT m.id,x,'to' FROM unnest(coalesce(p_to,'{}'::uuid[])) x
   UNION SELECT m.id,x,'cc' FROM unnest(coalesce(p_cc,'{}'::uuid[])) x;
 END IF;
 SELECT id INTO v_version FROM public.memo_versions WHERE id=m.current_version_id AND sent_at IS NULL;
 IF v_version IS NULL THEN
  INSERT INTO public.memo_versions(memo_id,version_no,subject,body)
  SELECT m.id,coalesce(max(version_no),0)+1,coalesce(p_subject,''),coalesce(p_body,'') FROM public.memo_versions WHERE memo_id=m.id
  RETURNING id INTO v_version;
 ELSE
  UPDATE public.memo_versions SET subject=coalesce(p_subject,''),body=coalesce(p_body,'') WHERE id=v_version;
 END IF;
 UPDATE public.memos SET current_version_id=v_version,decision_required=p_decision_required,
  decision_scope=p_decision_scope,unit_id=p_unit_id,decision_maker_id=CASE WHEN p_decision_required THEN p_decision_maker_id END,
  updated_at=clock_timestamp() WHERE id=m.id RETURNING updated_at INTO v_saved_at;
 RETURN jsonb_build_object('version_id',v_version,'updated_at',v_saved_at);
END; $$;
REVOKE ALL ON FUNCTION public.save_memo_draft(uuid,uuid,text,text,uuid[],uuid[],boolean,text,uuid,uuid,timestamptz) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_memo_draft(uuid,uuid,text,text,uuid[],uuid[],boolean,text,uuid,uuid,timestamptz) TO authenticated;

CREATE FUNCTION public.send_memo(p_id uuid,p_version_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.memos; v public.memo_versions;
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_can_access_memo(p_id) THEN RAISE EXCEPTION 'Memo unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.memos WHERE id=p_id FOR UPDATE;
 IF m.sender_id IS DISTINCT FROM auth.uid() OR m.current_version_id IS DISTINCT FROM p_version_id
 THEN RAISE EXCEPTION 'Only the sender can send the current version.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.memo_versions WHERE id=m.current_version_id FOR UPDATE;
 IF v.sent_at IS NOT NULL THEN RETURN; END IF; -- safe retry, no duplicate delivery
 IF m.status NOT IN ('draft','changes_requested') OR nullif(btrim(v.subject),'') IS NULL OR nullif(btrim(v.body),'') IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.memo_recipients r WHERE r.memo_id=m.id AND r.kind='to')
 THEN RAISE EXCEPTION 'Add a subject, message and primary recipient.'; END IF;
 IF EXISTS(SELECT 1 FROM public.memo_recipients r LEFT JOIN public.profiles p ON p.id=r.profile_id AND p.org_id=m.org_id AND p.active WHERE r.memo_id=m.id AND p.id IS NULL)
 THEN RAISE EXCEPTION 'One of the recipients is no longer active. Review the draft.'; END IF;
 IF m.decision_required AND ((m.decision_scope='department' AND m.unit_id IS NULL) OR m.decision_maker_id IS NULL OR m.decision_maker_id=m.sender_id
  OR NOT EXISTS(SELECT 1 FROM public.memo_recipients r WHERE r.memo_id=m.id AND r.profile_id=m.decision_maker_id AND r.kind='to')
  OR NOT private.memo_authority_valid(m.decision_maker_id,m.org_id,m.decision_scope,m.unit_id))
 THEN RAISE EXCEPTION 'Choose a primary recipient authorised to decide this proposal.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.operational_file_links l JOIN public.operational_files f ON f.id=l.file_id WHERE l.context_type='memo_version' AND l.context_id=v.id AND f.state<>'active')
 THEN RAISE EXCEPTION 'Finish attaching the proposal files before sending.'; END IF;
 UPDATE public.memo_versions SET sent_at=now() WHERE id=v.id;
 UPDATE public.memos SET status=CASE WHEN decision_required THEN 'pending_decision' ELSE 'sent' END,updated_at=clock_timestamp() WHERE id=m.id;
END; $$;
REVOKE ALL ON FUNCTION public.send_memo(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.send_memo(uuid,uuid) TO authenticated;

CREATE FUNCTION public.respond_to_memo(p_id uuid,p_version_id uuid,p_exchange_id uuid,p_action text,p_body text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.memos; old public.memo_exchanges;
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_can_access_memo(p_id) THEN RAISE EXCEPTION 'Memo unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.memos WHERE id=p_id FOR UPDATE;
 SELECT * INTO old FROM public.memo_exchanges WHERE id=p_exchange_id;
 IF old.id IS NOT NULL THEN
  IF old.memo_id=p_id AND old.version_id=p_version_id AND old.author_id=auth.uid() AND old.kind=p_action AND old.body=coalesce(p_body,'') THEN RETURN old.id; END IF;
  RAISE EXCEPTION 'That response identity is already used.';
 END IF;
 IF p_exchange_id IS NULL OR m.status IN ('draft','closed','declined') OR m.current_version_id IS DISTINCT FROM p_version_id
  OR NOT EXISTS(SELECT 1 FROM public.memo_versions v WHERE v.id=p_version_id AND v.sent_at IS NOT NULL)
 THEN RAISE EXCEPTION 'This memo version is not open for a response.'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('reply','changes_requested','approved','declined','closed') OR length(coalesce(p_body,''))>30000
 THEN RAISE EXCEPTION 'Choose a valid response.'; END IF;
 IF p_action IN ('approved','declined','changes_requested') THEN
  IF NOT public.app_privileged_aal_allowed() OR NOT m.decision_required OR m.status<>'pending_decision' OR m.decision_maker_id IS DISTINCT FROM auth.uid()
   OR m.sender_id=auth.uid() OR NOT private.memo_authority_valid(auth.uid(),m.org_id,m.decision_scope,m.unit_id)
   OR NOT EXISTS(SELECT 1 FROM public.memo_recipients r WHERE r.memo_id=m.id AND r.profile_id=auth.uid() AND r.kind='to')
  THEN RAISE EXCEPTION 'You are not authorised to decide this proposal.' USING ERRCODE='42501'; END IF;
 ELSIF p_action='closed' THEN
  IF m.sender_id IS DISTINCT FROM auth.uid() OR m.decision_required THEN RAISE EXCEPTION 'Only the sender can close ordinary correspondence.' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_action IN ('reply','declined','changes_requested') AND nullif(btrim(coalesce(p_body,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Write your response or reason.'; END IF;
 INSERT INTO public.memo_exchanges(id,memo_id,version_id,author_id,kind,body)
 VALUES(p_exchange_id,m.id,p_version_id,auth.uid(),p_action,coalesce(p_body,''));
 UPDATE public.memos SET status=CASE WHEN p_action<>'reply' THEN p_action
  WHEN NOT decision_required AND auth.uid()<>sender_id THEN 'responded' ELSE status END, updated_at=clock_timestamp() WHERE id=m.id;
 RETURN p_exchange_id;
END; $$;
REVOKE ALL ON FUNCTION public.respond_to_memo(uuid,uuid,uuid,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.respond_to_memo(uuid,uuid,uuid,text,text) TO authenticated;

CREATE FUNCTION public.mark_memo_read(p_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_can_access_memo(p_id) THEN RAISE EXCEPTION 'Memo unavailable.' USING ERRCODE='42501'; END IF;
 UPDATE public.memo_recipients SET last_read_at=now() WHERE memo_id=p_id AND profile_id=auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.mark_memo_read(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.mark_memo_read(uuid) TO authenticated;

CREATE FUNCTION public.create_project_from_memo(p_id uuid,p_version_id uuid,p_lead_unit_id uuid,p_participant_unit_ids uuid[],p_project_name text,p_project_summary text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.memos; v public.memo_versions; v_project uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.app_can_access_memo(p_id) THEN RAISE EXCEPTION 'Memo unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.memos WHERE id=p_id FOR UPDATE;
 IF m.status<>'approved' OR m.current_version_id IS DISTINCT FROM p_version_id
 THEN RAISE EXCEPTION 'Only the approved version can become a project.'; END IF;
 -- Reuse the existing creation authority and do not create on approval.
 IF NOT (public.app_is_admin() OR EXISTS(SELECT 1 FROM public.capabilities c WHERE c.profile_id=auth.uid() AND c.org_id=m.org_id AND c.capability='create_project'))
 THEN RAISE EXCEPTION 'Project creation authority is required.' USING ERRCODE='42501'; END IF;
 IF p_lead_unit_id IS NULL OR (m.decision_scope='department' AND (p_lead_unit_id IS DISTINCT FROM m.unit_id OR EXISTS(SELECT 1 FROM unnest(p_participant_unit_ids) u WHERE u IS DISTINCT FROM m.unit_id)))
 THEN RAISE EXCEPTION 'Keep project departments within the approved proposal scope.'; END IF;
 IF m.project_id IS NOT NULL THEN RETURN m.project_id; END IF;
 SELECT * INTO v FROM public.memo_versions WHERE id=m.current_version_id AND sent_at IS NOT NULL;
 IF nullif(btrim(p_project_name),'') IS NULL OR length(p_project_name)>240 OR length(coalesce(p_project_summary,''))>4000 THEN RAISE EXCEPTION 'Review the project title and shareable summary.'; END IF;
 v_project:=public.create_project_with_participants(p_lead_unit_id,p_project_name,p_project_summary,NULL,NULL,p_participant_unit_ids);
 UPDATE public.memos SET project_id=v_project,updated_at=clock_timestamp() WHERE id=m.id;
 RETURN v_project;
END; $$;
REVOKE ALL ON FUNCTION public.create_project_from_memo(uuid,uuid,uuid,uuid[],text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.create_project_from_memo(uuid,uuid,uuid,uuid[],text,text) TO authenticated;

-- No direct browser writes, including sender edits to sent content/decisions.
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_exchanges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memos,public.memo_recipients,public.memo_versions,public.memo_exchanges FROM public,anon,authenticated;
GRANT SELECT ON public.memos,public.memo_recipients,public.memo_versions,public.memo_exchanges TO authenticated;
CREATE POLICY memo_participant_read ON public.memos FOR SELECT TO authenticated USING(public.app_can_access_memo(id));
CREATE POLICY memo_recipient_participant_read ON public.memo_recipients FOR SELECT TO authenticated USING(public.app_can_access_memo(memo_id));
CREATE POLICY memo_version_participant_read ON public.memo_versions FOR SELECT TO authenticated USING(public.app_can_access_memo(memo_id) AND (sent_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.memos m WHERE m.id=memo_id AND m.sender_id=auth.uid())));
CREATE POLICY memo_exchange_participant_read ON public.memo_exchanges FOR SELECT TO authenticated USING(public.app_can_access_memo(memo_id));

-- Reuse private operational Storage without granting Memo recipients unrelated
-- project or HR visibility. Extend exact existing bodies, preserving all other
-- context branches. Failure to find the reviewed hooks aborts the migration.
DO $extend$
DECLARE d text; f regprocedure; n text;
BEGIN
 FOREACH n IN ARRAY ARRAY['app_can_read_operational_context(text,uuid)','app_can_write_operational_context(text,uuid)'] LOOP
  f:=('public.'||n)::regprocedure; d:=pg_get_functiondef(f);
  IF position('when ''room_message'' then' in d)=0 OR position('else false' in d)=0 THEN RAISE EXCEPTION 'Operational file context changed: review migration.'; END IF;
  d:=replace(d,'when ''room_message'' then exists(', 'when ''room_message'' then public.app_room_message_is_visible(p_context_id) and exists(');
  IF n LIKE 'app_can_read%' THEN
   d:=replace(d,'else false', 'when ''memo_version'' then exists(select 1 from public.memo_versions v join public.memos m on m.id=v.memo_id where v.id=p_context_id and public.app_can_access_memo(m.id) and (v.sent_at is not null or m.sender_id=auth.uid())) else false');
  ELSE
   d:=replace(d,'else false', 'when ''memo_version'' then exists(select 1 from public.memo_versions v join public.memos m on m.id=v.memo_id where v.id=p_context_id and m.current_version_id=v.id and m.sender_id=auth.uid() and v.sent_at is null and m.status in (''draft'',''changes_requested'') and public.app_can_access_memo(m.id)) else false');
  END IF;
  EXECUTE d;
 END LOOP;
 -- Extend relation validation without replacing unrelated upload hardening.
 FOREACH n IN ARRAY ARRAY['register_operational_file(text,uuid,text,text,text,bigint)','link_operational_file(uuid,text,uuid,text)'] LOOP
  f:=('public.'||n)::regprocedure; d:=pg_get_functiondef(f);
  IF position('p_context_type not in (' in d)=0 THEN RAISE EXCEPTION 'File relation validator changed: review migration.'; END IF;
  d:=replace(d,'p_context_type not in (','p_context_type=''memo_version'' and p_relation<>''memo_attachment'' or p_context_type not in (''memo_version'',');
  EXECUTE d;
 END LOOP;
 -- Extend every reviewed context/relation check using its original expression.
 FOR d IN SELECT 'ALTER TABLE public.operational_file_links DROP CONSTRAINT '||quote_ident(c.conname)||'; ALTER TABLE public.operational_file_links ADD CONSTRAINT '||quote_ident(c.conname)||' CHECK(('||pg_get_expr(c.conbin,c.conrelid)||') OR (context_type=''memo_version'' AND relation=''memo_attachment''));'
  FROM pg_constraint c WHERE c.conrelid='public.operational_file_links'::regclass AND c.contype='c' AND (pg_get_expr(c.conbin,c.conrelid) LIKE '%context_type%' OR pg_get_expr(c.conbin,c.conrelid) LIKE '%relation%')
 LOOP EXECUTE d; END LOOP;
END; $extend$;
-- Exact attachment freeze: registration/linking serializes with send/decision.
CREATE FUNCTION private.guard_memo_file_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.memo_versions; m public.memos;
BEGIN
 IF NEW.context_type<>'memo_version' THEN RETURN NEW; END IF;
 SELECT * INTO v FROM public.memo_versions WHERE id=NEW.context_id;
 SELECT * INTO m FROM public.memos WHERE id=v.memo_id FOR UPDATE;
 SELECT * INTO v FROM public.memo_versions WHERE id=NEW.context_id;
 IF auth.uid() IS NULL OR m.sender_id IS DISTINCT FROM auth.uid() OR m.org_id IS DISTINCT FROM public.app_org_id()
 OR m.current_version_id IS DISTINCT FROM v.id OR v.sent_at IS NOT NULL OR m.status NOT IN ('draft','changes_requested')
 THEN RAISE EXCEPTION 'Attachments on a sent memo version are permanent.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_memo_file_link() FROM public,anon,authenticated,service_role;
CREATE TRIGGER guard_memo_file_link BEFORE INSERT ON public.operational_file_links FOR EACH ROW EXECUTE FUNCTION private.guard_memo_file_link();

CREATE FUNCTION public.remove_memo_draft_attachment(p_link_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.operational_file_links; v public.memo_versions; m public.memos;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in.' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.operational_file_links WHERE id=p_link_id AND context_type='memo_version';
 SELECT * INTO v FROM public.memo_versions WHERE id=l.context_id;
 SELECT * INTO m FROM public.memos WHERE id=v.memo_id FOR UPDATE;
 SELECT * INTO v FROM public.memo_versions WHERE id=l.context_id;
 IF m.sender_id IS DISTINCT FROM auth.uid() OR m.current_version_id IS DISTINCT FROM v.id OR v.sent_at IS NOT NULL
  OR NOT public.app_can_access_memo(m.id) THEN RAISE EXCEPTION 'Only attachments on your unsent draft can be removed.' USING ERRCODE='42501'; END IF;
 DELETE FROM public.operational_file_links WHERE id=l.id;
END; $$;
REVOKE ALL ON FUNCTION public.remove_memo_draft_attachment(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.remove_memo_draft_attachment(uuid) TO authenticated;

-- RLS-invoker directory computes each authorised Room's actual last message and
-- unread count. No global recent-message limit hiding older conversations.
CREATE FUNCTION public.my_room_directory() RETURNS TABLE(id uuid,kind text,unit_id uuid,sub_team_id uuid,project_id uuid,name text,last_body text,last_author text,last_at timestamptz,unread_count bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT r.id,r.kind,r.unit_id,r.sub_team_id,r.project_id,
  CASE r.kind WHEN 'project' THEN p.name WHEN 'sub_team' THEN st.name ELSE u.name END,
  last_message.body,author.full_name,last_message.created_at,
  (SELECT count(*) FROM public.room_messages unread WHERE unread.room_id=r.id AND unread.author_id<>auth.uid()
   AND unread.created_at>coalesce(rd.last_read_at,'-infinity'::timestamptz))
 FROM public.rooms r LEFT JOIN public.units u ON u.id=r.unit_id
 LEFT JOIN public.sub_teams st ON st.id=r.sub_team_id LEFT JOIN public.projects p ON p.id=r.project_id
 LEFT JOIN public.room_reads rd ON rd.room_id=r.id AND rd.profile_id=auth.uid()
 LEFT JOIN LATERAL (SELECT rm.body,rm.author_id,rm.created_at FROM public.room_messages rm
  WHERE rm.room_id=r.id ORDER BY rm.created_at DESC,rm.id DESC LIMIT 1) last_message ON true
 LEFT JOIN public.profiles author ON author.id=last_message.author_id
 WHERE auth.uid() IS NOT NULL AND r.org_id=public.app_org_id() AND public.app_can_access_room(r.id)
 ORDER BY last_message.created_at DESC NULLS LAST,r.created_at;
$$;
REVOKE ALL ON FUNCTION public.my_room_directory() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.my_room_directory() TO authenticated;

-- A failed upload remains visible/removable on the author's unsent draft.
-- Existing generic file-link reads intentionally expose active files only.
CREATE POLICY memo_pending_attachment_owner_read ON public.operational_file_links
 FOR SELECT TO authenticated USING(
  org_id=public.app_org_id() AND context_type='memo_version'
  AND EXISTS(SELECT 1 FROM public.memo_versions v JOIN public.memos m ON m.id=v.memo_id
   WHERE v.id=context_id AND m.sender_id=auth.uid() AND v.sent_at IS NULL
    AND public.app_can_access_memo(m.id))
  AND EXISTS(SELECT 1 FROM public.operational_files f WHERE f.id=file_id
   AND f.org_id=public.app_org_id() AND f.uploaded_by=auth.uid() AND f.state='pending')
 );
