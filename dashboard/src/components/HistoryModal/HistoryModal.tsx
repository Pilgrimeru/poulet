import { useEffect, useRef, useState } from "react";
import { fetchHistory } from "../../api/client";
import type { MessageSnapshotDTO } from "../../types";
import styles from "./HistoryModal.module.css";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

interface Props {
  messageID: string;
  onClose: () => void;
}

export function HistoryModal({ messageID, onClose }: Props) {
  const [versions, setVersions] = useState<MessageSnapshotDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory(messageID)
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [messageID]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Historique des modifications</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.loading}>Chargement…</p>
          ) : (
            versions.map((v) => {
              const isOriginal = v.version === 0;
              const badgeClass = v.isDeleted
                ? styles.versionBadgeDeleted
                : isOriginal
                ? styles.versionBadgeOriginal
                : styles.versionBadge;

              return (
                <div key={v.id} className={styles.version}>
                  <div className={styles.versionHeader}>
                    <span className={`${styles.versionBadge} ${badgeClass}`}>
                      {v.isDeleted ? "supprimé" : isOriginal ? "original" : `v${v.version}`}
                    </span>
                    <span className={styles.versionTime}>{formatDate(v.snapshotAt)}</span>
                  </div>
                  <p className={`${styles.versionContent} ${v.isDeleted ? styles.deletedContent : ""}`}>
                    {v.content || <em style={{ opacity: 0.5 }}>(aucun contenu)</em>}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
