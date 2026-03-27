"use client";
import { useLayoutEffect, useRef } from "react";
import type { MessageUpdateMode } from "../../hooks/useMessages";
import type { MessageSnapshotDTO } from "../../types";
import { MessageItem } from "./MessageItem";
import styles from "./MessageList.module.css";

interface Props {
  messages: MessageSnapshotDTO[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onShowHistory: (messageID: string) => void;
  channelID: string | null;
  loadedChannelID: string | null;
  updateMode: MessageUpdateMode;
}

export function MessageList({ messages, hasMore, loading, onLoadMore, onShowHistory, channelID, loadedChannelID, updateMode }: Readonly<Props>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const distanceFromBottomRef = useRef(0);
  const previousLoadedChannelIDRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || loadedChannelID !== channelID) return;

    const channelChanged = previousLoadedChannelIDRef.current !== loadedChannelID;
    if (channelChanged || updateMode === "replace") {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - distanceFromBottomRef.current);
    }

    distanceFromBottomRef.current = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
    previousLoadedChannelIDRef.current = loadedChannelID;
  }, [messages, channelID, loadedChannelID, updateMode]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    distanceFromBottomRef.current = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
  }

  if (!channelID) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💬</div>
        Sélectionne un salon pour voir les messages.
      </div>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className={styles.container}>
        {["sk-0","sk-1","sk-2","sk-3","sk-4","sk-5"].map((id, i) => (
          <div key={id} className={styles.skeleton}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonBody}>
              <div className={styles.skeletonLine} style={{ width: `${30 + (i * 13) % 40}%` }} />
              <div className={styles.skeletonLine} style={{ width: `${50 + (i * 7) % 35}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && messages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🗂️</div>
        Aucun message enregistré dans ce salon.
      </div>
    );
  }

  // Messages are newest-first from API, reverse for chronological display
  const ordered = [...messages].reverse();

  return (
    <div ref={containerRef} className={styles.container} onScroll={handleScroll}>
      {hasMore && (
        <div className={styles.loadMore}>
          <button className={styles.loadMoreBtn} onClick={onLoadMore} disabled={loading}>
            {loading ? "Chargement…" : "Charger les messages plus anciens"}
          </button>
        </div>
      )}

      <div className={styles.messages}>
        {ordered.map((m) => (
          <MessageItem key={m.id} message={m} onShowHistory={onShowHistory} />
        ))}
      </div>

      {loading && messages.length > 0 && (
        <div className={styles.loadingMore}>
          <span className={styles.loadingDot} /><span className={styles.loadingDot} /><span className={styles.loadingDot} />
        </div>
      )}
    </div>
  );
}
