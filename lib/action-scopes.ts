import type { EventInstance, EventProgram } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import {
  getSuggestedOperationalBucketForWorkstream,
  isOperationalBucketOption,
  normalizeEventGroupValue,
  normalizeOperationalBucketValue
} from "@/lib/ops-utils";

export type ActionScopeType = "system" | "bucket" | "program" | "instance";

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

type ResolvedActionScope = {
  primaryScope: ActionScope;
  programScope: ActionScope | null;
};

export function buildActionScopes(input: ActionScopeInput): ActionScope[] {
  const scopes = new Map<string, ActionScope>();

  scopes.set(ALL_WORK_SCOPE.value, ALL_WORK_SCOPE);
  scopes.set(UNASSIGNED_SCOPE.value, UNASSIGNED_SCOPE);

  for (const item of input.items) {
    const resolved = resolveActionItemScopes(item, input.eventPrograms, input.eventInstances);
    scopes.set(resolved.primaryScope.value, resolved.primaryScope);

    if (resolved.programScope) {
      scopes.set(resolved.programScope.value, resolved.programScope);
    }
  }

  for (const eventInstanceId of input.collateralExecutionInstanceIds ?? []) {
    const instance = input.eventInstances.find((entry) => entry.id === eventInstanceId);

    if (!instance) {
      continue;
    }

    const instanceScope = createInstanceScope(instance);
    scopes.set(instanceScope.value, instanceScope);

    const program = input.eventPrograms.find((entry) => entry.id === instance.eventTypeId);

    if (program) {
      const programScope = createProgramScope(program);
      scopes.set(programScope.value, programScope);
    }
  }

  return [...scopes.values()].sort(compareActionScopes);
}

export function getActionItemScopeLabel(
  item: ActionItem,
  eventPrograms: EventProgram[] = [],
  eventInstances: EventInstance[] = []
) {
  return resolveActionItemScopes(item, eventPrograms, eventInstances).primaryScope.label;
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

  const resolved = resolveActionItemScopes(item, eventPrograms, eventInstances);

  if (activeScopeValue === UNASSIGNED_SCOPE.value) {
    return resolved.primaryScope.value === UNASSIGNED_SCOPE.value;
  }

  if (resolved.primaryScope.value === activeScopeValue) {
    return true;
  }

  return resolved.programScope?.value === activeScopeValue;
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

  const program = eventPrograms.find((entry) => entry.id === instance.eventTypeId);

  if (!program) {
    return false;
  }

  return createProgramScope(program).value === activeScopeValue;
}

export function getActionScopeLabelByValue(scopes: ActionScope[], value: string) {
  return scopes.find((scope) => scope.value === value)?.label ?? value;
}

function resolveActionItemScopes(
  item: ActionItem,
  eventPrograms: EventProgram[],
  eventInstances: EventInstance[]
): ResolvedActionScope {
  if (item.eventInstanceId) {
    const instance = eventInstances.find((entry) => entry.id === item.eventInstanceId);

    if (instance) {
      return {
        primaryScope: createInstanceScope(instance),
        programScope: createProgramScopeForInstance(instance, eventPrograms)
      };
    }
  }

  const normalizedOperationalBucket =
    normalizeOperationalBucketValue(item.operationalBucket) ??
    resolveLegacyOperationalBucket(normalizeEventGroupValue(item.eventGroup)) ??
    getSuggestedOperationalBucketForWorkstream(item.workstream);

  if (normalizedOperationalBucket) {
    return {
      primaryScope: createBucketScope(normalizedOperationalBucket),
      programScope: null
    };
  }

  const legacyEventGroup = normalizeEventGroupValue(item.eventGroup);

  if (legacyEventGroup) {
    const legacyInstance = eventInstances.find((entry) => entry.name === legacyEventGroup);

    if (legacyInstance) {
      return {
        primaryScope: createInstanceScope(legacyInstance),
        programScope: createProgramScopeForInstance(legacyInstance, eventPrograms)
      };
    }

    const legacyProgram = eventPrograms.find((entry) => entry.name === legacyEventGroup);

    if (legacyProgram) {
      return {
        primaryScope: createProgramScope(legacyProgram),
        programScope: createProgramScope(legacyProgram)
      };
    }
  }

  return {
    primaryScope: UNASSIGNED_SCOPE,
    programScope: null
  };
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

function createProgramScope(program: EventProgram): ActionScope {
  return {
    type: "program",
    value: program.name,
    label: program.name,
    programId: program.id
  };
}

function createProgramScopeForInstance(instance: EventInstance, eventPrograms: EventProgram[]) {
  const program = eventPrograms.find((entry) => entry.id === instance.eventTypeId);
  return program ? createProgramScope(program) : null;
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

  if (type === "program") {
    return 2;
  }

  return 3;
}
