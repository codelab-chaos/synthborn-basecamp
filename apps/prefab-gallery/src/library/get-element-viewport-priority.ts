import { getElementViewportIntersection } from "./gallery-viewport-bounds";

/** Lower value = higher priority for WebGL slot assignment. */
export function getElementViewportPriority(element: HTMLElement) {
  const { rect, bounds, ratio, intersects } = getElementViewportIntersection(element, 0);

  if (!intersects || ratio <= 0.01) {
    const distanceBelow = Math.max(0, rect.top - bounds.bottom);
    const distanceAbove = Math.max(0, bounds.top - rect.bottom);
    const offscreenDistance = Math.min(distanceBelow, distanceAbove);
    return 10_000 + offscreenDistance;
  }

  const centerY = (Math.max(bounds.top, rect.top) + Math.min(bounds.bottom, rect.bottom)) / 2;
  return centerY - ratio * 1_000;
}
