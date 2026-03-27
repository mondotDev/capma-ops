"use client";

import { createContext, useContext, useState } from "react";
import { initialActionItems, type ActionItem } from "@/lib/sample-data";

type AppStateContextValue = {
  items: ActionItem[];
  updateItem: (id: string, updates: Partial<ActionItem>) => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(initialActionItems);

  const value = {
    items,
    updateItem: (id: string, updates: Partial<ActionItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                lastUpdated: updates.lastUpdated ?? new Date().toISOString().slice(0, 10)
              }
            : item
        )
      );
    }
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}
