const MAX_ACTIVE_WEBGL_PREVIEWS = 4;
const OFFSCREEN_PRIORITY = 10_000;
const DEMOTE_REVOKE_STREAK = 3;

type SlotClient = {
  id: number;
  priority: () => number;
  onGrant: () => void;
  onRevoke: () => void;
};

let nextClientId = 0;
const clients = new Map<number, SlotClient>();
const granted = new Set<number>();
const demoteStreak = new Map<number, number>();
let reconcileQueued = false;

function revokeClient(id: number) {
  if (!granted.has(id)) return;
  granted.delete(id);
  demoteStreak.delete(id);
  clients.get(id)?.onRevoke();
}

function reconcileNow() {
  const ranked = [...clients.values()]
    .map((client) => ({ client, priority: client.priority() }))
    .filter((entry) => Number.isFinite(entry.priority) && entry.priority < OFFSCREEN_PRIORITY)
    .sort((a, b) => a.priority - b.priority);

  const shouldGrant = new Set(
    ranked.slice(0, MAX_ACTIVE_WEBGL_PREVIEWS).map((entry) => entry.client.id),
  );

  for (const id of [...granted]) {
    if (shouldGrant.has(id)) {
      demoteStreak.delete(id);
      continue;
    }

    const priority = clients.get(id)?.priority() ?? Number.POSITIVE_INFINITY;
    if (priority >= OFFSCREEN_PRIORITY) {
      revokeClient(id);
      continue;
    }

    const streak = (demoteStreak.get(id) ?? 0) + 1;
    demoteStreak.set(id, streak);
    if (streak >= DEMOTE_REVOKE_STREAK) {
      revokeClient(id);
    }
  }

  for (const id of shouldGrant) {
    if (granted.has(id)) continue;
    granted.add(id);
    demoteStreak.delete(id);
    clients.get(id)?.onGrant();
  }
}

export function reconcileWebglPreviewSlots() {
  if (reconcileQueued) return;
  reconcileQueued = true;
  requestAnimationFrame(() => {
    reconcileQueued = false;
    reconcileNow();
  });
}

export function getWebglPreviewSlotLimit() {
  return MAX_ACTIVE_WEBGL_PREVIEWS;
}

export function registerWebglPreviewSlotClient(
  priority: () => number,
  onGrant: () => void,
  onRevoke: () => void,
) {
  const id = ++nextClientId;
  clients.set(id, { id, priority, onGrant, onRevoke });
  reconcileWebglPreviewSlots();

  return () => {
    revokeClient(id);
    clients.delete(id);
    demoteStreak.delete(id);
    reconcileWebglPreviewSlots();
  };
}
