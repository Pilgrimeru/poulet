import type { MessageSnapshotDTO } from "../../types";
import { AttachmentRow } from "./AttachmentRow";
import styles from "./MessageItem.module.css";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  message: MessageSnapshotDTO;
  onShowHistory: (messageID: string) => void;
}

export function MessageItem({ message, onShowHistory }: Props) {
  // version > 1 means at least one edit existed before deletion (version 0=original, last=deleted snapshot)
  const isEdited = message.isDeleted ? message.version > 1 : message.version > 0;

  return (
    <div className={`${styles.row} ${message.isDeleted ? styles.deleted : ""}`}>
      {message.authorAvatarURL ? (
        <img src={message.authorAvatarURL} alt="" className={styles.avatar} />
      ) : (
        <div className={styles.avatarFallback}>
          {message.authorDisplayName.charAt(0) || "?"}
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.displayName}>{message.authorDisplayName || message.authorUsername}</span>
          <span className={styles.timestamp}>{formatDate(message.createdAt)}</span>
        </div>

        <p className={`${styles.content} ${message.isDeleted ? styles.deletedContent : ""}`}>
          {message.content || <em style={{ opacity: 0.5 }}>(aucun contenu)</em>}
          {message.isDeleted && (
            <span className={styles.deletedLabel}>— supprimé</span>
          )}
          {isEdited && (
            <button className={styles.editedBadge} onClick={() => onShowHistory(message.messageID)}>
              (édité)
            </button>
          )}
        </p>

        {message.attachments.map((a) => (
          <AttachmentRow key={a.id} attachment={a} />
        ))}
      </div>
    </div>
  );
}
