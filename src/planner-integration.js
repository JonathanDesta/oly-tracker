import { DriveSync, canonical } from "./cloud-sync.js";
import { GoogleAuth } from "./google-auth.js";
import {
  buildPlannerFeed,
  FEED_KEY,
  journalEntities,
  adoptJournalEntities,
  calibrationDefaults,
} from "./planner-feed.js";

const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function installPlannerIntegration({
  getState,
  applyState,
  changedView,
  message,
}) {
  let applying = false,
    lastVersion = -1,
    sync,
    feed,
    clientId = localStorage.getItem("oly_google_client_v1") || "";
  if (!clientId) {
    try {
      clientId =
        JSON.parse(localStorage.getItem("day_cache_v1"))?.settings
          ?.googleClientId ||
        JSON.parse(localStorage.getItem("planner_v2"))?.settings
          ?.googleClientId ||
        "";
    } catch {
      /* Optional credential migration. */
    }
  }
  const auth = new GoogleAuth({
    clientId,
    onChange: (error) => {
      if (error) message(error);
      else sync?.sync();
      status();
    },
  });
  function status() {
    document.querySelectorAll("[data-cloud-status]").forEach((e) => {
      e.textContent = sync?.status || "Saved on this device";
    });
    document.querySelectorAll("[data-cloud-conflicts]").forEach((e) => {
      e.hidden = !sync?.conflicts.length;
    });
  }
  function publish() {
    const state = getState();
    if (!state) return;
    feed = buildPlannerFeed(state);
    localStorage.setItem(FEED_KEY, JSON.stringify(feed));
    if (parent !== window) parent.postMessage(feed, location.origin);
  }
  try {
    sync = new DriveSync({
      app: "oly-v1",
      storage: localStorage,
      getSnapshot: () => journalEntities(getState()),
      hasLocalData: () =>
        getState().version > 0 ||
        getState().records.length > 0 ||
        getState().archives.length > 0,
      applySnapshot: async (entities) => {
        if (
          document.querySelector("dialog[open], form[data-cloud-dirty]") ||
          document.activeElement?.matches("input,textarea,select")
        )
          throw Error(
            "Cloud changes are ready. Finish editing, then sync to apply them.",
          );
        applying = true;
        try {
          applyState(adoptJournalEntities(getState(), entities));
          lastVersion = getState().version;
          publish();
        } finally {
          applying = false;
        }
      },
      getToken: () => auth.getToken(),
      onStatus: status,
    });
  } catch (e) {
    message(e.message);
  }
  const api = {
    changed() {
      if (!getState() || applying) return;
      if (lastVersion !== getState().version) {
        lastVersion = getState().version;
        try {
          publish();
          sync?.capture();
        } catch (e) {
          message(e.message);
        }
      }
    },
    mount(view) {
      api.changed();
      if (
        view === "workout" &&
        getState()?.active &&
        !document.getElementById("planner-interruption")
      ) {
        const section = document.createElement("section");
        section.className = "panel";
        section.id = "planner-interruption";
        section.innerHTML = `<label class="check"><input type="checkbox" data-timing-active ${getState().active.timingExcluded ? "checked" : ""}><span>This session had a deliberate non-training interruption</span></label><p class="fine-print">Exclude this duration from scheduling calibration. Your sets, rests, progress and journal remain unchanged.</p>`;
        document.getElementById("main").append(section);
      }
      if (
        view !== "settings" ||
        document.getElementById("planner-sync-settings")
      )
        return;
      const section = document.createElement("section");
      section.className = "panel";
      section.id = "planner-sync-settings";
      const s = getState(),
        c = s.calibration || calibrationDefaults();
      section.innerHTML = `<h2>Planner & device sync</h2><p data-cloud-status></p><p>Automatically sync this journal and training setup with Planner and the standalone app while open and connected. Use the same Google account and OAuth client ID in both apps.</p><label>Google OAuth client ID<input id="oly-cloud-client" value="${escape(auth.clientId)}" autocomplete="off"></label><div class="actions"><button class="button" data-cloud="connect">Connect Google</button><button class="quiet" data-cloud="sync">Sync now</button><button class="quiet" data-cloud="disconnect">Disconnect</button><button class="button" data-cloud="conflicts" data-cloud-conflicts hidden>Resolve sync conflicts</button></div><p class="fine-print">Offline edits stay on this device until the app reconnects. An expired Google connection needs a tap to reconnect. Training records are stored in private app-created Drive files.</p><h3>Scheduling calibration</h3><p>Introductory A starts from your reported 45 minutes, including warm-ups and rests. Matching completed sessions replace that seed using the median of the most recent five. Guided countdown allowances and training prescriptions stay unchanged.</p><p>Exclude sessions with deliberate non-training interruptions. Queuing, ordinary rests and warm-ups belong in the measurement.</p>${s.records
        .slice(-12)
        .reverse()
        .map(
          (r) =>
            `<label class="check"><input type="checkbox" data-timing-exclude="${escape(r.id)}" ${c.excludedRecordIds.includes(r.id) ? "checked" : ""}><span>Exclude ${escape(r.date)} · ${escape(r.session.title)} (${Math.round(((r.endedAt || r.startedAt) - r.startedAt) / 60000)} min) from calibration</span></label><label class="check"><input type="checkbox" data-timing-change="${escape(r.id)}" ${r.timingIncludesChange ? "checked" : ""}><span>That measurement already includes cooling down and changing</span></label>`,
        )
        .join("")}`;
      document.getElementById("main").prepend(section);
      status();
    },
  };
  function showConflicts() {
    const old = document.getElementById("cloud-conflict-dialog");
    old?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "cloud-conflict-dialog";
    dialog.innerHTML = `<h2>Choose the version to keep</h2><p>Both versions remain in revision history. Independent changes are merged automatically.</p>${(sync?.conflicts || []).map((c, index) => `<section><h3>${escape(c.key.startsWith("record:") ? "Training record" : c.key.startsWith("review:") ? "Review" : c.key)}</h3>${c.variants.map((v, i) => `<details><summary>Version ${i + 1} · ${escape(new Date(v.at).toLocaleString())}${v.writer === sync.meta.writer ? " · this device" : " · another device"}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto">${escape(v.deleted ? "Deleted" : JSON.stringify(v.value, null, 2))}</pre></details><button class="button" data-cloud-choice="${index}:${i}">Use version ${i + 1}</button>`).join("")}</section>`).join("") || "<p>No unresolved conflicts.</p>"}<form method="dialog"><button class="quiet">Close</button></form>`;
    document.body.append(dialog);
    dialog.showModal();
  }
  document.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-cloud],[data-cloud-choice]");
    if (!b) return;
    try {
      if (b.dataset.cloud === "connect") {
        auth.clientId = document
          .getElementById("oly-cloud-client")
          .value.trim();
        localStorage.setItem("oly_google_client_v1", auth.clientId);
        auth.connect();
      }
      if (b.dataset.cloud === "disconnect") {
        auth.disconnect();
        if (parent !== window)
          parent.postMessage({ type: "oly:disconnected" }, location.origin);
      }
      if (b.dataset.cloud === "sync") await sync?.sync();
      if (b.dataset.cloud === "conflicts") showConflicts();
      if (b.dataset.cloudChoice) {
        const [i, j] = b.dataset.cloudChoice.split(":").map(Number),
          c = sync.conflicts[i];
        document.getElementById("cloud-conflict-dialog").close();
        await sync.resolve(c.key, c.variants[j].revision);
        showConflicts();
      }
      status();
    } catch (e) {
      message(e.message);
    }
  });
  document.addEventListener("input", (event) => {
    const form = event.target.closest("form");
    if (form) form.dataset.cloudDirty = "true";
  });
  document.addEventListener("change", (event) => {
    const input = event.target,
      excluded = input.dataset.timingExclude,
      included = input.dataset.timingChange;
    const activeExcluded = input.hasAttribute("data-timing-active");
    if (!excluded && !included && !activeExcluded) return;
    try {
      const next = structuredClone(getState());
      next.calibration ||= calibrationDefaults();
      if (activeExcluded && next.active)
        next.active.timingExcluded = input.checked;
      if (excluded) {
        next.calibration.excludedRecordIds =
          next.calibration.excludedRecordIds.filter((id) => id !== excluded);
        if (input.checked) next.calibration.excludedRecordIds.push(excluded);
      }
      if (included)
        next.records.find((r) => r.id === included).timingIncludesChange =
          input.checked;
      applyState(next);
      api.changed();
    } catch (e) {
      message(e.message);
    }
  });
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== parent ||
      parent === window
    )
      return;
    if (event.data?.type === "planner:hello") {
      if (typeof event.data.clientId === "string" && event.data.clientId) {
        auth.clientId = event.data.clientId;
        localStorage.setItem("oly_google_client_v1", auth.clientId);
      }
      publish();
    }
    if (event.data?.type === "planner:disconnect") auth.disconnect();
    if (event.data?.type === "planner:token")
      auth.accept(event.data.token, event.data.expiresAt);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      publish();
      sync?.sync();
    }
  });
  window.addEventListener("online", () => sync?.sync());
  window.addEventListener("storage", (event) => {
    if (
      event.key === "oly_program_v7" &&
      !getState()?.active &&
      !document.querySelector("dialog[open]")
    )
      changedView();
  });
  setInterval(() => {
    if (!document.hidden && getState()?.active) publish();
  }, 15000);
  setInterval(() => {
    if (!document.hidden) sync?.sync();
  }, 60000);
  setTimeout(() => {
    api.changed();
    if (auth.getToken()) sync?.sync();
  }, 0);
  return api;
}
