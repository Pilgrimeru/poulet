"use client";
import type { MessageSnapshotDTO } from "../../types";
import { AttachmentRow } from "./AttachmentRow";
import styles from "./MessageItem.module.css";

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function ReplyPreview({ messageID, author, content, onScrollTo }: Readonly<{
  messageID: string;
  author: string | null;
  content: string | null;
  onScrollTo: (id: string) => void;
}>) {
  return (
    <button className={styles.replyPreview} onClick={() => onScrollTo(messageID)}>
      <span className={styles.replyAuthor}>{author}</span>
      <span className={styles.replyContent}>
        {content ? truncate(content, 80) : <em>(aucun contenu)</em>}
      </span>
    </button>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  message: MessageSnapshotDTO;
  onShowHistory: (messageID: string) => void;
  onScrollToMessage: (messageID: string) => void;
  isHighlighted: boolean;
}

export function MessageItem({ message, onShowHistory, onScrollToMessage, isHighlighted }: Readonly<Props>) {
  // version > 1 means at least one edit existed before deletion (version 0=original, last=deleted snapshot)
  const isEdited = message.isDeleted ? message.version > 1 : message.version > 0;

  return (
    <div
      className={`${styles.row} ${message.isDeleted ? styles.deleted : ""} ${isHighlighted ? styles.highlighted : ""}`}
      data-message-id={message.messageID}
    >
      {message.authorAvatarURL ? (
        <img src={message.authorAvatarURL} alt="" className={styles.avatar} />
      ) : (
        <div className={styles.avatarFallback}>
          {message.authorDisplayName.charAt(0) || "?"}
        </div>
      )}

      <div className={styles.body}>
        {message.referencedMessageID && (
          <ReplyPreview
            messageID={message.referencedMessageID}
            author={message.referencedMessageAuthor}
            content={message.referencedMessageContent}
            onScrollTo={onScrollToMessage}
          />
        )}
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
