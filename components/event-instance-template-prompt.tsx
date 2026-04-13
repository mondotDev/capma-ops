"use client";

export function EventInstanceTemplatePrompt({
  instanceName,
  isOpen,
  onApply,
  onSkip
}: {
  instanceName: string;
  isOpen: boolean;
  onApply: () => void;
  onSkip: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-layer" role="presentation">
      <button aria-label="Close apply template prompt" className="modal-backdrop" onClick={onSkip} type="button" />
      <section aria-labelledby="apply-template-title" aria-modal="true" className="quick-add-modal" role="dialog">
        <div className="quick-add-modal__header">
          <div>
            <h2 className="quick-add-modal__title" id="apply-template-title">
              Open Collateral For This Event?
            </h2>
            <p className="quick-add-modal__subtitle">
              {instanceName} is ready. You can open Collateral as-is, or preload the currently available collateral items now.
            </p>
          </div>
        </div>
        <div className="quick-add-actions">
          <button className="button-link button-link--inline-secondary" onClick={onSkip} type="button">
            Open As-Is
          </button>
          <button className="topbar__button" onClick={onApply} type="button">
            Preload Collateral
          </button>
        </div>
      </section>
    </div>
  );
}
