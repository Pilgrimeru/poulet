"use client";
import type { AttachmentDTO } from "../../types";
import styles from "./AttachmentRow.module.css";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;

function isImage(attachment: AttachmentDTO): boolean {
  if (attachment.contentType.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.test(attachment.filename);
}

export function AttachmentRow({ attachment }: { attachment: AttachmentDTO }) {
  if (isImage(attachment)) {
    return (
      <div className={styles.imageWrapper}>
        <img src={attachment.url} alt={attachment.filename} className={styles.image} />
      </div>
    );
  }

  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className={styles.file}>
      <span className={styles.fileIcon}>📎</span>
      <span className={styles.filename}>{attachment.filename}</span>
      <span className={styles.fileSize}>{formatSize(attachment.size)}</span>
    </a>
  );
}
