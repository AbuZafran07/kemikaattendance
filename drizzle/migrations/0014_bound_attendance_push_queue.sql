ALTER TABLE public.attendance_notifications ADD COLUMN IF NOT EXISTS push_skipped_at timestamptz, ADD COLUMN IF NOT EXISTS push_attempts integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.claim_attendance_push()
RETURNS TABLE(id uuid,user_id uuid,title text,message text,attendance_date date,fcm_token text,push_claim uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_now timestamptz := clock_timestamp();
BEGIN
 WITH expired AS (
 SELECT n.id FROM public.attendance_notifications n
 WHERE n.target_role='employee' AND n.pushed_at IS NULL AND n.push_skipped_at IS NULL
 AND (n.created_at < v_now-interval '24 hours' OR n.push_attempts >= 5)
 AND (n.push_claimed_until IS NULL OR n.push_claimed_until < v_now)
 FOR UPDATE OF n SKIP LOCKED
 ) UPDATE public.attendance_notifications n SET push_skipped_at=v_now,push_claim=NULL,push_claimed_until=NULL,push_retry_after=NULL FROM expired e WHERE n.id=e.id;
 RETURN QUERY
 WITH candidates AS (
 SELECT n.id FROM public.attendance_notifications n JOIN public.profiles p ON p.id=n.user_id
 WHERE n.target_role='employee' AND n.pushed_at IS NULL AND n.push_skipped_at IS NULL
 AND n.created_at >= v_now-interval '24 hours' AND n.created_at <= v_now AND n.push_attempts < 5
 AND NULLIF(p.fcm_token,'') IS NOT NULL
 AND (n.push_claimed_until IS NULL OR n.push_claimed_until < v_now)
 AND (n.push_retry_after IS NULL OR n.push_retry_after < v_now)
 AND p.fcm_token IS DISTINCT FROM n.push_invalid_token
 ORDER BY n.created_at LIMIT 50 FOR UPDATE OF n SKIP LOCKED
 ), claimed AS (
 UPDATE public.attendance_notifications n SET push_claim=gen_random_uuid(),push_claimed_until=v_now+interval '20 minutes',push_attempts=n.push_attempts+1
 FROM candidates c WHERE n.id=c.id RETURNING n.*
 ) SELECT c.id,c.user_id,c.title,c.message,c.attendance_date,p.fcm_token,c.push_claim FROM claimed c JOIN public.profiles p ON p.id=c.user_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_attendance_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_attendance_push() TO service_role;
COMMENT ON COLUMN public.attendance_notifications.push_attempts IS 'Incremented atomically on each leased claim; maximum five claims per notification.';
COMMENT ON COLUMN public.attendance_notifications.push_skipped_at IS 'Terminal push-only skip for notifications older than 24 hours or exhausted attempts; in-app notice remains visible.';