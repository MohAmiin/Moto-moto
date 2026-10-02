-- Areas are now Hargeisa's eight districts (degmooyin) instead of neighbourhoods.
-- Moves areas saved by earlier versions to their district. Safe to run more than once.
with legacy(area, district) as (values
  ('Haleeya', 'Macalin Haaruun'),
  ('Shiraaqle', 'Macalin Haaruun'),
  ('Hodan Hills', 'Macalin Haaruun'),
  ('Dooxa Weyn', '26 June'),
  ('Suuqa', '26 June'),
  ('Goljano', '26 June'),
  ('New Hargeysa', 'Gacan Libaax')
)
update public.profiles p set district = l.district from legacy l where p.district = l.area;

with legacy(area, district) as (values
  ('Haleeya', 'Macalin Haaruun'),
  ('Shiraaqle', 'Macalin Haaruun'),
  ('Hodan Hills', 'Macalin Haaruun'),
  ('Dooxa Weyn', '26 June'),
  ('Suuqa', '26 June'),
  ('Goljano', '26 June'),
  ('New Hargeysa', 'Gacan Libaax')
)
update public.rider_applications r set district = l.district from legacy l where r.district = l.area;
