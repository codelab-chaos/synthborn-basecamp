export type GalleryViewportBounds = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

/** Scroll-visible content area below the sticky gallery header. */
export function getGalleryViewportBounds(): GalleryViewportBounds {
  const header = document.querySelector<HTMLElement>(".gallery-header");
  const headerRect = header?.getBoundingClientRect();
  const headerBottom = headerRect ? headerRect.bottom : 0;
  const viewWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewHeight = window.innerHeight || document.documentElement.clientHeight;
  const top = Math.max(0, Math.min(headerBottom, viewHeight));
  const bottom = viewHeight;

  return {
    top,
    left: 0,
    right: viewWidth,
    bottom,
    width: viewWidth,
    height: Math.max(0, bottom - top),
  };
}

export function getElementViewportIntersection(
  element: HTMLElement,
  rootMarginPx = 0,
  bounds = getGalleryViewportBounds(),
) {
  const rect = element.getBoundingClientRect();
  const clipTop = bounds.top - rootMarginPx;
  const clipBottom = bounds.bottom + rootMarginPx;
  const clipLeft = bounds.left - rootMarginPx;
  const clipRight = bounds.right + rootMarginPx;

  const visibleLeft = Math.max(clipLeft, rect.left);
  const visibleRight = Math.min(clipRight, rect.right);
  const visibleTop = Math.max(clipTop, rect.top);
  const visibleBottom = Math.min(clipBottom, rect.bottom);

  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = Math.max(1, rect.width * rect.height);

  return {
    rect,
    bounds,
    visibleArea,
    totalArea,
    ratio: visibleArea / totalArea,
    intersects: visibleArea > 0,
  };
}
