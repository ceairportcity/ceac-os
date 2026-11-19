-- An announcement author may read their own draft; never call the restricted publisher RPC inside RLS.
-- Publication, editing and closing remain checked independently by SECURITY DEFINER RPCs.
alter policy announcements_read on public.announcements using
  ((org_id=public.app_org_id()) and
    (public.app_is_admin() or public.app_is_exec()
      or author_id=auth.uid()
      or private.can_read_announcement(id)));
alter policy announcement_audiences_read on public.announcement_audiences using
  (public.app_is_admin() or public.app_is_exec()
    or exists(select 1 from public.announcements a where a.id=announcement_id and a.author_id=auth.uid())
    or private.can_read_announcement(announcement_id));
