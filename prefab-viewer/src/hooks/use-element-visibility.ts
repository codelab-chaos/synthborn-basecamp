import { useEffect, useState } from "react";
import {
  afterGalleryLayout,
  bumpGalleryLayoutGeneration,
  getGalleryLayoutGeneration,
} from "../library/gallery-layout";
import { isElementInViewport } from "../library/is-element-in-viewport";
import { reconcileWebglPreviewSlots } from "../library/webgl-preview-slots";
import {
  bindVisibilityPollActivity,
  getVisibilityPollIntervalMs,
  subscribeVisibilityPollWake,
} from "../library/visibility-poll-schedule";

type UseElementVisibilityOptions = {
  /** Strict clip only — no preload margin (margin caused off-screen slot steals). */
  rootMarginPx?: number;
  enabled?: boolean;
  hideAfterMisses?: number;
};

function resolveVisibilityTarget(element: HTMLElement) {
  return element.closest<HTMLElement>(".prefab-card__preview-wrap") ?? element;
}

export function useElementVisibility(
  element: HTMLElement | null,
  options: UseElementVisibilityOptions = {},
) {
  const { rootMarginPx = 0, enabled = true, hideAfterMisses = 2 } = options;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !element) {
      setVisible(false);
      return;
    }

    bindVisibilityPollActivity();

    let cancelled = false;
    let timerId = 0;
    let missStreak = 0;
    let layoutGeneration = getGalleryLayoutGeneration();
    let sampling = false;

    const sample = () => {
      if (cancelled || !element.isConnected || sampling) return;

      const target = resolveVisibilityTarget(element);
      const nextVisible = isElementInViewport(target, rootMarginPx);

      if (nextVisible) {
        missStreak = 0;
        setVisible(true);
      } else {
        missStreak += 1;
        if (missStreak >= hideAfterMisses) setVisible(false);
      }

      reconcileWebglPreviewSlots();
    };

    const schedule = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        sample();
        if (!cancelled) schedule();
      }, getVisibilityPollIntervalMs());
    };

    const wake = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        sample();
        if (!cancelled) schedule();
      }, 0);
    };

    const startSampling = async () => {
      sampling = true;
      await afterGalleryLayout(2);
      sampling = false;
      if (cancelled || layoutGeneration !== getGalleryLayoutGeneration()) return;
      sample();
      schedule();
    };

    void startSampling();
    const unsubscribeWake = subscribeVisibilityPollWake(wake);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      unsubscribeWake();
    };
  }, [element, enabled, hideAfterMisses, rootMarginPx]);

  return visible;
}

export function resetGalleryVisibilityLayout() {
  bumpGalleryLayoutGeneration();
}
