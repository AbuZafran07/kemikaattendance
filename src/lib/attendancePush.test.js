import { test, expect } from 'bun:test';
import { drainAttendancePush } from '../../supabase/functions/_shared/attendance-push';
import { sendFcm } from '../../supabase/functions/_shared/fcm';
import postgres from 'postgres';
function fixture() {
 const row = { id:'notice-1',user_id:'employee-1',title:'Alasan disetujui',message:'Tidak dihitung pelanggaran',attendance_date:'2026-11-16',fcm_token:'device-test',push_claim:'claim-1' };
 let pushed=false, claimed=false, token=row.fcm_token;
 const store = {
  async claim(){ if(pushed||claimed||!token)return []; claimed=true;return [row]; },
  async finish(_,status){if(status==='sent')pushed=true;if(status==='unregistered')token=null;claimed=false;},
 };
 return {store, token:()=>token,pushed:()=>pushed};
}
test('automatic queue delivers a new employee notification once across two runs',async()=>{
 const f=fixture();let sends=0;
 const send=async(_t,_a,_b,data)=>{sends++;expect(data.path).toBe('/employee/attendance-history?date=2026-11-16');return {status:'sent',httpStatus:200};};
 expect((await drainAttendancePush(f.store,send)).sent).toBe(1);
 expect((await drainAttendancePush(f.store,send)).sent).toBe(0);
 expect(sends).toBe(1);expect(f.pushed()).toBe(true);
});
test('overlapping workers cannot claim the same notification',async()=>{
 const f=fixture();let sends=0;
 await Promise.all([drainAttendancePush(f.store,async()=>{sends++;await new Promise(r=>setTimeout(r,10));return {status:'sent',httpStatus:200};}),drainAttendancePush(f.store)]);
 expect(sends).toBe(1);
});
test('UNREGISTERED cleans the employee device token and is not marked successful',async()=>{
 const f=fixture();let sends=0;
 const send=async()=>{sends++;return {status:'unregistered',httpStatus:404};};
 expect((await drainAttendancePush(f.store,send)).unregistered).toBe(1);
 await drainAttendancePush(f.store,send);
 expect(f.token()).toBeNull();expect(f.pushed()).toBe(false);expect(sends).toBe(1);
});
test('FCM v1 uses message envelope and recognizes UNREGISTERED instead of success',async()=>{
 const fetcher=async(url,init)=>{
 expect(String(url)).toBe('https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send');
 const payload=JSON.parse(init.body);expect(payload.message.notification.title).toBe('Test');expect(payload.message.token).toBe('device-test');expect(payload.to).toBeUndefined();
 return new Response(JSON.stringify({error:{details:[{errorCode:'UNREGISTERED'}]}}),{status:404});
 };
 expect((await sendFcm('device-test','Test','Message',{},fetcher,{apiKey:'test-fixture',connectionKey:'test-fixture'})).status).toBe('unregistered');
});
test('provider failure leaves the notification retryable',async()=>{
 const f=fixture();expect((await drainAttendancePush(f.store,async()=>({status:'failed',httpStatus:503}))).failed).toBe(1);
 expect(f.pushed()).toBe(false);
 expect((await drainAttendancePush(f.store,async()=>({status:'sent',httpStatus:200}))).sent).toBe(1);
});

test('real queue SQL preserves sent state, clears stale token, and preserves replacement tokens',async()=>{
 const sql=postgres(process.env.SUPABASE_DB_URL,{max:1,prepare:false});
 try { await sql.begin(async tx=>{
  await tx.unsafe(`CREATE TEMP TABLE profiles(id uuid,fcm_token text) ON COMMIT DROP;
   CREATE TEMP TABLE attendance_notifications(id uuid,user_id uuid,title text,message text,attendance_date date,target_role text,pushed_at timestamptz,push_claim uuid,push_claimed_until timestamptz,push_retry_after timestamptz,push_invalid_token text,push_skipped_at timestamptz,push_attempts integer NOT NULL DEFAULT 0,created_at timestamptz DEFAULT now()) ON COMMIT DROP;`);
  for(const name of ['claim_attendance_push','finish_attendance_push']) {
   const [fn]=await tx`SELECT pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=${name}`;
   await tx.unsafe(fn.definition.replaceAll('public.','pg_temp.').replace('SECURITY DEFINER','SECURITY INVOKER'));
  }
  await tx`INSERT INTO pg_temp.profiles VALUES('00000000-0000-0000-0000-000000000001','test-device')`;
  await tx`INSERT INTO pg_temp.attendance_notifications(id,user_id,title,message,target_role) VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Test','Test','employee')`;
  const [first]=await tx`SELECT * FROM pg_temp.claim_attendance_push()`;
  expect(first.id).toBe('00000000-0000-0000-0000-000000000002');
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
  await tx`SELECT pg_temp.finish_attendance_push(${first.id},${first.push_claim},${first.fcm_token},'sent')`;
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
  expect((await tx`SELECT pushed_at FROM pg_temp.attendance_notifications`)[0].pushed_at).not.toBeNull();
  await tx`UPDATE pg_temp.attendance_notifications SET pushed_at=NULL`;
  const [second]=await tx`SELECT * FROM pg_temp.claim_attendance_push()`;
  await tx`UPDATE pg_temp.profiles SET fcm_token='replacement-device'`;
  await tx`SELECT pg_temp.finish_attendance_push(${second.id},${second.push_claim},${second.fcm_token},'unregistered')`;
  expect((await tx`SELECT fcm_token FROM pg_temp.profiles`)[0].fcm_token).toBe('replacement-device');
  const [third]=await tx`SELECT * FROM pg_temp.claim_attendance_push()`;
  await tx`SELECT pg_temp.finish_attendance_push(${third.id},${third.push_claim},${third.fcm_token},'unregistered')`;
  expect((await tx`SELECT fcm_token FROM pg_temp.profiles`)[0].fcm_token).toBeNull();
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
 }); } finally { await sql.end(); }
});

