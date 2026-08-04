'use strict';

// ─── Cloud sync (Google Drive) ────────────────────────────────────────────────
// Bridges this app's state across iOS PWA storage containers via one Drive file
// ("oly_sync.json", drive.file scope) shared with the Day life-manager app.
// Newest state wins, decided by the `ts` stamped into oly_state on every save.
//
// Token sources:
//   • Embedded in Day (iframe, same origin & container): reuse Day's cached
//     token from localStorage "day_google_tok" — zero setup, Day keeps it fresh.
//   • Standalone install: own GIS token client. Client ID is entered once in
//     Settings → Cloud Sync (same OAuth client as Day, so both apps can see
//     the same drive.file-scoped file).
//
// Bootstrap rule (first sync ever, when local data predates ts-stamping):
//   • Standalone: local wins — it's the historical source of truth. Stamp now,
//     push. • Embedded: it was always a mirror — never push unstamped data;
//     adopt the remote if one exists.

const SYNC_FILENAME = 'oly_sync.json';
const OLY_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const IS_EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

let olyTokenClient = null;
let olySilent = false;
let syncFileId = null;
let _pushTimer = null;
let _lastPullTs = 0;

// ── Credentials / token cache ─────────────────────────────────────────────────
function olyCid() { try { return (localStorage.getItem('oly_google_cid') || '').trim(); } catch (e) { return ''; } }
function olyLinked() { try { return localStorage.getItem('oly_google_linked') === '1'; } catch (e) { return false; } }
function setOlyLinked(v) { try { v ? localStorage.setItem('oly_google_linked', '1') : localStorage.removeItem('oly_google_linked'); } catch (e) {} }
function saveOlyToken(t, expSec) { try { localStorage.setItem('oly_google_tok', JSON.stringify({ t, exp: Date.now() + (expSec || 3600) * 1000 })); } catch (e) {} }
function readTokenRecord(key) {
  try {
    const o = JSON.parse(localStorage.getItem(key));
    if (o && o.t && o.exp && Date.now() < o.exp - 60000) return o.t;
  } catch (e) {}
  return null;
}
// Day's token (same-origin storage when embedded) or our own — whichever is live.
function syncToken() { return readTokenRecord('day_google_tok') || readTokenRecord('oly_google_tok'); }

// ── GIS (standalone only — embedded rides Day's session) ──────────────────────
function olyGisAvailable() { return !!(window.google && google.accounts && google.accounts.oauth2); }
function initOlyTokenClient() {
  if (olyTokenClient || !olyGisAvailable() || !olyCid()) return olyTokenClient;
  olyTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: olyCid(),
    scope: OLY_SCOPES,
    callback: (resp) => {
      if (resp && resp.access_token) {
        saveOlyToken(resp.access_token, resp.expires_in);
        setOlyLinked(true); olySilent = false;
        setSyncStatus('syncing…');
        syncNow();
      } else setSyncStatus('not connected');
    },
    error_callback: () => { if (!olySilent) alert('Google sign-in cancelled'); olySilent = false; setSyncStatus(olyLinked() ? 'tap Connect to re-sync' : 'not connected'); },
  });
  return olyTokenClient;
}
function connectOlyGoogle() {
  const cidInput = document.getElementById('sync-cid');
  if (cidInput && cidInput.value.trim()) { try { localStorage.setItem('oly_google_cid', cidInput.value.trim()); } catch (e) {} olyTokenClient = null; }
  if (syncToken()) { syncNow(); return; }
  if (!olyCid()) { alert('Paste the Google Client ID first (same one as in Day’s Settings).'); return; }
  if (!initOlyTokenClient()) { alert('Google library still loading — try again in a second.'); return; }
  setSyncStatus('connecting…');
  // Returning users skip the consent screen (popup self-closes with a live session).
  olyTokenClient.requestAccessToken({ prompt: olyLinked() ? '' : 'consent' });
}
function trySilentOlyConnect() {
  if (olySilent || IS_EMBEDDED) return false;
  if (!olyCid() || !olyLinked() || !initOlyTokenClient()) return false;
  olySilent = true;
  try { olyTokenClient.requestAccessToken({ prompt: '' }); return true; } catch (e) { olySilent = false; return false; }
}

// ── Local state helpers ───────────────────────────────────────────────────────
function localOlyRaw() { try { return JSON.parse(localStorage.getItem('oly_state')) || null; } catch (e) { return null; } }
function localOlyTs() { const s = localOlyRaw(); return (s && s.ts) || 0; }
// One-time bootstrap: standalone data saved before ts-stamping existed is the
// source of truth — stamp it "now" so the first sync pushes rather than adopts.
function stampLocalOly() {
  const s = localOlyRaw();
  if (!s || s.ts || IS_EMBEDDED) return;
  s.ts = Date.now();
  try { localStorage.setItem('oly_state', JSON.stringify(s)); } catch (e) {}
}

