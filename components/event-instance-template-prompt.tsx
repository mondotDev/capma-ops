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
              Start With a Collateral Pack?
            </h2>
            <p className="quick-add-modal__subtitle">
              {instanceName} has a default collateral pack available. Apply it now or continue into Collateral with an empty event instance.
            </p>
          </div>
        </div>
        <div className="quick-add-actions">
          <button className="button-link button-link--inline-secondary" onClick={onSkip} type="button">
            Start Empty
          </button>
          <button className="topbar__button" onClick={onApply} type="button">
            Apply Default Pack
          </button>
        </div>
      </section>
    </div>
  );
}
