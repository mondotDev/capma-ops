"use client";

import type { ActionNoteEntry } from "@/lib/sample-data";
import { formatNoteEntryTimestamp, sortNoteEntriesNewestFirst } from "@/lib/ops-utils";

type ActionItemNotesPanelProps = {
  noteEntries: ActionNoteEntry[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onAddNote: () => void;
};

export function ActionItemNotesPanel({
  noteEntries,
  noteDraft,
  onNoteDraftChange,
  onAddNote
}: ActionItemNotesPanelProps) {
  return (
    <section className="drawer-section drawer-section--notes drawer-section--notes-panel">
      <h3 className="drawer__panel-title">Notes</h3>
      {noteEntries.length > 0 ? (
        <div className="note-history">
          {[...sortNoteEntriesNewestFirst(noteEntries)].reverse().map((entry) => (
            <article className="note-entry" key={entry.id}>
              <div className="note-entry__rail">
                <span className="note-entry__initials">{entry.author.initials}</span>
                <span className="note-entry__timestamp">{formatNoteEntryTimestamp(entry.createdAt)}</span>
              </div>
              <div className="note-entry__body">
                <div className="note-entry__text">{entry.text}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="muted">No note history yet.</div>
      )}
      <div className="drawer__composer">
        <div className="field">
          <label htmlFor="drawer-add-note">Add Note</label>
          <textarea
            id="drawer-add-note"
            onChange={(event) => onNoteDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onAddNote();
              }
            }}
            placeholder="Add a timestamped note. Press Enter to save, Shift+Enter for a new line."
            rows={5}
            value={noteDraft}
          />
        </div>
        <div className="drawer__note-actions">
          <div className="field-hint">Enter saves. Shift+Enter adds a new line.</div>
          <button
            className="button-link button-link--inline-secondary"
            disabled={noteDraft.trim().length === 0}
            onClick={onAddNote}
            type="button"
          >
            Add note
          </button>
        </div>
      </div>
    </section>
  );
}
