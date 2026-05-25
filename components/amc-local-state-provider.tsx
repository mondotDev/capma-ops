"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  addActionItemToAmcLocalState,
  createDefaultAmcLocalState,
  loadAmcLocalState,
  saveAmcLocalState,
  type AmcLocalStateSnapshot
} from "@/lib/amc-local-state";
import type { ActionItem } from "@/lib/amc-domain";

interface AmcLocalStateContextValue {
  state: AmcLocalStateSnapshot;
  isHydrated: boolean;
  addActionItem: (actionItem: ActionItem) => void;
  resetLocalState: () => void;
}

const AmcLocalStateContext = createContext<AmcLocalStateContextValue | null>(null);

export function AmcLocalStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AmcLocalStateSnapshot>(() => createDefaultAmcLocalState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setState(loadAmcLocalState());
    setIsHydrated(true);
  }, []);

  const value = useMemo<AmcLocalStateContextValue>(
    () => ({
      state,
      isHydrated,
      addActionItem(actionItem) {
        setState((current) => {
          const nextState = addActionItemToAmcLocalState(current, actionItem);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      resetLocalState() {
        const nextState = createDefaultAmcLocalState();
        saveAmcLocalState(nextState);
        setState(nextState);
      }
    }),
    [isHydrated, state]
  );

  return <AmcLocalStateContext.Provider value={value}>{children}</AmcLocalStateContext.Provider>;
}

export function useAmcLocalState() {
  const context = useContext(AmcLocalStateContext);

  if (!context) {
    throw new Error("useAmcLocalState must be used inside AmcLocalStateProvider.");
  }

  return context;
}
