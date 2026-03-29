"use client";

export type CollateralSummaryFilter =
  | "all"
  | "active"
  | "needsAttention"
  | "atPrinter"
  | "readyForPrint";

export type CollateralSummaryMetrics = {
  active: number;
  needsAttention: number;
  atPrinter: number;
  atPrinterQuantity: number;
  readyForPrint: number;
};

type CollateralSummaryStripProps = {
  activeSummaryFilter: CollateralSummaryFilter;
  onToggleSummaryFilter: (filter: CollateralSummaryFilter) => void;
  summary: CollateralSummaryMetrics;
};

export function CollateralSummaryStrip({
  activeSummaryFilter,
  onToggleSummaryFilter,
  summary
}: CollateralSummaryStripProps) {
  return (
    <div className="collateral-summary">
      <button
        className={getCollateralMetricClassName(activeSummaryFilter === "active")}
        onClick={() => onToggleSummaryFilter("active")}
        type="button"
      >
        <span className="collateral-metric__label">Active</span>
        <strong className="collateral-metric__value">{summary.active}</strong>
      </button>
      <button
        className={getCollateralMetricClassName(
          activeSummaryFilter === "needsAttention",
          "collateral-metric--attention"
        )}
        onClick={() => onToggleSummaryFilter("needsAttention")}
        type="button"
      >
        <span className="collateral-metric__label">Needs Attention</span>
        <strong className="collateral-metric__value">{summary.needsAttention}</strong>
      </button>
      <button
        className={getCollateralMetricClassName(
          activeSummaryFilter === "atPrinter",
          "collateral-metric--printer"
        )}
        onClick={() => onToggleSummaryFilter("atPrinter")}
        type="button"
      >
        <span className="collateral-metric__label">At Printer</span>
        <strong className="collateral-metric__value">{summary.atPrinter}</strong>
        {summary.atPrinterQuantity > 0 ? (
          <span className="collateral-metric__subvalue">{summary.atPrinterQuantity} qty in production</span>
        ) : null}
      </button>
      <button
        className={getCollateralMetricClassName(
          activeSummaryFilter === "readyForPrint",
          "collateral-metric--ready"
        )}
        onClick={() => onToggleSummaryFilter("readyForPrint")}
        type="button"
      >
        <span className="collateral-metric__label">Ready for Print</span>
        <strong className="collateral-metric__value">{summary.readyForPrint}</strong>
      </button>
    </div>
  );
}

function getCollateralMetricClassName(isSelected: boolean, variantClassName?: string) {
  const classNames = ["collateral-metric", "collateral-metric--clickable"];

  if (variantClassName) {
    classNames.push(variantClassName);
  }

  if (isSelected) {
    classNames.push("collateral-metric--selected");
  }

  return classNames.join(" ");
}
