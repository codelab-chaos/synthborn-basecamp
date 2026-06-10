import { createContext, useContext } from "react";

export type ItemNav = {
  /** Focus an item id and jump to its dossier view. */
  focusItem: (id: string) => void;
  /** Open the By-bench view filtered to a bench requirement id (e.g. "Weapon_Bench"). */
  focusBench: (benchReqId: string) => void;
};

export const ItemNavContext = createContext<ItemNav>({
  focusItem: () => {},
  focusBench: () => {},
});

export function useItemNav() {
  return useContext(ItemNavContext);
}
