import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker(windows = []) {
 const handlers = {};
 const displayed = [];
 const opened = [];
 let config, background;
 const self = {
  location: { origin: 'https://kemikaattendance.web.id' },
  addEventListener: (name, handler) => { handlers[name] = handler; },
  registration: { showNotification: async (...args) => { displayed.push(args); } },
  clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url); } }
 };
 vm.runInNewContext(readFileSync(new URL('../../public/firebase-messaging-sw.js', import.meta.url), 'utf8'), {
  self, URL, importScripts: () => {},
  firebase: { initializeApp: value => { config = value; }, messaging: () => ({ onBackgroundMessage: handler => { background = handler; } }) }
 });
 return { config, displayed, opened, handlers, background, async click(data) {
  let completed;
  handlers.notificationclick({ notification: { data, close() {} }, stopImmediatePropagation() {}, waitUntil: promise => { completed = promise; } });
  await completed;
 } };
}

test('closed-tab worker initializes immediately and leaves notification display to Firebase', async () => {
 const w = worker();
 expect(w.config.projectId).toBe('hris-kemika');
 expect(w.handlers.message).toBeUndefined();
 await w.background({ notification: { title: 'Test' }, data: { path: '/employee/attendance-history?date=2026-11-16' } });
 expect(w.displayed).toHaveLength(0);
 await w.click({ FCM_MSG: { data: { path: '/employee/attendance-history?date=2026-11-16' } } });
 expect(w.opened).toEqual(['https://kemikaattendance.web.id/employee/attendance-history?date=2026-11-16']);
});

test('notification click focuses an existing app window then navigates to the correct date', async () => {
 const actions = [];
 const w = worker([{ url: 'https://kemikaattendance.web.id/employee', focus: async () => actions.push('focus'), navigate: async url => actions.push(url) }]);
 await w.click({ FCM_MSG: { data: { path: '/employee/attendance-history?date=2026-11-15' } } });
 expect(actions).toEqual(['focus', 'https://kemikaattendance.web.id/employee/attendance-history?date=2026-11-15']);
 expect(w.opened).toHaveLength(0);
});

test('missing or external click destinations fall back to employee notifications', async () => {
 const w = worker();
 await w.click({});
 await w.click({ path: 'https://other.example/private' });
 expect(w.opened).toEqual(Array(2).fill('https://kemikaattendance.web.id/employee/notifications'));
});