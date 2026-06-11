import { reconcileWebglPreviewSlots } from "./webgl-preview-slots";

export type VisibilityPollSchedule = {
  fastIntervalMs: number;
  slowIntervalMs: number;
  scrollIdleMs: number;
};

const defaultSchedule: VisibilityPollSchedule = {
  fastIntervalMs: 120,
  slowIntervalMs: 2500,
  scrollIdleMs: 450,
};

let schedule = defaultSchedule;
let lastActivityAt = 0;
let activityBound = false;
let headerObserver: ResizeObserver | null = null;
const wakeListeners = new Set<() => void>();

export function configureVisibilityPollSchedule(patch: Partial<VisibilityPollSchedule>) {
  schedule = { ...schedule, ...patch };
}

export function getVisibilityPollIntervalMs(now = performance.now()) {
  return now - lastActivityAt < schedule.scrollIdleMs
    ? schedule.fastIntervalMs
    : schedule.slowIntervalMs;
}

export function markVisibilityPollActivity() {
  lastActivityAt = performance.now();
  reconcileWebglPreviewSlots();
  for (const listener of wakeListeners) listener();
}

export function subscribeVisibilityPollWake(listener: () => void) {
  wakeListeners.add(listener);
  return () => wakeListeners.delete(listener);
}

export function bindVisibilityPollActivity() {
  if (activityBound || typeof window === "undefined") return;
  activityBound = true;

  const onActivity = () => markVisibilityPollActivity();
  const options: AddEventListenerOptions = { passive: true, capture: true };

  window.addEventListener("scroll", onActivity, options);
  document.addEventListener("scroll", onActivity, options);
  window.addEventListener("wheel", onActivity, options);
  window.addEventListener("touchmove", onActivity, options);
  window.addEventListener("resize", onActivity, options);

  const header = document.querySelector(".gallery-header");
  if (header && typeof ResizeObserver !== "undefined") {
    headerObserver = new ResizeObserver(() => markVisibilityPollActivity());
    headerObserver.observe(header);
  }
}
