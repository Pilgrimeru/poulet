"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Moderation.module.css";
import { SEVERITY_LABELS, SEVERITY_LEVELS, TYPE_LABELS } from "./constants";
import { formatDate, formatDuration, truncate } from "./helpers";
import { Avatar, UserCard, useUserMeta } from "./userMeta";
import type { ContextMessage, SanctionDraft, SanctionState, Severity } from "./types";

export function IconEdit() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconSave() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" /><path d="M7 3v5h8" />
    </svg>
  );
}

export function IconUndo() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" /><path d="M4 9h9a7 7 0 1 1 0 14h-1" />
    </svg>
  );
}

export function IconExternalLink() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function SeverityTag({ value, onChange }: Readonly<{ value: Severity; onChange?: (value: Severity) => void }>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={styles.severityWrap} ref={ref}>
      <button
        className={`${styles.severityTag} ${styles[`sev${value}`]}`}
        onClick={() => onChange && setOpen((current) => !current)}
        title={onChange ? "Changer la sévérité" : undefined}
        aria-haspopup={onChange ? "listbox" : undefined}
        aria-expanded={onChange ? open : undefined}
      >
        {SEVERITY_LABELS[value]}
        {onChange && <span className={styles.severityArrow} aria-hidden>▾</span>}
      </button>
      {open && onChange && (
        <div className={styles.severityDropdown} role="listbox" aria-label="Changer la sévérité">
          {SEVERITY_LEVELS.map((level) => (
            <button
              key={level}
              role="option"
              aria-selected={level === value}
              className={`${styles.severityOption} ${level === value ? styles.severityOptionActive : ""} ${styles[`sev${level}`]}`}
              onClick={() => {
                onChange(level);
                setOpen(false);
              }}
            >
              {SEVERITY_LABELS[level]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarCard(props: {
  guildID: string;
  title: string;
  userID: string;
  body?: string | null;
  active?: boolean;
  onClick: () => void;
  severity?: Severity;
  state?: SanctionState;
  date: string;
}) {
  const meta = useUserMeta(props.guildID, props.userID);
  const name = meta?.displayName || meta?.username || props.userID;

  return (
    <button className={`${styles.card} ${props.active ? styles.cardActive : ""}`} onClick={props.onClick} aria-pressed={props.active}>
      <div className={styles.cardRow}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={30} />
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{name}</div>
          <div className={styles.cardDate}>{props.date}</div>
        </div>
        {props.severity && <span className={`${styles.pill} ${styles[`sev${props.severity}`]}`}>{SEVERITY_LABELS[props.severity]}</span>}
        {props.state !== undefined && <span className={`${styles.pill} ${props.state === "created" ? styles.pillActive : styles.pillInactive}`}>{props.state === "created" ? "Active" : "Levée"}</span>}
      </div>
      <div className={styles.cardBadgeRow}>
        <span className={styles.cardKindBadge}>{props.title}</span>
      </div>
      {props.body && <div className={styles.cardExcerpt}>{props.body}</div>}
    </button>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: Readonly<{ title: string; children: React.ReactNode; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useRef(`collapsible-${Math.random().toString(36).slice(2)}`);

  return (
    <section className={styles.section}>
      <button className={styles.collapsibleBtn} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={id.current}>
        <span>{title}</span>
        <span className={styles.collapsibleIcon} aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div id={id.current} className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

export function ContextViewer({ messages, highlightMessageID }: Readonly<{ messages: ContextMessage[]; highlightMessageID?: string | null }>) {
  if (messages.length === 0) return <div className={styles.listEmpty}>Aucun message de contexte.</div>;

  return (
    <div className={styles.ctxViewer}>
      {messages.map((message) => {
        const authorName = message.authorUsername || message.authorID;
        const isHighlighted = highlightMessageID === message.id;

        return (
          <article key={message.id} className={`${styles.ctxMessage} ${isHighlighted ? styles.ctxMessageHighlight : ""}`}>
            <Avatar src={message.authorAvatarURL ?? ""} name={authorName} size={32} />
            <div className={styles.ctxBody}>
              {message.referencedMessageID && (
                <div className={styles.ctxReply}>
                  <span className={styles.ctxReplyAuthor}>{message.referencedAuthorUsername || message.referencedAuthorID || "Message référencé"}</span>
                  <span className={styles.ctxReplyContent}>{truncate(message.referencedContent, 80)}</span>
                </div>
              )}
              <div className={styles.ctxMeta}>
                <span className={styles.ctxAuthor}>{authorName}</span>
                <span className={styles.ctxTimestamp}>{formatDate(message.createdAt)}</span>
              </div>
              <div className={styles.ctxContent}>{message.content || <em>(aucun contenu)</em>}</div>
              {message.attachments && message.attachments.length > 0 && (
                <div className={styles.ctxAttachments}>
                  {message.attachments.map((attachment) => (
                    attachment.contentType?.startsWith("image/") ? (
                      <img key={`${message.id}-${attachment.url}`} src={attachment.url} alt={attachment.filename} className={styles.ctxAttachmentImg} />
                    ) : (
                      <a key={`${message.id}-${attachment.url}`} href={attachment.url} target="_blank" rel="noreferrer" className={styles.ctxAttachmentFile}>
                        {attachment.filename}
                      </a>
                    )
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SanctionEditor({ draft, onChange, isEditing }: Readonly<{ draft: SanctionDraft; onChange: (draft: SanctionDraft) => void; isEditing: boolean }>) {
  return (
    <>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label className={styles.label}>Gravité</label>
          {isEditing ? (
            <select className={styles.select} value={draft.severity} onChange={(event) => onChange({ ...draft, severity: event.target.value as Severity })}>
              {SEVERITY_LEVELS.map((level) => (
                <option key={level} value={level}>{SEVERITY_LABELS[level]}</option>
              ))}
            </select>
          ) : (
            <div className={styles.readValue}>{SEVERITY_LABELS[draft.severity]}</div>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          {isEditing ? (
            <select className={styles.select} value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as SanctionDraft["type"] })}>
              <option value="WARN_LOW">Avertissement faible</option>
              <option value="WARN_MEDIUM">Avertissement moyen</option>
              <option value="WARN_HIGH">Avertissement élevé</option>
              <option value="MUTE">Exclusion</option>
              <option value="BAN_PENDING">Ban en attente</option>
            </select>
          ) : (
            <div className={styles.readValue}>{TYPE_LABELS[draft.type]}</div>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Durée (min)</label>
          {isEditing ? (
            <input
              className={styles.input}
              type="number"
              min={0}
              placeholder="—"
              value={draft.durationMs === null ? "" : Math.floor(draft.durationMs / 60_000)}
              onChange={(event) => {
                const value = event.target.value.trim();
                onChange({ ...draft, durationMs: value === "" ? null : Number(value) * 60_000 });
              }}
            />
          ) : (
            <div className={styles.readValue}>{formatDuration(draft.durationMs)}</div>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Motif</label>
        {isEditing ? (
          <textarea className={styles.textarea} value={draft.reason} onChange={(event) => onChange({ ...draft, reason: event.target.value })} />
        ) : (
          <div className={styles.block}>
            <p className={styles.blockText}>{draft.reason}</p>
          </div>
        )}
      </div>
    </>
  );
}

export { UserCard };