// ── Drive file CRUD ───────────────────────────────────────────────────────────
async function driveApi(url, opts, tok) {
  const r = await fetch(url, Object.assign({}, opts, {
    headers: Object.assign({ Authorization: 'Bearer ' + tok }, (opts && opts.headers) || {}),
  }));
  if (r.status === 401) { try { localStorage.removeItem('oly_google_tok'); } catch (e) {} throw new Error('token expired'); }
  if (!r.ok) throw new Error('drive ' + r.status);
  return r;
}
async function findSyncFile(tok) {
  if (syncFileId) return syncFileId;
  const q = "name='" + SYNC_FILENAME + "' and trashed=false";
  const r = await driveApi('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&spaces=drive&fields=files(id)', {}, tok);
  const j = await r.json();
  syncFileId = (j.files && j.files.length) ? j.files[0].id : null;
  return syncFileId;
}
async function getRemote(tok) {
  if (!(await findSyncFile(tok))) return null;
  const r = await driveApi('https://www.googleapis.com/drive/v3/files/' + syncFileId + '?alt=media', {}, tok);
  return await r.json();
}
async function putRemote(tok) {
  const state = localOlyRaw();
  if (!state || !state.ts) return; // never publish unstamped data
  let durations = null;
  try { durations = JSON.parse(localStorage.getItem('oly_day_durations')); } catch (e) {}
  const body = JSON.stringify({ v: 1, ts: state.ts, state, durations });
  if (await findSyncFile(tok)) {
    await driveApi('https://www.googleapis.com/upload/drive/v3/files/' + syncFileId + '?uploadType=media',
      { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body }, tok);
  } else {
    const boundary = 'oly_' + Date.now();
    const multipart =
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: SYNC_FILENAME }) + '\r\n' +
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      body + '\r\n--' + boundary + '--';
    const r = await driveApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart }, tok);
    const j = await r.json();
    syncFileId = j.id;
  }
}

// ── Sync orchestration ────────────────────────────────────────────────────────
function adoptRemote(remote) {
  try { localStorage.setItem('oly_state', JSON.stringify(remote.state)); } catch (e) {}
  if (remote.durations && remote.durations.min) {
    try { localStorage.setItem('oly_day_durations', JSON.stringify(remote.durations)); } catch (e) {}
  }
  // Reload the running app from the adopted state. An authoritative remote
  // active session resumes in Workout; a removed/expired one cannot leave a
  // ghost Workout view behind.
  const keepView = STATE.view;
  load();
  publishDayDurations();
  STATE.view = STATE.activeWorkout ? 'workout' : (keepView === 'workout' ? 'home' : keepView);
  render();
  if (STATE.activeWorkout && typeof restoreRuntimeTimers === 'function') restoreRuntimeTimers();
}
async function syncNow() {
  const tok = syncToken();
  if (!tok) { setSyncStatus(IS_EMBEDDED ? 'waiting for Day’s Google sign-in' : (olyLinked() ? 'tap Connect to re-sync' : 'not connected')); return; }
  try {
    stampLocalOly();
    const remote = await getRemote(tok);
    const lts = localOlyTs();
    if (remote && remote.ts && remote.ts > lts) {
      adoptRemote(remote);
      setSyncStatus('synced ✓ (pulled ' + new Date(remote.ts).toLocaleString() + ')');
    } else if (lts && (!remote || !remote.ts || lts > remote.ts)) {
      await putRemote(tok);
      setSyncStatus('synced ✓ (pushed)');
    } else {
      setSyncStatus(lts ? 'synced ✓' : 'no data to sync yet');
    }
    _lastPullTs = Date.now();
  } catch (e) {
    setSyncStatus('offline · will retry');
  }
}
// Debounced push after every save() — see the hook in app.js.
function schedulePush() {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    const tok = syncToken();
    if (tok) putRemote(tok).then(() => setSyncStatus('synced ✓')).catch(() => setSyncStatus('offline · saved on device'));
    else if (!IS_EMBEDDED) trySilentOlyConnect(); // callback pushes via syncNow
  }, 3500);
}

// ── Settings UI ───────────────────────────────────────────────────────────────
function setSyncStatus(t) {
  const e = document.getElementById('sync-status');
  if (e) e.textContent = t;
}
function syncSettingsHTML() {
  if (IS_EMBEDDED) {
    return `
      <div class="settings-section">
        <div class="settings-label">Cloud Sync</div>
        <div class="settings-note">Synced through Day’s Google sign-in automatically. Status: <span id="sync-status">${syncToken() ? 'connected' : 'waiting for Day’s Google sign-in'}</span></div>
      </div>`;
  }
  return `
    <div class="settings-section">
      <div class="settings-label">Cloud Sync</div>
      <input type="text" id="sync-cid" class="form-input" placeholder="Google Client ID (…apps.googleusercontent.com)"
        value="${olyCid().replace(/"/g, '&quot;')}" autocapitalize="off" autocorrect="off">
      <button class="btn-outline btn-full" style="margin-top:8px" onclick="connectOlyGoogle()">Connect / Sync Google Drive</button>
      <div class="settings-note">Status: <span id="sync-status">${syncToken() ? 'connected' : (olyLinked() ? 'reconnecting on next sync' : 'not connected')}</span></div>
      <div class="settings-note">Uses the same Client ID as the Day app (Day → Settings → Google Client ID). Once connected, block/week/logs sync automatically with the copy inside Day — newest change wins.</div>
    </div>`;
}

// ── Boot & lifecycle ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // First sync attempt: embedded can go immediately off Day's token; the
  // standalone boot attempt is popup-blocked on iOS, so also retry on the
  // first few taps (a gesture allows the popup, which self-closes when a
  // Google session exists).
  setTimeout(() => {
    if (syncToken()) syncNow();
    else if (!IS_EMBEDDED && olyLinked()) {
      let tries = 0;
      const t = setInterval(() => {
        if (olyGisAvailable()) { clearInterval(t); trySilentOlyConnect(); }
        else if (++tries > 40) clearInterval(t);
      }, 250);
    }
  }, 300);
  let reauthTries = 0;
  document.addEventListener('pointerdown', () => {
    if (syncToken() || IS_EMBEDDED || !olyLinked() || reauthTries >= 3) return;
    if (trySilentOlyConnect()) reauthTries++;
  }, true);
  // Coming back to the app: pull if someone else may have pushed meanwhile.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && syncToken() && Date.now() - _lastPullTs > 60000) syncNow();
  });
});
