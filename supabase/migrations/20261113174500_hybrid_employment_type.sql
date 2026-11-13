-- Hybrid is a selectable HR classification. Existing employment records,
-- payroll rules and attendance patterns are retained.
alter table public.employee_roster
  drop constraint employee_roster_employment_type_check,
  add constraint employee_roster_employment_type_check
    check (employment_type in ('permanent', 'fixed_term', 'hybrid', 'volunteer', 'not_recorded'));

-- Extend the two existing roster RPC validations without altering their HR
-- authorization, audit trail, or grants. Stop if a definition has drifted.
do $migration$
declare
  function_id regprocedure;
  definition text;
  old_types constant text := '(''permanent'',''fixed_term'',''volunteer'',''not_recorded'')';
  new_types constant text := '(''permanent'',''fixed_term'',''hybrid'',''volunteer'',''not_recorded'')';
begin
  foreach function_id in array array[
    'public.admin_create_roster_employee(text,text,text,text,text,uuid,uuid[],uuid,text,text,date,text,boolean)'::regprocedure,
    'public.admin_record_roster_employment(uuid,timestamp with time zone,text,text,text,text,text,uuid,uuid[],uuid,text)'::regprocedure
  ] loop
    definition := pg_get_functiondef(function_id);
    if (length(definition) - length(replace(definition, old_types, ''))) <> length(old_types) then
      raise exception 'Unexpected employment type validation in %', function_id;
    end if;
    execute replace(definition, old_types, new_types);
  end loop;
end
$migration$;
