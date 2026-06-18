
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_super_admin(uuid) from public, anon;
revoke execute on function public.get_user_org(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid, uuid) from public, anon;
revoke execute on function public.tasks_completed_by_period(int) from public, anon;
revoke execute on function public.touch_updated_at() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
