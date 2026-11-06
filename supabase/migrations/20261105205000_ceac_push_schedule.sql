-- Start the delivery schedule only after device opt-in; no calls without devices.
-- The URL and worker authentication token are resolved from encrypted Vault
-- values at execution time. Secrets are never committed to migration files.
do $setup$
begin
 if not exists(select 1 from cron.job where jobname like 'ceac-web-push-%' and jobname not like '%retention%') then
  perform cron.schedule('ceac-web-push-dispatch','*/5 * * * *',$task$
   select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='ceac_web_push_url'),
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-ceac-push-worker',(select decrypted_secret from vault.decrypted_secrets where name='ceac_web_push_worker_token')),
    body:='{}'::jsonb,timeout_milliseconds:=20000
   )
   where exists(select 1 from public.ceac_push_subscriptions where revoked_at is null)
    and exists(select 1 from vault.decrypted_secrets where name='ceac_web_push_url')
    and exists(select 1 from vault.decrypted_secrets where name='ceac_web_push_worker_token');
  $task$);
 end if;
 if not exists(select 1 from cron.job where jobname='ceac-web-push-retention') then
  perform cron.schedule('ceac-web-push-retention','15 3 * * *',$task$
    delete from public.ceac_push_jobs
      where (status in ('sent','failed','cancelled') and created_at<now()-interval '7 days')
         or expires_at<now()-interval '2 days';
    delete from public.ceac_push_subscriptions
      where revoked_at<now()-interval '30 days';
  $task$);
 end if;
end
$setup$;
