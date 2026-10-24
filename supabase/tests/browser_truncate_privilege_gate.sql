\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (has_table_privilege('anon',c.oid,'TRUNCATE')
        OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'A browser role retains public-table TRUNCATE authority';
  END IF;
END $$;

-- Synthetic, rollback-only fixture: never truncate a production/source table.
CREATE TABLE public.ceac_browser_truncate_gate_fixture(id integer PRIMARY KEY);
INSERT INTO public.ceac_browser_truncate_gate_fixture VALUES (1);
DO $$
BEGIN
  IF has_table_privilege('anon','public.ceac_browser_truncate_gate_fixture','TRUNCATE')
    OR has_table_privilege('authenticated','public.ceac_browser_truncate_gate_fixture','TRUNCATE') THEN
    RAISE EXCEPTION 'Future application tables regain browser TRUNCATE through defaults';
  END IF;
END $$;

-- Isolate TRUNCATE from row-level policies and ordinary row privileges.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ceac_browser_truncate_gate_fixture TO anon,authenticated;
GRANT SELECT,TRUNCATE ON public.ceac_browser_truncate_gate_fixture TO service_role;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    TRUNCATE public.ceac_browser_truncate_gate_fixture;
    RAISE EXCEPTION 'Anonymous table truncation succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    TRUNCATE public.ceac_browser_truncate_gate_fixture;
    RAISE EXCEPTION 'Authenticated table truncation succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO public.ceac_browser_truncate_gate_fixture VALUES (2);
  UPDATE public.ceac_browser_truncate_gate_fixture SET id=3 WHERE id=2;
  DELETE FROM public.ceac_browser_truncate_gate_fixture WHERE id=3;
  IF (SELECT count(*) FROM public.ceac_browser_truncate_gate_fixture)<>1 THEN
    RAISE EXCEPTION 'Denial changed existing rows or ordinary row operations failed';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
TRUNCATE public.ceac_browser_truncate_gate_fixture;
RESET ROLE;
ROLLBACK;
SELECT 'Browser TRUNCATE denial and future-table defaults gate passed' AS result;
