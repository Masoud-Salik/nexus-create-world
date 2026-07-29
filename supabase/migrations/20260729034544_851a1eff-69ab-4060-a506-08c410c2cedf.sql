-- E2 / M2.3 — fix fail_job: make_interval(mins => ...) requires an integer, and
-- delay_minutes was NUMERIC, so every retry raised 42883 and no job could ever
-- be rescheduled. Use interval multiplication instead, plus +/-10% jitter so a
-- provider outage does not produce a synchronised retry stampede.
CREATE OR REPLACE FUNCTION public.fail_job(_id uuid, _error text)
RETURNS public.job_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.jobs;
  new_status public.job_status;
  delay_seconds NUMERIC;
BEGIN
  SELECT * INTO j FROM public.jobs WHERE id = _id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF j.attempts >= j.max_attempts THEN
    new_status := 'dead';
    UPDATE public.jobs
    SET status = 'dead', lease_until = NULL, last_error = left(COALESCE(_error, ''), 4000)
    WHERE id = _id;
  ELSE
    new_status := 'pending';
    -- 2^attempts minutes, capped at 60, with +/-10% jitter.
    delay_seconds := LEAST(power(2, j.attempts)::numeric, 60) * 60;
    delay_seconds := delay_seconds * (0.9 + random() * 0.2);
    UPDATE public.jobs
    SET status = 'pending',
        lease_until = NULL,
        last_error = left(COALESCE(_error, ''), 4000),
        next_run_at = now() + (delay_seconds * interval '1 second')
    WHERE id = _id;
  END IF;

  RETURN new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_job(uuid, text) TO service_role;