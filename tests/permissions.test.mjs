import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { withTimeout, cameraReady, gpsHelp, gpsPosition } from '../src/permission-support.js';

test('unanswered optional permission has a bounded wait', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5, 'pending'), /pending/);
  assert.equal(await withTimeout(Promise.resolve('allowed'), 50, 'pending'), 'allowed');
});
test('camera requires actual webcam event and propagates denial', async () => {
  const handlers = {};
  const app = { webcam: { on: (event, callback) => { handlers[event] = callback; } } };
  const ready = cameraReady(app);
  handlers.webcamstarted({videoWidth: 640});
  assert.deepEqual(await ready, {videoWidth: 640});
  const failed = cameraReady({webcam: {on(event, callback) {
    if (event === 'webcamerror') queueMicrotask(() => callback(new Error('denied')));
  }}});
  await assert.rejects(failed, /denied/);
});
test('GPS help distinguishes policy restriction from device/site permission', () => {
  globalThis.window = {isSecureContext: true};
  globalThis.document = {featurePolicy: {allowsFeature: () => false}};
  assert.match(gpsHelp({code: 1}), /kebijakan/);
  globalThis.document = {};
  assert.match(gpsHelp({code: 1}), /layanan lokasi perangkat/);
  assert.match(gpsHelp({code: 3}), /area terbuka/);
});
test('GPS passes real coordinates and preserves native denial codes', async () => {
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {
    geolocation: {getCurrentPosition(resolve) {resolve({coords: {latitude: -8, longitude: 115}})}}
  }});
  assert.equal((await gpsPosition()).coords.latitude, -8);
  navigator.geolocation.getCurrentPosition = (_, reject) => reject({code: 1});
  await assert.rejects(gpsPosition(), error => error.code === 1);
});
test('production startup opens camera and starts GPS even if optional permissions hang', async () => {
  const code = readFileSync('assets/index-instiki-20261027-v011.js', 'utf8');
  const start = code.slice(code.indexOf('async function HM(){'), code.indexOf('function VM('));
  let gpsStarted = false;
  const context = {
    cameraNeedsReload:false, xa:false, Ca:{}, va:{}, Ut:null, ld:{hidden:false},
    ie:()=>({}), Ya:()=>({start:async()=>({})}), $M:()=>{},
    yM:()=>new Promise(()=>{}), cameraReady:async()=>{},
    rt:()=>{}, KM:()=>{}, VM:()=>{}, Rd:()=>{}, QM:async()=>{},
    GM:()=>{gpsStarted=true}, As:()=>{}, Zn:()=>'', en:{}, wr:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(start, context);
  await withTimeout(context.HM(), 100, 'startup blocked');
  assert.equal(gpsStarted,true);
  assert.equal(context.ld.hidden,true);
  assert.equal(context.Ca.disabled,false);
});
