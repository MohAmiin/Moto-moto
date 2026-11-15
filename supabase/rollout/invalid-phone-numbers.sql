-- Read-only: accounts whose number isn't a full 9-digit national number after +252 (for example from
-- before new accounts needed 9 digits). Changes nothing. Ask the owner for the right number, then use
-- "Correct phone number" in the admin app (admin_change_phone), which makes riders confirm it again.
-- Never change a number without the owner: the number is how they sign in and how customers call them.
-- Runs both before and after the 2026-10 migrations (it reads only columns that exist in both).
select p.id, p.full_name, p.role, p.phone, length(regexp_replace(p.phone, '^252', '')) as national_digits,
       a.rider_number, a.status, p.created_at
from public.profiles p
left join public.rider_applications a on a.user_id = p.id
where p.phone is not null and p.phone !~ '^252[1-9][0-9]{8}$'
order by p.created_at;
