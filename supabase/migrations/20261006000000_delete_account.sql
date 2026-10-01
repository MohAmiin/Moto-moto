-- "Delete my account" (required by Google Play for apps with accounts). The app first removes the
-- user's photos from storage, then calls delete_my_account(), which deletes the login; the profile,
-- driver application, call records and PIN reset requests go with it. Safe to run more than once.

-- Drivers may delete their own ID photo (face photos could already be deleted).
drop policy if exists "riders delete own id photo" on storage.objects;
create policy "riders delete own id photo" on storage.objects for delete to authenticated
  using (bucket_id = 'rider-ids' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  -- Keep at least the owner in charge: admins are removed from the SQL editor instead.
  if is_admin() then raise exception 'admins cannot delete their own account in the app'; end if;

  -- Links that would otherwise block the delete (orders are from the earlier marketplace version).
  update rider_applications set reviewed_by = null where reviewed_by = v_uid;
  update pin_resets set reviewed_by = null where reviewed_by = v_uid;
  update orders set rider_id = null where rider_id = v_uid;
  delete from orders where customer_id = v_uid;

  -- Cascades to profiles, rider_applications, calls and pin_resets.
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
