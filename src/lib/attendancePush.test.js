import { test, expect } from 'bun:test';
import { drainAttendancePush } from '../../supabase/functions/_shared/attendance-push';
import { sendFcm } from '../../supabase/functions/_shared/fcm';
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
