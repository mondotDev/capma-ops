"use client";

import { createContext, useContext, useState } from "react";
import { initialActionItems, type ActionItem } from "@/lib/sample-data";

export type NewActionItem = Omit<ActionItem, "id" | "lastUpdated">;

type AppStateContextValue = {
  items: ActionItem[];
  addItem: (item: NewActionItem) => void;
  updateItem: (id: string, updates: Partial<ActionItem>) => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(initialActionItems);

  const value = {
    items,
    addItem: (item: NewActionItem) => {
      const slug = item.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const timestamp = Date.now().toString(36);

      setItems((current) => [
        {
          ...item,
          id: `${slug || "item"}-${timestamp}`,
          lastUpdated: new Date().toISOString().slice(0, 10)
        },
        ...current
      ]);
    },
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
