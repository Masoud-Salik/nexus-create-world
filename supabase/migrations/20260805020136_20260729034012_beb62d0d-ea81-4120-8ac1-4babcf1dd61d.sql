-- E2 / M2.1 — durable job queue schema + claim function.

CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'done', 'failed', 'dead');

CREATE TABLE public.jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL,
  key          TEXT NOT NULL UNIQUE,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       public.job_status NOT NULL DEFAULT 'pending',
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  lease_until  TIMESTAMPTZ,
  next_run_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error   TEXT,
  trace_id     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-side only: no anon/authenticated grants, RLS on with zero policies.
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX jobs_claim_idx ON public.jobs (kind, next_run_at) WHERE status = 'pending';
CREATE INDEX jobs_lease_idx ON public.jobs (lease_until) WHERE status = 'running';
CREATE INDEX jobs_dead_idx  ON public.jobs (created_at DESC) WHERE status = 'dead';
CREATE INDEX jobs_kind_status_idx ON public.jobs (kind, status);

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotent enqueue: re-enqueueing the same logical work is a no-op.
CREATE OR REPLACE FUNCTION public.enqueue_job(
  _kind TEXT,
  _key TEXT,
  _payload JSONB DEFAULT '{}'::jsonb,
  _run_at TIMESTAMPTZ DEFAULT now(),
  _max_attempts INTEGER DEFAULT 5,
  _trace_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO public.jobs (kind, key, payload, next_run_at, max_attempts, trace_id)
  VALUES (_kind, _key, COALESCE(_payload, '{}'::jsonb), COALESCE(_run_at, now()),
          COALESCE(_max_attempts, 5), _trace_id)
  ON CONFLICT (key) DO NOTHING
  RETURNING id INTO job_id;

  IF job_id IS NULL THEN
    SELECT id INTO job_id FROM public.jobs WHERE key = _key;
  END IF;

  RETURN job_id;
END;
$$;

-- Transactional outbox: enqueue from inside another function's transaction.
CREATE OR REPLACE FUNCTION public.outbox_enqueue(
  _kind TEXT,
  _key TEXT,
  _payload JSONB DEFAULT '{}'::jsonb,
  _trace_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.enqueue_job(_kind, _key, _payload, now(), 5, _trace_id);
$$;

-- Claim work. FOR UPDATE SKIP LOCKED + a lease means two concurrent drains can
-- never take the same row. Expired leases are reclaimable.
CREATE OR REPLACE FUNCTION public.claim_jobs(
  _kind TEXT,
  _n INTEGER DEFAULT 10,
  _lease_seconds INTEGER DEFAULT 120
) RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT j.id
    FROM public.jobs j
    WHERE (_kind IS NULL OR j.kind = _kind)
      AND (
        (j.status = 'pending' AND j.next_run_at <= now())
        OR (j.status = 'running' AND j.lease_until IS NOT NULL AND j.lease_until < now())
      )
    ORDER BY j.next_run_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(COALESCE(_n, 10), 0)
  )
  UPDATE public.jobs j
  SET status = 'running',
      attempts = j.attempts + 1,
      lease_until = now() + make_interval(secs => GREATEST(COALESCE(_lease_seconds, 120), 5))
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_job(_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.jobs
  SET status = 'done', lease_until = NULL, last_error = NULL
  WHERE id = _id;
$$;

-- Exponential backoff (2^attempts minutes, capped at 60), dead-letter at the ceiling.
CREATE OR REPLACE FUNCTION public.fail_job(_id UUID, _error TEXT)
RETURNS public.job_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.jobs;
  new_status public.job_status;
  delay_minutes NUMERIC;
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
    delay_minutes := LEAST(power(2, j.attempts)::numeric, 60);
    UPDATE public.jobs
    SET status = 'pending',
        lease_until = NULL,
        last_error = left(COALESCE(_error, ''), 4000),
        next_run_at = now() + make_interval(mins => delay_minutes)
    WHERE id = _id;
  END IF;

  RETURN new_status;
END;
$$;

-- Backend services only.
REVOKE ALL ON FUNCTION public.enqueue_job(TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.outbox_enqueue(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_job(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_job(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.enqueue_job(TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.outbox_enqueue(TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_jobs(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_job(UUID, TEXT) TO service_role;
