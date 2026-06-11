import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildHash,
  readHashRoute,
  writeHashRoute,
  type AppRoute,
  type DossierSection,
} from "../library/hash-route";

const DEFAULT_ITEM_ROUTE: Extract<AppRoute, { tab: "item" }> = {
  tab: "item",
  itemId: "Weapon_Sword_Copper",
  section: "recipes",
};

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() => readHashRoute());
  const lastItemRef = useRef<Extract<AppRoute, { tab: "item" }>>(
    route.tab === "item" ? route : DEFAULT_ITEM_ROUTE,
  );

  useEffect(() => {
    const onHashChange = () => {
      const next = readHashRoute();
      if (next.tab === "item") lastItemRef.current = next;
      setRoute(next);
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) writeHashRoute(readHashRoute(), true);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: AppRoute, replace = false) => {
    if (next.tab === "item") lastItemRef.current = next;
    setRoute(next);
    writeHashRoute(next, replace);
  }, []);

  const focusItem = useCallback((itemId: string, section: DossierSection = "recipes") => {
    navigate({ tab: "item", itemId, section });
  }, [navigate]);

  const openSearch = useCallback((pattern: string) => {
    navigate({ tab: "search", pattern });
  }, [navigate]);

  const openBench = useCallback((benchId: string) => {
    navigate({ tab: "bench", benchId });
  }, [navigate]);

  const setTab = useCallback((tab: AppRoute["tab"]) => {
    if (tab === "bench") navigate({ tab: "bench" });
    else if (tab === "search") {
      navigate({
        tab: "search",
        pattern: route.tab === "search" ? route.pattern : "",
      });
    } else {
      navigate(lastItemRef.current);
    }
  }, [navigate, route]);

  const setDossierSection = useCallback((section: DossierSection) => {
    if (route.tab !== "item") return;
    navigate({ ...route, section });
  }, [navigate, route]);

  return {
    route,
    navigate,
    focusItem,
    openSearch,
    openBench,
    setTab,
    setDossierSection,
    hash: buildHash(route),
  };
}
