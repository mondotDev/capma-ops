"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  addActionItemToAmcLocalState,
  addCollateralActionItemToAmcLocalState,
  addCollateralItemToAmcLocalState,
  addClientAssociationToAmcLocalState,
  addProgramSeriesToAmcLocalState,
  addSponsorFulfillmentActionItemToAmcLocalState,
  addSponsorFulfillmentCollateralItemToAmcLocalState,
  addSponsorFulfillmentRecordToAmcLocalState,
  addWorkBucketToAmcLocalState,
  createDefaultAmcLocalState,
  loadAmcLocalState,
  saveAmcLocalState,
  updateCollateralItemInAmcLocalState,
  updateProgramSeriesInAmcLocalState,
  updateSponsorFulfillmentRecordInAmcLocalState,
  updateWorkBucketInAmcLocalState,
  type AmcLocalStateSnapshot
} from "@/lib/amc-local-state";
import type {
  ActionItem,
  ClientAssociation,
  CollateralItem,
  CollateralItemUpdateInput,
  ProgramSeries,
  ProgramSeriesUpdateInput,
  SponsorFulfillmentRecord,
  SponsorFulfillmentUpdateInput,
  WorkBucket,
  WorkBucketUpdateInput
} from "@/lib/amc-domain";

interface AmcLocalStateContextValue {
  state: AmcLocalStateSnapshot;
  isHydrated: boolean;
  addActionItem: (actionItem: ActionItem) => void;
  addCollateralItem: (collateralItem: CollateralItem) => void;
  updateCollateralItem: (collateralItemId: string, updates: CollateralItemUpdateInput) => void;
  addCollateralActionItem: (input: { collateralItemId: string; actionItem: ActionItem }) => void;
  addSponsorFulfillmentRecord: (sponsorFulfillment: SponsorFulfillmentRecord) => void;
  updateSponsorFulfillmentRecord: (sponsorFulfillmentId: string, updates: SponsorFulfillmentUpdateInput) => void;
  addSponsorFulfillmentActionItem: (input: { sponsorFulfillmentId: string; actionItem: ActionItem }) => void;
  addSponsorFulfillmentCollateralItem: (input: { sponsorFulfillmentId: string; collateralItem: CollateralItem }) => void;
  addClientAssociation: (client: ClientAssociation) => void;
  addProgramSeries: (programSeries: ProgramSeries) => void;
  updateProgramSeries: (programSeriesId: string, updates: ProgramSeriesUpdateInput) => void;
  addWorkBucket: (bucket: WorkBucket) => void;
  updateWorkBucket: (bucketId: string, updates: WorkBucketUpdateInput) => void;
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
      addCollateralItem(collateralItem) {
        setState((current) => {
          const nextState = addCollateralItemToAmcLocalState(current, collateralItem);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      updateCollateralItem(collateralItemId, updates) {
        setState((current) => {
          const nextState = updateCollateralItemInAmcLocalState(current, collateralItemId, updates);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addCollateralActionItem(input) {
        setState((current) => {
          const nextState = addCollateralActionItemToAmcLocalState({
            snapshot: current,
            collateralItemId: input.collateralItemId,
            actionItem: input.actionItem
          });
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addSponsorFulfillmentRecord(sponsorFulfillment) {
        setState((current) => {
          const nextState = addSponsorFulfillmentRecordToAmcLocalState(current, sponsorFulfillment);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      updateSponsorFulfillmentRecord(sponsorFulfillmentId, updates) {
        setState((current) => {
          const nextState = updateSponsorFulfillmentRecordInAmcLocalState(current, sponsorFulfillmentId, updates);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addSponsorFulfillmentActionItem(input) {
        setState((current) => {
          const nextState = addSponsorFulfillmentActionItemToAmcLocalState({
            snapshot: current,
            sponsorFulfillmentId: input.sponsorFulfillmentId,
            actionItem: input.actionItem
          });
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addSponsorFulfillmentCollateralItem(input) {
        setState((current) => {
          const nextState = addSponsorFulfillmentCollateralItemToAmcLocalState({
            snapshot: current,
            sponsorFulfillmentId: input.sponsorFulfillmentId,
            collateralItem: input.collateralItem
          });
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addClientAssociation(client) {
        setState((current) => {
          const nextState = addClientAssociationToAmcLocalState(current, client);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addProgramSeries(programSeries) {
        setState((current) => {
          const nextState = addProgramSeriesToAmcLocalState(current, programSeries);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      updateProgramSeries(programSeriesId, updates) {
        setState((current) => {
          const nextState = updateProgramSeriesInAmcLocalState(current, programSeriesId, updates);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      addWorkBucket(bucket) {
        setState((current) => {
          const nextState = addWorkBucketToAmcLocalState(current, bucket);
          saveAmcLocalState(nextState);
          return nextState;
        });
      },
      updateWorkBucket(bucketId, updates) {
        setState((current) => {
          const nextState = updateWorkBucketInAmcLocalState(current, bucketId, updates);
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
