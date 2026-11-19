-- Activate the cut-off for sessions that began earlier today; do not touch historical days.
update private.work_session_cutoff_activation
set activated_at=least(activated_at, (((now() at time zone 'Africa/Accra')::date)::timestamp at time zone 'Africa/Accra'))
where singleton;