test('monthly discipline audit permits server reactivation without a single attendance row',async()=>{
 const sql=postgres(process.env.SUPABASE_DB_URL,{max:1,prepare:false});
 try {
  const [column]=await sql`SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance_audit_logs' AND column_name='attendance_id'`;
  expect(column.is_nullable).toBe('YES');
 } finally { await sql.end(); }
});

async function withBoundedQueue(check) {
 const sql=postgres(process.env.SUPABASE_DB_URL,{max:1,prepare:false});
 try { await sql.begin(async tx=>{
  await tx.unsafe(`CREATE TEMP TABLE profiles(id uuid,fcm_token text) ON COMMIT DROP;
   CREATE TEMP TABLE attendance_notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,title text DEFAULT 'Test',message text DEFAULT 'Test',attendance_date date,target_role text DEFAULT 'employee',pushed_at timestamptz,push_claim uuid,push_claimed_until timestamptz,push_retry_after timestamptz,push_invalid_token text,push_skipped_at timestamptz,push_attempts integer NOT NULL DEFAULT 0,created_at timestamptz DEFAULT '2026-11-16 09:00:00+00') ON COMMIT DROP;`);
  const [fn]=await tx`SELECT pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='claim_attendance_push'`;
  await tx.unsafe(fn.definition.replaceAll('public.','pg_temp.').replace('SECURITY DEFINER','SECURITY INVOKER').replaceAll('clock_timestamp()',"'2026-11-16 09:00:00+00'::timestamptz"));
  await tx`INSERT INTO pg_temp.profiles VALUES('00000000-0000-0000-0000-000000000001','test-device')`;
  await check(tx);
 }); } finally { await sql.end(); }
}

test('queue sends a 24-hour-old notice but skips anything older, even without a device',async()=>{
 await withBoundedQueue(async tx=>{
  await tx.unsafe(`INSERT INTO pg_temp.attendance_notifications(user_id,title,created_at) VALUES
   ('00000000-0000-0000-0000-000000000001','boundary','2026-11-15 09:00:00+00'),
   ('00000000-0000-0000-0000-000000000001','old','2026-11-15 08:59:59+00'),
   ('00000000-0000-0000-0000-000000000099','no-device-old','2026-11-14 09:00:00+00'),
   ('00000000-0000-0000-0000-000000000001','future','2026-11-16 09:00:01+00');`);
  const rows=await tx`SELECT * FROM pg_temp.claim_attendance_push()`;
  expect(rows.map(r=>r.title)).toEqual(['boundary']);
  const skipped=await tx`SELECT title,pushed_at,push_attempts FROM pg_temp.attendance_notifications WHERE push_skipped_at IS NOT NULL ORDER BY title`;
  expect(skipped.map(r=>r.title)).toEqual(['no-device-old','old']);
  for(const row of skipped){expect(row.pushed_at).toBeNull();expect(row.push_attempts).toBe(0);}
 });
});

test('queue permits five attempts exactly and never a sixth across repeated runs',async()=>{
 await withBoundedQueue(async tx=>{
  await tx`INSERT INTO pg_temp.attendance_notifications(user_id) VALUES('00000000-0000-0000-0000-000000000001')`;
  for(let attempt=1;attempt<=5;attempt++){
   expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(1);
   expect((await tx`SELECT push_attempts FROM pg_temp.attendance_notifications`)[0].push_attempts).toBe(attempt);
   expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
   await tx`UPDATE pg_temp.attendance_notifications SET push_claim=NULL,push_claimed_until=NULL,push_retry_after=NULL`;
  }
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
  const [row]=await tx`SELECT push_attempts,push_skipped_at,pushed_at FROM pg_temp.attendance_notifications`;
  expect(row.push_attempts).toBe(5);expect(row.push_skipped_at).not.toBeNull();expect(row.pushed_at).toBeNull();
 });
});

test('age or attempts exhaustion cannot revoke an active sender lease',async()=>{
 await withBoundedQueue(async tx=>{
  await tx.unsafe(`INSERT INTO pg_temp.attendance_notifications(user_id,created_at,push_attempts,push_claim,push_claimed_until) VALUES('00000000-0000-0000-0000-000000000001','2026-11-14 09:00:00+00',5,gen_random_uuid(),'2026-11-16 09:20:00+00');`);
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
  expect((await tx`SELECT push_skipped_at FROM pg_temp.attendance_notifications`)[0].push_skipped_at).toBeNull();
  await tx`UPDATE pg_temp.attendance_notifications SET push_claimed_until='2026-11-16 08:59:59+00'`;
  expect(await tx`SELECT * FROM pg_temp.claim_attendance_push()`).toHaveLength(0);
  const [row]=await tx`SELECT push_skipped_at,push_claim FROM pg_temp.attendance_notifications`;
  expect(row.push_skipped_at).not.toBeNull();expect(row.push_claim).toBeNull();
 });
});
