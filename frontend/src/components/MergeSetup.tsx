import { useState } from "react";
import { api } from "../api/client";
import type { MergePreviewResponse, MergeTarget, Playlist } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

interface Props {
  initialPlaylistIds: string[];
  playlists: Playlist[];
  onCancel: () => void;
  onPreviewReady: (
    preview: MergePreviewResponse,
    sourcePlaylistIds: string[],
    target: MergeTarget,
  ) => void;
}

/** Step 1 of the merge flow: pick which playlists to merge and the target, then preview. */
export function MergeSetup({ initialPlaylistIds, playlists, onCancel, onPreviewReady }: Props) {
  const members = playlists.filter((p) => initialPlaylistIds.includes(p.id));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialPlaylistIds));
  const [targetMode, setTargetMode] = useState<"existing" | "create">("existing");
  const [existingTargetId, setExistingTargetId] = useState<string>(initialPlaylistIds[0] ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { reportError, quotaCoolingDown } = useErrors();

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // If the current existing-target was deselected, fall back to another selected member.
      if (targetMode === "existing" && id === existingTargetId && next.has(id) === false) {
        const fallback = [...next][0];
        if (fallback) setExistingTargetId(fallback);
      }
      return next;
    });
  }

  const selectedList = [...selectedIds];
  const canSubmit =
    selectedList.length >= 2 &&
    (targetMode === "create" ? newTitle.trim().length > 0 : selectedIds.has(existingTargetId));

  async function handlePreview() {
    const target: MergeTarget =
      targetMode === "existing"
        ? { mode: "existing", playlistId: existingTargetId }
        : { mode: "create", title: newTitle.trim() };

    setSubmitting(true);
    try {
      const preview = await api.mergePreview({ sourcePlaylistIds: selectedList, target });
      onPreviewReady(preview, selectedList, target);
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="merge-setup">
      <p className="hint">Choose which playlists to merge (defaults to all selected).</p>
      <ul className="checkbox-list">
        {members.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => toggleSelected(p.id)}
              />
              {p.title} ({p.itemCount} tracks)
            </label>
          </li>
        ))}
      </ul>

      <p className="hint">Merge into:</p>
      <label className="radio-row">
        <input
          type="radio"
          name="target-mode"
          checked={targetMode === "existing"}
          onChange={() => setTargetMode("existing")}
        />
        An existing playlist from the selection
      </label>
      {targetMode === "existing" && (
        <select
          className="select"
          value={existingTargetId}
          onChange={(e) => setExistingTargetId(e.target.value)}
          disabled={selectedList.length === 0}
        >
          {selectedList.length === 0 && <option value="">Select playlists above first</option>}
          {members
            .filter((p) => selectedIds.has(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </select>
      )}

      <label className="radio-row">
        <input
          type="radio"
          name="target-mode"
          checked={targetMode === "create"}
          onChange={() => setTargetMode("create")}
        />
        A new playlist
      </label>
      {targetMode === "create" && (
        <input
          className="text-input"
          type="text"
          placeholder="New playlist title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
      )}

      {selectedList.length < 2 && (
        <p className="hint hint--warn">Select at least two playlists to merge.</p>
      )}

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          disabled={!canSubmit || submitting || quotaCoolingDown}
          onClick={handlePreview}
        >
          {submitting ? "Building preview…" : "Preview merge"}
        </button>
      </div>
      {submitting && <Spinner label="Asking the backend to compute the merge plan…" />}
    </div>
  );
}
