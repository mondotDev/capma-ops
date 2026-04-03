type TraceRecord = {
  stage: string;
  payload: unknown;
  timestamp: string;
};

declare global {
  interface Window {
    __CAPMA_COLLATERAL_CREATE_TRACE_LOG__?: TraceRecord[];
    __CAPMA_COLLATERAL_CREATE_TRACE_ID__?: string;
  }
}

const TRACE_STORAGE_KEY = "capma:trace:collateral-create";

export function isCollateralCreateTraceEnabled() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TRACE_STORAGE_KEY) === "1";
}

export function setCollateralCreateTraceId(id: string | null) {
  if (!isCollateralCreateTraceEnabled() || typeof window === "undefined") {
    return;
  }

  window.__CAPMA_COLLATERAL_CREATE_TRACE_ID__ = id ?? undefined;
}

export function getCollateralCreateTraceId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__CAPMA_COLLATERAL_CREATE_TRACE_ID__ ?? null;
}

export function traceCollateralCreate(stage: string, payload: unknown) {
  if (!isCollateralCreateTraceEnabled() || typeof window === "undefined") {
    return;
  }

  const entry = {
    stage,
    payload,
    timestamp: new Date().toISOString()
  } satisfies TraceRecord;

  window.__CAPMA_COLLATERAL_CREATE_TRACE_LOG__ = [
    ...(window.__CAPMA_COLLATERAL_CREATE_TRACE_LOG__ ?? []),
    entry
  ];

  console.log(`[capma collateral trace] ${stage}`, payload);
}

