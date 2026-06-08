let layoutGeneration = 0;

export function bumpGalleryLayoutGeneration() {
  layoutGeneration += 1;
  return layoutGeneration;
}

export function getGalleryLayoutGeneration() {
  return layoutGeneration;
}

/** Wait for sticky header + grid positions to settle before measuring visibility. */
export function afterGalleryLayout(frames = 2) {
  return new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(frames);
  });
}
