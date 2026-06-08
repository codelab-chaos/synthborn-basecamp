import { getElementViewportIntersection } from "./gallery-viewport-bounds";

export function isElementInViewport(element: HTMLElement, rootMarginPx = 0) {
  return getElementViewportIntersection(element, rootMarginPx).intersects;
}
