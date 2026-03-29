"use client";

import type { LegDayCollateralProfile } from "@/lib/collateral-data";

export type CollateralProfileDeadlineFilter =
  | "none"
  | "logoDeadline"
  | "externalPrintingDue"
  | "internalPrintingStart";

type CollateralProfileCardProps = {
  activeProfileDeadlineFilter: CollateralProfileDeadlineFilter;
  onProfileChange: (updates: Partial<LegDayCollateralProfile>) => void;
  onToggleProfileDeadlineFilter: (filter: CollateralProfileDeadlineFilter) => void;
  profile: LegDayCollateralProfile;
};

export function CollateralProfileCard({
  activeProfileDeadlineFilter,
  onProfileChange,
  onToggleProfileDeadlineFilter,
  profile
}: CollateralProfileCardProps) {
  return (
    <div className="card card--secondary collateral-profile">
      <div className="card__title">EVENT PROFILE</div>
      <div className="collateral-profile__grid">
        <div className="field">
          <label htmlFor="collateral-event-start">Event Start</label>
          <input
            className="field-control"
            id="collateral-event-start"
            onChange={(event) => onProfileChange({ eventStartDate: event.target.value })}
            type="date"
            value={profile.eventStartDate}
          />
        </div>
        <div className="field">
          <label htmlFor="collateral-event-end">Event End</label>
          <input
            className="field-control"
            id="collateral-event-end"
            onChange={(event) => onProfileChange({ eventEndDate: event.target.value })}
            type="date"
            value={profile.eventEndDate}
          />
        </div>
        <div className="field">
          <label htmlFor="collateral-room-block">Room Block Deadline</label>
          <input
            className="field-control"
            id="collateral-room-block"
            onChange={(event) => onProfileChange({ roomBlockDeadline: event.target.value })}
            type="date"
            value={profile.roomBlockDeadline}
          />
        </div>
        <div className="field">
          <label htmlFor="collateral-logo-deadline">Logo Deadline</label>
          <div className="collateral-profile__field-action">
            <input
              className="field-control"
              id="collateral-logo-deadline"
              onChange={(event) => onProfileChange({ logoDeadline: event.target.value })}
              type="date"
              value={profile.logoDeadline}
            />
            <button
              className={`button-link button-link--inline-secondary collateral-profile__filter-button${activeProfileDeadlineFilter === "logoDeadline" ? " collateral-profile__filter-button--active" : ""}`}
              onClick={() => onToggleProfileDeadlineFilter("logoDeadline")}
              type="button"
            >
              {activeProfileDeadlineFilter === "logoDeadline" ? "Viewing related" : "View related"}
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="collateral-external-printing">External Printing Due</label>
          <div className="collateral-profile__field-action">
            <input
              className="field-control"
              id="collateral-external-printing"
              onChange={(event) => onProfileChange({ externalPrintingDue: event.target.value })}
              type="date"
              value={profile.externalPrintingDue}
            />
            <button
              className={`button-link button-link--inline-secondary collateral-profile__filter-button${activeProfileDeadlineFilter === "externalPrintingDue" ? " collateral-profile__filter-button--active" : ""}`}
              onClick={() => onToggleProfileDeadlineFilter("externalPrintingDue")}
              type="button"
            >
              {activeProfileDeadlineFilter === "externalPrintingDue" ? "Viewing related" : "View related"}
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="collateral-internal-printing">Start Internal Printing</label>
          <div className="collateral-profile__field-action">
            <input
              className="field-control"
              id="collateral-internal-printing"
              onChange={(event) => onProfileChange({ internalPrintingStart: event.target.value })}
              type="date"
              value={profile.internalPrintingStart}
            />
            <button
              className={`button-link button-link--inline-secondary collateral-profile__filter-button${activeProfileDeadlineFilter === "internalPrintingStart" ? " collateral-profile__filter-button--active" : ""}`}
              onClick={() => onToggleProfileDeadlineFilter("internalPrintingStart")}
              type="button"
            >
              {activeProfileDeadlineFilter === "internalPrintingStart" ? "Viewing related" : "View related"}
            </button>
          </div>
        </div>
      </div>
      <div className="collateral-profile__notes">
        <div className="field">
          <label htmlFor="collateral-room-block-note">Room Block Note</label>
          <textarea
            className="field-control"
            id="collateral-room-block-note"
            onChange={(event) => onProfileChange({ roomBlockNote: event.target.value })}
            rows={2}
            value={profile.roomBlockNote}
          />
        </div>
        <div className="field">
          <label htmlFor="collateral-logo-note">Logo Deadline Note</label>
          <textarea
            className="field-control"
            id="collateral-logo-note"
            onChange={(event) => onProfileChange({ logoDeadlineNote: event.target.value })}
            rows={2}
            value={profile.logoDeadlineNote}
          />
        </div>
      </div>
    </div>
  );
}
