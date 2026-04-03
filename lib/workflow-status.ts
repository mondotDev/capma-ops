export type NormalizedWorkflowStatus = "active" | "waiting" | "ready" | "complete" | "cut" | "declined" | "canceled";

export function normalizeActionWorkflowStatus(status: string): NormalizedWorkflowStatus {
  if (status === "Waiting") {
    return "waiting";
  }

  if (status === "Complete") {
    return "complete";
  }

  if (status === "Cut") {
    return "cut";
  }

  if (status === "Declined") {
    return "declined";
  }

  if (status === "Canceled") {
    return "canceled";
  }

  return "active";
}

export function isNormalizedTerminalStatus(status: NormalizedWorkflowStatus) {
  return status === "complete" || status === "cut" || status === "declined" || status === "canceled";
}
