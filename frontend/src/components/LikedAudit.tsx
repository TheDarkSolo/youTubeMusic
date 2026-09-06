import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { LikedAuditGroup, LikedAuditResponse, UnlikeResponse } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

interface Props {
  audit: LikedAuditResponse;
  onCancel: () => void;
  onCompleted: (result: UnlikeResponse) => void;
}

/**
 * One collapsible category section (e.g. "Gaming (14)") with a section-level
 * "select all in this category" checkbox — same indeterminate-checkbox pattern as the
 * "Also remove duplicate tracks" row in MergeReview/DedupeReview, applied per category.
 */
function CategorySection({
  group,
  selected,
  onToggleItem,
  onToggleAll,
}: {
  group: LikedAuditGroup;
  selected: Set<string>;
  onToggleItem: (videoId: string) => void;
  onToggleAll: (group: LikedAuditGroup) => void;
}) {
  const total = group.items.length;
  const selectedCount = group.items.filter((it) => selected.has(it.videoId)).length;
  const allSelected = total > 0 && selectedCount === total;
  const noneSelected = selectedCount === 0;
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && !noneSelected;
    }
  }, [allSelected, noneSelected]);

  return (
    <details className="liked-audit__category">
      <summary>
        {group.categoryName} <span className="muted">({total})</span>
        {selectedCount > 0 && <span className="muted"> — {selectedCount} selected</span>}
      </summary>
      <label className="select-all-row">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={() => onToggleAll(group)}
        />
        <strong>Select all in {group.categoryName}</strong>
      </label>
      <ul className="checkbox-list">
        {group.items.map((item) => (
          <li key={item.videoId}>
            <label>
              <input
                type="checkbox"
                checked={selected.has(item.videoId)}
                onChange={() => onToggleItem(item.videoId)}
              />
              {item.title} <span className="muted">— {item.channelTitle}</span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * §5.16 — review screen for the library-wide Liked Music audit. `audit` is the read-only
 * dry-run result (no plan token / staleness concept here, per the doc: the checkbox selection
 * itself is the confirmation, and unliking an already-unliked video is a harmless no-op).
 */
export function LikedAudit({ audit, onCancel, onCompleted }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { reportError, quotaCoolingDown } = useErrors();

  const nonMusicCount = audit.totalLiked - audit.musicCount;

  function toggleItem(videoId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  function toggleAllInGroup(group: LikedAuditGroup) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = group.items.every((it) => next.has(it.videoId));
      for (const it of group.items) {
        if (allSelected) next.delete(it.videoId);
        else next.add(it.videoId);
      }
      return next;
    });
  }

  const selectedCount = selected.size;
  // Live client-side estimate, same pattern as MergeReview/DedupeReview's liveCommittedUnits —
  // §5.16 explicitly calls for selected.length * 50, no server round-trip needed.
  const liveCommittedUnits = selectedCount * 50;
  const quotaIsHigh = liveCommittedUnits > 7000;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await api.unlikeVideos([...selected]);
      onCompleted(result);
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (audit.nonMusicGroups.length === 0) {
    return (
      <div className="liked-audit">
        <p className="hint">
          {audit.musicCount} of {audit.totalLiked} liked videos are music — nothing to clean up.
        </p>
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onCancel}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="liked-audit">
      <div className="like-review__stats">
        <div className="like-review__stat">
          <span className="like-review__stat-value">{nonMusicCount}</span>
          <span className="like-review__stat-label">Not music</span>
        </div>
        <div className="like-review__stat like-review__stat--muted">
          <span className="like-review__stat-value">{audit.musicCount}</span>
          <span className="like-review__stat-label">Music</span>
        </div>
        <div className="like-review__stat like-review__stat--muted">
          <span className="like-review__stat-value">{audit.totalLiked}</span>
          <span className="like-review__stat-label">Total liked</span>
        </div>
      </div>

      <p className="hint">
        This looks at everything you've ever liked across YouTube, not just what shows in Liked
        Music — the items below already don't appear there (that's exactly why they're worth
        cleaning up), so removing them won't change Liked Music at all. It just clears them from
        your underlying like history.
      </p>

      <div className="liked-audit__categories">
        {audit.nonMusicGroups.map((group) => (
          <CategorySection
            key={group.categoryId}
            group={group}
            selected={selected}
            onToggleItem={toggleItem}
            onToggleAll={toggleAllInGroup}
          />
        ))}
      </div>

      <p className="summary-line">
        {selectedCount} like{selectedCount === 1 ? "" : "s"} selected to remove.
      </p>
      <p className={quotaIsHigh ? "hint hint--warn" : "hint"}>
        Estimated YouTube API quota: ~{liveCommittedUnits} units — your daily limit is 10,000
        units.
      </p>

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button
          className="btn btn--danger"
          disabled={submitting || quotaCoolingDown || selectedCount === 0}
          onClick={handleConfirm}
        >
          {submitting ? "Removing…" : `Remove ${selectedCount} like${selectedCount === 1 ? "" : "s"}`}
        </button>
      </div>
      {submitting && <Spinner label="Removing likes…" />}
    </div>
  );
}
