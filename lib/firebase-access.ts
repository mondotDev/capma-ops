export const INTERNAL_BETA_USERS_COLLECTION = "internalBetaUsers";

export type InternalBetaAccessRecord = {
  enabled: boolean;
  email?: string;
  displayName?: string;
};

export function parseInternalBetaAccessDocument(value: unknown): InternalBetaAccessRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<InternalBetaAccessRecord>;

  if (typeof record.enabled !== "boolean") {
    return null;
  }

  if (
    (record.email !== undefined && typeof record.email !== "string") ||
    (record.displayName !== undefined && typeof record.displayName !== "string")
  ) {
    return null;
  }

  return {
    enabled: record.enabled,
    email: record.email,
    displayName: record.displayName
  };
}
