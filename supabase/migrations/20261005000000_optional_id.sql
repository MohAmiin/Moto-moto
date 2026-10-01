-- For the pilot, drivers register with a face photo and plate; the ID number and ID photo are optional.
-- Safe to run more than once.
alter table public.rider_applications alter column id_number drop not null;
