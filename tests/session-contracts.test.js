'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
test('service worker isolates caches, precaches runtime assets, and never returns HTML for missing JS', async () => {
  const handlers = {},
    deleted = [],
    cached = [];
  const cache = {
    addAll: async (paths) => cached.push(...paths),
    put: async () => {},
    match: async (path) => (path === './index.html' ? new Response('app shell') : null),
  };
  const ctx = vm.createContext({
    URL,
    Response,
    fetch: async () => {
      throw new Error('offline');
    },
    caches: {
      open: async () => cache,
      keys: async () => ['oly-v34', 'oly-revision6-v1', 'day-v16', 'unrelated'],
      delete: async (key) => deleted.push(key),
    },
    self: {
      registration: { scope: 'https://example.com/oly-tracker/' },
      addEventListener: (name, fn) => (handlers[name] = fn),
      skipWaiting() {},
      clients: { claim() {} },
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../sw.js'), 'utf8'), ctx);
  let pending;
  handlers.install({ waitUntil: (p) => (pending = p) });
  await pending;
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const paths = [...html.matchAll(/(?:src|href)="((?:js\/|styles)[^"]+)"/g)].map((x) => x[1]);
  paths.forEach((path) => assert.ok(cached.includes('./' + path), path + ' is precached'));
  handlers.activate({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.deepEqual(deleted, ['oly-v34', 'oly-revision6-v1']);
  let response;
  const request = (path, mode = 'cors') => ({
    request: { method: 'GET', url: 'https://example.com' + path, mode },
    respondWith: (p) => (response = p),
  });
  handlers.fetch(request('/oly-tracker/js/missing.js'));
  assert.equal((await response).type, 'error');
  handlers.fetch(request('/oly-tracker/', 'navigate'));
  assert.equal(await (await response).text(), 'app shell');
  response = null;
  handlers.fetch(request('/GymApp/js/app.js'));
  assert.equal(response, null);
});
test('sync will not adopt a prior-program state or interrupt a different active workout', () => {
  let writes = 0,
    status = '';
  const { MODEL } = require('../js/model');
  const ctx = vm.createContext({
    MODEL,
    STATE: { revision: 6, activeWorkout: { id: 'active' } },
    document: {
      addEventListener() {},
      getElementById() {
        return {
          set textContent(v) {
            status = v;
          },
        };
      },
    },
    window: { self: 1, top: 1 },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {
        writes++;
      },
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  vm.runInContext(fs.readFileSync(require.resolve('../js/sync'), 'utf8'), ctx);
  assert.equal(vm.runInContext('adoptRemote({state:{schemaVersion:3}})', ctx), false);
  assert.equal(writes, 0);
  assert.match(status, /Previous-program/);
  const next = MODEL.migrate({});
  ctx.remote = { state: next };
  assert.equal(vm.runInContext('adoptRemote(remote)', ctx), false);
  assert.equal(writes, 0);
  assert.match(status, /active workout/);
});
test('fresh devices pull existing cloud data; old cloud history is archived before publishing Revision 6', async () => {
  const { MODEL } = require('../js/model');
  let pulled = 0,
    pushed = 0,
    saved = 0;
  const state = MODEL.migrate({});
  state.ts = 200;
  const ctx = vm.createContext({
    MODEL,
    STATE: state,
    Date,
    JSON,
    setTimeout: () => 0,
    clearTimeout,
    setInterval,
    clearInterval,
    document: {
      addEventListener() {},
      getElementById() {
        return null;
      },
    },
    window: { self: 1, top: 1 },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    save() {
      saved++;
      return true;
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../js/sync'), 'utf8'), ctx);
  ctx.pull = () => {
    pulled++;
    return true;
  };
  ctx.push = async () => {
    pushed++;
  };
  ctx.remote = { ts: 100, state: { ...MODEL.migrate({}), pristine: false } };
  vm.runInContext(
    "syncToken=()=> 'fixture';stampLocalOly=()=>{};localOlyTs=()=>200;getRemote=async()=>remote;adoptRemote=pull;putRemote=push",
    ctx,
  );
  await vm.runInContext('syncNow()', ctx);
  assert.equal(pulled, 1);
  assert.equal(pushed, 0);
  ctx.STATE.pristine = false;
  const old = { maxes: { snatch: 155 }, log: { oldSession: { date: '2020-01-01' } } };
  ctx.remote = { ts: 100, state: old };
  await vm.runInContext('syncNow()', ctx);
  assert.equal(pushed, 1);
  assert.equal(saved, 1);
  assert.deepEqual(ctx.STATE.legacy, old);
  assert.equal(ctx.STATE.training.week, 1);
});
