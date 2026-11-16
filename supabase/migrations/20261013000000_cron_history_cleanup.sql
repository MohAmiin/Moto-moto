-- The request scheduler (advance-moto-requests) runs every 10 seconds, and pg_cron keeps a history row
-- for every run: about 8,600 a day. Keep two days of history, cleared once a day at 03:00 UTC.
-- Skipped on a database without pg_cron (a local test database).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-cron-history',
      '0 3 * * *',
      $job$delete from cron.job_run_details where end_time < now() - interval '2 days'$job$
    );
  end if;
end $$;
