import { NOTIFICATION_SERVICE } from "./push-config.js";
const KEY = "oly_push_device_v1";
const bytes = (text) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
export class PushAlerts {
  constructor({
    storage = localStorage,
    navigator = globalThis.navigator,
    Notification = globalThis.Notification,
    fetch = globalThis.fetch.bind(globalThis),
    crypto = globalThis.crypto,
    service = NOTIFICATION_SERVICE,
    now = () => Date.now(),
  } = {}) {
    Object.assign(this, {
      storage,
      navigator,
      Notification,
      fetch,
      crypto,
      service,
      now,
    });
    try {
      const saved = JSON.parse(storage.getItem(KEY));
      this.device = /^[a-f0-9]{64}$/.test(saved?.token || "") ? saved : null;
    } catch {
      this.device = null;
    }
    this.status = this.device
      ? "Connected on this device."
      : "Background notifications are not connected on this device.";
    this.desired = null;
    this.sent = undefined;
    this.pending = false;
    this.retryAt = 0;
  }
  get supported() {
    return !!(
      this.Notification &&
      this.navigator.serviceWorker &&
      globalThis.PushManager
    );
  }
  save() {
    this.storage.setItem(KEY, JSON.stringify(this.device));
  }
  async request(path, body, { method = "PUT", pairing = "" } = {}) {
    const response = await this.fetch(this.service + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${path === "/register" ? this.device.token : this.device.credential}`,
        ...(pairing ? { "X-Pairing-Code": pairing } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      credentials: "omit",
      keepalive: true,
    });
    const value = await response.json();
    if (!response.ok)
      throw Error(value.error || "Notification connection failed.");
    return value;
  }
  async enable(pairing) {
    if (!this.service)
      throw Error("The notification service has not been deployed yet.");
    if (!this.supported)
      throw Error(
        "On iPhone, open Oly Tracker from its Home Screen icon to enable notifications.",
      );
    // Request permission directly from the button press, before any network wait.
    const permission = await this.Notification.requestPermission();
    if (permission !== "granted")
      throw Error(
        "Allow notifications for Oly Tracker in your phone settings, then reconnect.",
      );
    const registration = await this.navigator.serviceWorker.ready;
    const response = await this.fetch(this.service + "/config", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Notification service unavailable.");
    const { publicKey } = await response.json();
    let subscription = await registration.pushManager.getSubscription();
    if (
      subscription &&
      subscription.options?.applicationServerKey &&
      [...new Uint8Array(subscription.options.applicationServerKey)].join() !==
        [...bytes(publicKey)].join()
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ||= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes(publicKey),
    });
    const existing = this.device;
    this.device ||= {
      token: [...this.crypto.getRandomValues(new Uint8Array(32))]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join(""),
    };
    try {
      const connected = await this.request(
        "/register",
        { subscription: subscription.toJSON() },
        { method: "POST", pairing: pairing.trim() },
      );
      if (!connected.credential)
        throw Error("Notification connection was incomplete. Try again.");
      this.device.credential = connected.credential;
    } catch (error) {
      this.device = existing;
      throw error;
    }
    this.save();
    this.sent = undefined;
    this.retryAt = 0;
    this.status =
      "Connected on this device. Start a timer or send a test notification.";
  }
  async disable() {
    this.disconnecting = true;
    try {
      this.desired = null;
      // Drain a running update before revocation, so an old update cannot recreate it.
      if (this.operation) await this.operation;
      if (this.device)
        await this.request("/device", null, { method: "DELETE" });
      const registration = await this.navigator.serviceWorker.ready;
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      this.device = null;
      this.save();
      this.sent = undefined;
      this.status = "Background notifications are off on this device.";
    } finally {
      this.disconnecting = false;
    }
  }
  sync(target) {
    const desired = target
      ? { key: target.key, deadline: target.deadline }
      : null;
    if (JSON.stringify(this.desired) !== JSON.stringify(desired)) {
      this.desired = desired;
      this.retryAt = 0;
    }
    if (
      this.disconnecting ||
      !this.device ||
      this.pending ||
      this.now() < this.retryAt
    )
      return this.operation;
    if (this.Notification?.permission !== "granted") {
      this.status =
        "Notifications are blocked. Reconnect in Settings after allowing notifications.";
      return;
    }
    if (this.sent === (this.desired?.key || null)) return;
    // A timer never acknowledged by the service must not be scheduled after expiry.
    if (this.desired && this.desired.deadline <= this.now()) return;
    this.pending = true;
    const snapshot = this.desired,
      key = snapshot?.key || null;
    const revision = Math.max(
      this.now() * 1000 +
        (this.crypto.getRandomValues(new Uint16Array(1))[0] % 1000),
      Number(this.storage.getItem(KEY + ":revision") || 0) + 1,
    );
    this.storage.setItem(KEY + ":revision", String(revision));
    this.status = snapshot
      ? "Saving this countdown for background delivery…"
      : "Cancelling the previous background alert…";
    this.operation = this.request("/timer", {
      revision,
      timer: snapshot
        ? { id: this.crypto.randomUUID(), deadline: snapshot.deadline }
        : null,
    })
      .then((value) => {
        if (value.stale)
          throw Error(
            "Another app window changed the timer. Return to this workout and retry.",
          );
        this.sent = key;
        this.status = snapshot
          ? "Background alert saved for this countdown."
          : "Connected · no background alert scheduled.";
      })
      .catch((error) => {
        this.status = `Background alert not confirmed: ${error.message} Keep the app visible. A previously saved alert may still arrive.`;
        this.retryAt = this.now() + 5000;
      })
      .finally(() => {
        this.pending = false;
        if (key !== (this.desired?.key || null)) this.sync(this.desired);
      });
    return this.operation;
  }
}
