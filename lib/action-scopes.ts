import type { EventInstance, EventProgram } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import {
  getSuggestedOperationalBucketForWorkstream,
  isOperationalBucketOption,
  normalizeEventGroupValue,
  normalizeOperationalBucketValue
} from "@/lib/ops-utils";

export type ActionScopeType = "system" | "bucket" | "instance";

export type ActionScope = {
  type: ActionScopeType;
  value: string;
  label: string;
  programId?: string;
  instanceId?: string;
  operationalBucket?: string;
};

const ALL_WORK_SCOPE: ActionScope = {
  type: "system",
  value: "all",
  label: "All Work"
};

const UNASSIGNED_SCOPE: ActionScope = {
  type: "system",
  value: "Unassigned",
  label: "Unassigned"
};

type ActionScopeInput = {
  items: ActionItem[];
  eventPrograms: EventProgram[];
  eventInstances: EventInstance[];
  collateralExecutionInstanceIds?: string[];
};

export function buildActionScopes(input: ActionScopeInput): ActionScope[] {
  const scopes = new Map<string, ActionScope>();

  scopes.set(ALL_WORK_SCOPE.value, ALL_WORK_SCOPE);
  scopes.set(UNASSIGNED_SCOPE.value, UNASSIGNED_SCOPE);

  for (const item of input.items) {
    const scope = resolveActionItemScope(item, input.eventPrograms, input.eventInstances);
    scopes.set(scope.value, scope);
  }

  for (const eventInstanceId of input.collateralExecutionInstanceIds ?? []) {
    const instance = input.eventInstances.find((entry) => entry.id === eventInstanceId);

    if (!instance) {
      continue;
    }

    const instanceScope = createInstanceScope(instance);
    scopes.set(instanceScope.value, instanceScope);
  }

  return [...scopes.values()].sort(compareActionScopes);
}

export function getActionItemScopeLabel(
  item: ActionItem,
  eventPrograms: EventProgram[] = [],
  eventInstances: EventInstance[] = []
) {
  return resolveActionItemScope(item, eventPrograms, eventInstances).label;
}

export function matchesActionScope(
  item: ActionItem,
  activeScopeValue: string | undefined,
  eventPrograms: EventProgram[] = [],
  eventInstances: EventInstance[] = []
) {
  if (!activeScopeValue || activeScopeValue === ALL_WORK_SCOPE.value) {
    return true;
  }

  const resolved = resolveActionItemScope(item, eventPrograms, eventInstances);

  if (activeScopeValue === UNASSIGNED_SCOPE.value) {
    return resolved.value === UNASSIGNED_SCOPE.value;
  }

  return resolved.value === activeScopeValue;
}

export function matchesCollateralExecutionScope(
  input: {
    eventInstanceId: string;
  },
  activeScopeValue: string | undefined,
  eventPrograms: EventProgram[] = [],
  eventInstances: EventInstance[] = []
) {
  if (!activeScopeValue || activeScopeValue === ALL_WORK_SCOPE.value) {
    return true;
  }

  if (activeScopeValue === UNASSIGNED_SCOPE.value) {
    return false;
  }

  const instance = eventInstances.find((entry) => entry.id === input.eventInstanceId);

  if (!instance) {
    return false;
  }

  const instanceScope = createInstanceScope(instance);

  if (instanceScope.value === activeScopeValue) {
    return true;
  }

  return false;
}

export function getActionScopeLabelByValue(scopes: ActionScope[], value: string) {
  return scopes.find((scope) => scope.value === value)?.label ?? value;
}

function resolveActionItemScope(
  item: ActionItem,
  _eventPrograms: EventProgram[],
  eventInstances: EventInstance[]
): ActionScope {
  if (item.eventInstanceId) {
    const instance = eventInstances.find((entry) => entry.id === item.eventInstanceId);

    if (instance) {
      return createInstanceScope(instance);
    }
  }

  const normalizedOperationalBucket =
    normalizeOperationalBucketValue(item.operationalBucket) ??
    resolveLegacyOperationalBucket(normalizeEventGroupValue(item.eventGroup)) ??
    getSuggestedOperationalBucketForWorkstream(item.workstream);

  if (normalizedOperationalBucket) {
    return createBucketScope(normalizedOperationalBucket);
  }

  const legacyEventGroup = normalizeEventGroupValue(item.eventGroup);

  if (legacyEventGroup) {
    const legacyInstance = eventInstances.find((entry) => entry.name === legacyEventGroup);

    if (legacyInstance) {
      return createInstanceScope(legacyInstance);
    }
  }

  return UNASSIGNED_SCOPE;
}

function resolveLegacyOperationalBucket(eventGroup?: string) {
  if (!eventGroup) {
    return undefined;
  }

  return isOperationalBucketOption(eventGroup) ? eventGroup : undefined;
}

function createBucketScope(bucket: string): ActionScope {
  return {
    type: "bucket",
    value: bucket,
    label: bucket,
    operationalBucket: bucket
  };
}

function createInstanceScope(instance: EventInstance): ActionScope {
  return {
    type: "instance",
    value: instance.name,
    label: instance.name,
    instanceId: instance.id,
    programId: instance.eventTypeId
  };
}

function compareActionScopes(a: ActionScope, b: ActionScope) {
  const typeOrder = getActionScopeTypeOrder(a.type) - getActionScopeTypeOrder(b.type);

  if (typeOrder !== 0) {
    return typeOrder;
  }

  return a.label.localeCompare(b.label);
}

function getActionScopeTypeOrder(type: ActionScopeType) {
  if (type === "system") {
    return 0;
  }

  if (type === "bucket") {
    return 1;
  }

  return 2;
}
