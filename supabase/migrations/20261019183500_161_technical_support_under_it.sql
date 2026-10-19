-- Stage 2 owner organisation correction: Technical Support is an IT department.
-- Preserve the existing SUP unit ID, its manager, memberships, work, files and history.
-- Only act when an unambiguous exact Technical Support unit exists under Media and Technical.
-- Idempotent; no new HR, Compliance, Executive, Support or finance authority.
DO $stage2$
DECLARE
  target record;
  new_parent uuid;
  candidate_count integer;
  already_count integer;
BEGIN
  FOR target IN
    SELECT s.id AS support_id, s.org_id, s.parent_id
      FROM public.units s
      JOIN public.units old ON old.id=s.parent_id AND old.org_id=s.org_id
      WHERE lower(s.name)='technical support' AND s.code='SUP'
        AND lower(old.name)='media and technical'
        AND s.active
  LOOP
    SELECT count(*) INTO candidate_count FROM public.units u
      WHERE u.org_id=target.org_id
        AND (lower(u.name)='it' OR lower(u.name)='information technology' OR u.code='IT')
        AND u.active;
    IF candidate_count>1 THEN
      RAISE EXCEPTION 'Multiple competing IT units exist; manual organisational reconciliation required.';
    END IF;
    SELECT u.id INTO new_parent FROM public.units u
      WHERE u.org_id=target.org_id
        AND (lower(u.name)='it' OR lower(u.name)='information technology' OR u.code='IT')
        AND u.active
      LIMIT 1;
    IF new_parent IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.units WHERE org_id=target.org_id AND code='IT') THEN
        RAISE EXCEPTION 'Inactive/conflicting IT code exists; do not silently repurpose a department.';
      END IF;
      INSERT INTO public.units(org_id,name,code,active,review_mode)
      VALUES(target.org_id,'IT','IT',true,'task_review')
      RETURNING id INTO new_parent;
    END IF;
    IF new_parent=target.support_id THEN RAISE EXCEPTION 'Circular Technical Support parent invalid.'; END IF;
    -- Changing only the hierarchy retains every existing referenced unit ID.
    UPDATE public.units SET parent_id=new_parent
      WHERE id=target.support_id AND org_id=target.org_id
        AND parent_id IS NOT DISTINCT FROM target.parent_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Concurrent Technical Support parent modification.'; END IF;
  END LOOP;
  -- No fixture/unit present: safe no-op in isolated empty test databases.
END;
$stage2$;
