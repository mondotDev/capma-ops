import {
  applyCollateralTemplate,
  createCollateralItem,
  deleteCollateralItemById,
  markCollateralItemComplete,
  markCollateralItemCut,
  normalizeCollateralItems,
  restoreCollateralItem,
  updateCollateralItemById,
  type ApplyCollateralTemplateResult,
  type CollateralMutationContext,
  type NewCollateralItemInput
} from "@/lib/collateral-mutations";
import type { CollateralTemplateItem, CollateralTemplateSubEvent } from "@/lib/collateral-templates";
import type { CollateralItem } from "@/lib/collateral-data";
import type { EventSubEvent } from "@/lib/event-instances";

export interface CollateralStore {
  mode: "local";
  applyTemplate(input: {
    currentItems: CollateralItem[];
    currentSubEvents: EventSubEvent[];
    defaultOwner: string;
    eventInstanceId: string;
    templateItems: CollateralTemplateItem[];
    templateSubEvents: CollateralTemplateSubEvent[];
  }): ApplyCollateralTemplateResult;
  create(items: CollateralItem[], item: NewCollateralItemInput, context?: CollateralMutationContext): CollateralItem[];
  delete(items: CollateralItem[], id: string): CollateralItem[];
  markComplete(items: CollateralItem[], id: string, context?: CollateralMutationContext): CollateralItem[];
  markCut(items: CollateralItem[], id: string, context?: CollateralMutationContext): CollateralItem[];
  normalizeLoaded(items: CollateralItem[], context?: CollateralMutationContext): CollateralItem[];
  restore(
    items: CollateralItem[],
    id: string,
    restoredStatus?: Exclude<CollateralItem["status"], "Complete" | "Cut">,
    context?: CollateralMutationContext
  ): CollateralItem[];
  update(
    items: CollateralItem[],
    id: string,
    updates: Partial<CollateralItem>,
    context?: CollateralMutationContext
  ): CollateralItem[];
}

class LocalCollateralStore implements CollateralStore {
  mode = "local" as const;

  applyTemplate(input: {
    currentItems: CollateralItem[];
    currentSubEvents: EventSubEvent[];
    defaultOwner: string;
    eventInstanceId: string;
    templateItems: CollateralTemplateItem[];
    templateSubEvents: CollateralTemplateSubEvent[];
  }) {
    return applyCollateralTemplate(input);
  }

  create(items: CollateralItem[], item: NewCollateralItemInput, context?: CollateralMutationContext) {
    return [createCollateralItem(item, context), ...items];
  }

  delete(items: CollateralItem[], id: string) {
    return deleteCollateralItemById(items, id);
  }

  markComplete(items: CollateralItem[], id: string, context?: CollateralMutationContext) {
    return markCollateralItemComplete(items, id, context);
  }

  markCut(items: CollateralItem[], id: string, context?: CollateralMutationContext) {
    return markCollateralItemCut(items, id, context);
  }

  normalizeLoaded(items: CollateralItem[], context?: CollateralMutationContext) {
    return normalizeCollateralItems(items, context);
  }

  restore(
    items: CollateralItem[],
    id: string,
    restoredStatus: Exclude<CollateralItem["status"], "Complete" | "Cut"> = "Backlog",
    context?: CollateralMutationContext
  ) {
    return restoreCollateralItem(items, id, restoredStatus, context);
  }

  update(items: CollateralItem[], id: string, updates: Partial<CollateralItem>, context?: CollateralMutationContext) {
    return updateCollateralItemById(items, id, updates, context);
  }
}

export const localCollateralStore: CollateralStore = new LocalCollateralStore();
