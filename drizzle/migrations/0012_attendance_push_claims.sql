ALTER TABLE public.attendance_notifications ADD COLUMN IF NOT EXISTS push_claim uuid, ADD COLUMN IF NOT EXISTS push_claimed_until timestamptz, ADD COLUMN IF NOT EXISTS push_retry_after timestamptz, ADD COLUMN IF NOT EXISTS push_invalid_token text;
CREATE INDEX IF NOT EXISTS attendance_push_pending ON public.attendance_notifications(created_at) WHERE target_role='employee' AND pushed_at IS NULL;
CREATE OR REPLACE FUNCTION public.claim_attendance_push()
RETURNS TABLE(id uuid,user_id uuid,title text,message text,attendance_date date,fcm_token text,push_claim uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY
 WITH candidates AS (
 SELECT n.id FROM public.attendance_notifications n JOIN public.profiles p ON p.id=n.user_id
 WHERE n.target_role='employee' AND n.pushed_at IS NULL AND NULLIF(p.fcm_token,'') IS NOT NULL
 AND (n.push_claimed_until IS NULL OR n.push_claimed_until<clock_timestamp())
 AND (n.push_retry_after IS NULL OR n.push_retry_after<clock_timestamp())
 AND p.fcm_token IS DISTINCT FROM n.push_invalid_token
 ORDER BY n.created_at LIMIT 50 FOR UPDATE OF n SKIP LOCKED
 ), claimed AS (
 UPDATE public.attendance_notifications n SET push_claim=gen_random_uuid(),push_claimed_until=clock_timestamp()+interval '20 minutes'
 FROM candidates c WHERE n.id=c.id RETURNING n.*
 ) SELECT c.id,c.user_id,c.title,c.message,c.attendance_date,p.fcm_token,c.push_claim FROM claimed c JOIN public.profiles p ON p.id=c.user_id;
END $$;
CREATE OR REPLACE FUNCTION public.finish_attendance_push(p_id uuid,p_claim uuid,p_token text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;
BEGIN
 IF p_status NOT IN ('sent','unregistered','failed') THEN RAISE EXCEPTION 'Invalid push status'; END IF;
 SELECT n.user_id INTO v_user FROM public.attendance_notifications n WHERE n.id=p_id AND n.push_claim=p_claim AND n.pushed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Push claim expired or completed'; END IF;
 IF p_status='unregistered' THEN
 UPDATE public.profiles SET fcm_token=NULL WHERE id=v_user AND fcm_token=p_token;
 END IF;
 UPDATE public.attendance_notifications SET
 pushed_at=CASE WHEN p_status='sent' THEN clock_timestamp() ELSE pushed_at END,
 push_invalid_token=CASE WHEN p_status='unregistered' THEN p_token ELSE push_invalid_token END,
 push_claim=NULL,push_claimed_until=NULL,
 push_retry_after=CASE WHEN p_status='failed' THEN clock_timestamp()+interval '5 minutes' ELSE NULL END
 WHERE id=p_id AND push_claim=p_claim;
END $$;
REVOKE ALL ON FUNCTION public.claim_attendance_push() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_attendance_push(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_attendance_push(),public.finish_attendance_push(uuid,uuid,text,text) TO service_role;