"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Moderation.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "appeals" | "sanctions" | "reports" | "flags";
type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
type SanctionType = "WARN_LOW" | "WARN_MEDIUM" | "WARN_HIGH" | "MUTE" | "BAN_PENDING";
type SanctionNature = "Extremism" | "Violence" | "Hate" | "Harassment" | "Spam" | "Manipulation" | "Recidivism" | "Other";
type SanctionState = "created" | "canceled";
type AppealStatus = "pending_review" | "upheld" | "overturned";
type ModerationReportStatus =
  | "awaiting_ai"
  | "awaiting_reporter"
  | "awaiting_confirmation"
  | "needs_followup"
  | "ready"
  | "sanctioned"
  | "dismissed";
type FlaggedMessageStatus = "pending" | "analyzed" | "dismissed" | "escalated" | "needs_certification" | "sanctioned";

type UserMeta = {
  userID: string;
  username: string;
  displayName: string;
  avatarURL: string;
};

type SanctionItem = {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: SanctionType;
  severity: Severity;
  nature: SanctionNature;
  state: SanctionState;
  reason: string;
  durationMs: number | null;
  createdAt: number;
};

type AppealItem = {
  id: string;
  sanctionID: string;
  text: string;
  status: AppealStatus;
  reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith" | null;
  resolutionReason: string | null;
  revisedSanction: SanctionDraft | null;
  reviewedAt: number | null;
  createdAt: number;
};

type FlagAnalysis = {
  isViolation?: boolean;
  severity?: Severity;
  reason?: string;
  nature?: SanctionNature;
  victimUserID?: string | null;
  needsMoreContext?: boolean;
  sanctionKind?: SanctionType | null;
  similarSanctionIDs?: string[];
};

type AiSummary = {
  isViolation?: boolean;
  severity?: Severity;
  reason?: string;
  nature?: SanctionNature;
  victimUserID?: string | null;
  summary?: string;
};

type ContextMessage = {
  id: string;
  authorID: string;
  authorUsername: string;
  authorAvatarURL?: string;
  content: string;
  createdAt: number;
  referencedMessageID?: string | null;
  referencedAuthorID?: string | null;
  referencedAuthorUsername?: string | null;
  referencedContent?: string | null;
  attachments?: Array<{ url: string; contentType: string; filename: string }>;
};

type FlaggedMessageItem = {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: FlaggedMessageStatus;
  aiAnalysis: FlagAnalysis | null;
  sanctionID: string | null;
  context: ContextMessage[] | null;
  createdAt: number;
};

type ModerationReportItem = {
  id: string;
  guildID: string;
  reporterID: string;
  targetUserID: string;
  ticketChannelID: string;
  status: ModerationReportStatus;
  reporterSummary: string;
  confirmationCount?: number;
  sanctionID: string | null;
  context: { messages: ContextMessage[]; aiSummary?: AiSummary } | null;
  createdAt: number;
};

type SanctionDraft = {
  type: SanctionType;
  severity: Severity;
  nature: SanctionNature;
  reason: string;
  durationMs: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_LEVELS: Severity[] = ["NONE", "LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

const SEVERITY_LABELS: Record<Severity, string> = {
  NONE: "Aucune",
  LOW: "Faible",
  MEDIUM: "Modérée",
  HIGH: "Grave",
  UNFORGIVABLE: "Impardonnable",
};

const NATURE_LABELS: Record<SanctionNature, string> = {
  Extremism: "Extrémisme",
  Violence: "Violence",
  Hate: "Haine",
  Harassment: "Harcèlement",
  Spam: "Spam",
  Manipulation: "Manipulation",
  Recidivism: "Récidive",
  Other: "Autre",
};

const TYPE_LABELS: Record<SanctionType, string> = {
  WARN_LOW: "Avertissement faible",
  WARN_MEDIUM: "Avertissement moyen",
  WARN_HIGH: "Avertissement élevé",
  MUTE: "Exclusion",
  BAN_PENDING: "Ban en attente",
};

const REPORT_STATUS_LABELS: Record<ModerationReportStatus, string> = {
  awaiting_ai: "En attente IA",
  awaiting_reporter: "À compléter",
  awaiting_confirmation: "À confirmer",
  needs_followup: "À compléter",
  ready: "Prêt",
  sanctioned: "Sanctionné",
  dismissed: "Classé",
};

const FLAG_STATUS_LABELS: Record<FlaggedMessageStatus, string> = {
  pending: "En attente",
  analyzed: "Analysé",
  dismissed: "Classé",
  escalated: "Escaladé",
  needs_certification: "À certifier",
  sanctioned: "Sanctionné",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

function formatDuration(value: number | null): string {
  if (value === null) return "—";
  const minutes = Math.ceil(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.ceil(hours / 24)} j`;
}

function toDraft(s: SanctionItem): SanctionDraft {
  return { type: s.type, severity: s.severity, nature: s.nature, reason: s.reason, durationMs: s.durationMs };
}

function getStatusClassName(status: ModerationReportStatus | FlaggedMessageStatus): string {
  if (status === "sanctioned") return styles.statusSanctioned;
  if (status === "dismissed") return styles.statusDismissed;
  if (status === "ready" || status === "awaiting_confirmation") return styles.statusReady;
  if (status === "needs_followup" || status === "awaiting_reporter" || status === "needs_certification") return styles.statusNeedsFollowup;
  return styles.statusNeutral;
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function getActionableReportCount(items: ModerationReportItem[]): number {
  return items.filter((item) => item.status !== "sanctioned" && item.status !== "dismissed").length;
}

function getActionableFlagCount(items: FlaggedMessageItem[]): number {
  return items.filter((item) => item.status !== "sanctioned" && item.status !== "dismissed").length;
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAppeals(guildID: string, status?: AppealStatus): Promise<AppealItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const r = await fetch(`/api/guilds/${guildID}/appeals${query}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch appeals");
  return ((await r.json()) as AppealItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

async function fetchSanctions(guildID: string): Promise<SanctionItem[]> {
  const r = await fetch(`/api/guilds/${guildID}/sanctions`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch sanctions");
  return ((await r.json()) as SanctionItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

async function fetchReports(guildID: string): Promise<ModerationReportItem[]> {
  const r = await fetch(`/api/guilds/${guildID}/moderation-reports`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch reports");
  return ((await r.json()) as ModerationReportItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

async function fetchFlags(guildID: string): Promise<FlaggedMessageItem[]> {
  const r = await fetch(`/api/guilds/${guildID}/flagged-messages`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch flags");
  return ((await r.json()) as FlaggedMessageItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

async function patchAppeal(
  guildID: string,
  appealID: string,
  patch: {
    status?: AppealStatus;
    reviewOutcome?: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith";
    resolutionReason: string;
    revisedSanction?: SanctionDraft;
    badFaithSanction?: SanctionDraft;
  },
) {
  const r = await fetch(`/api/guilds/${guildID}/appeals/${appealID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const payload = await r.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "Failed to update appeal");
  }
}

async function patchSanction(guildID: string, sanctionID: string, patch: Partial<SanctionDraft> & { state?: SanctionState }): Promise<SanctionItem> {
  const r = await fetch(`/api/guilds/${guildID}/sanctions/${sanctionID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Failed to update sanction");
  return r.json() as Promise<SanctionItem>;
}

// ─── User meta cache + hooks ──────────────────────────────────────────────────

const userMetaCache = new Map<string, UserMeta>();

function useUserMeta(guildID: string, userID: string | null | undefined): UserMeta | null {
  const [meta, setMeta] = useState<UserMeta | null>(() => {
    if (!guildID || !userID) return null;
    return userMetaCache.get(`${guildID}:${userID}`) ?? null;
  });

  useEffect(() => {
    if (!guildID || !userID) return;
    const key = `${guildID}:${userID}`;
    if (userMetaCache.has(key)) { setMeta(userMetaCache.get(key)!); return; }
    fetch(`/api/guilds/${guildID}/users/${userID}`)
      .then((r) => r.json() as Promise<UserMeta>)
      .then((data) => { userMetaCache.set(key, data); setMeta(data); })
      .catch(() => null);
  }, [guildID, userID]);

  return meta;
}

function usePreloadUserMetas(guildID: string, userIDs: string[]) {
  const joined = userIDs.join(",");
  useEffect(() => {
    if (!guildID) return;
    for (const userID of userIDs) {
      const key = `${guildID}:${userID}`;
      if (userMetaCache.has(key)) continue;
      fetch(`/api/guilds/${guildID}/users/${userID}`)
        .then((r) => r.json() as Promise<UserMeta>)
        .then((data) => { userMetaCache.set(key, data); })
        .catch(() => null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildID, joined]);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconEdit() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" /><path d="M7 3v5h8" />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" /><path d="M4 9h9a7 7 0 1 1 0 14h-1" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 32 }: Readonly<{ src: string; name: string; size?: number }>) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
        {name ? name.slice(0, 2).toUpperCase() : "?"}
      </div>
    );
  }
  return <img src={src} alt={name} className={styles.avatarImg} style={{ width: size, height: size }} onError={() => setErr(true)} />;
}

// ─── UserCard ─────────────────────────────────────────────────────────────────

function UserCard({ guildID, userID, label }: Readonly<{ guildID: string; userID: string; label: string }>) {
  const meta = useUserMeta(guildID, userID);
  const name = meta?.displayName || meta?.username || userID;
  const sub = meta?.username && meta.username !== meta.displayName ? `@${meta.username}` : null;
  const [showID, setShowID] = useState(false);

  return (
    <div className={styles.userCard}>
      <div className={styles.label}>{label}</div>
      <div className={styles.userCardBody}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={38} />
        <div className={styles.userCardInfo}>
          <span className={styles.userCardName}>{name}</span>
          {sub && <span className={styles.userCardSub}>{sub}</span>}
          <button className={styles.userCardIdBtn} onClick={() => setShowID((v) => !v)}>
            {showID ? <span className={styles.userCardIdValue}>{userID}</span> : "Voir ID"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SeverityTag ─────────────────────────────────────────────────────────────

function SeverityTag({ value, onChange }: Readonly<{ value: Severity; onChange?: (v: Severity) => void }>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={styles.severityWrap} ref={ref}>
      <button
        className={`${styles.severityTag} ${styles[`sev${value}`]}`}
        onClick={() => onChange && setOpen((v) => !v)}
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
              onClick={() => { onChange(level); setOpen(false); }}
            >
              {SEVERITY_LABELS[level]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar card ─────────────────────────────────────────────────────────────

function SidebarCard(props: {
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
    <button
      className={`${styles.card} ${props.active ? styles.cardActive : ""}`}
      onClick={props.onClick}
      aria-pressed={props.active}
    >
      <div className={styles.cardRow}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={30} />
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{name}</div>
          <div className={styles.cardDate}>{props.date}</div>
        </div>
        {props.severity && (
          <span className={`${styles.pill} ${styles[`sev${props.severity}`]}`}>
            {SEVERITY_LABELS[props.severity]}
          </span>
        )}
        {props.state !== undefined && (
          <span className={`${styles.pill} ${props.state === "created" ? styles.pillActive : styles.pillInactive}`}>
            {props.state === "created" ? "Active" : "Levée"}
          </span>
        )}
      </div>

      <div className={styles.cardBadgeRow}>
        <span className={styles.cardKindBadge}>{props.title}</span>
      </div>

      {props.body && <div className={styles.cardExcerpt}>{props.body}</div>}
    </button>
  );
}

// ─── Collapsible section ─────────────────────────────────────────────────────

function Collapsible({ title, children, defaultOpen = false }: Readonly<{ title: string; children: React.ReactNode; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useRef(`collapsible-${Math.random().toString(36).slice(2)}`);
  return (
    <section className={styles.section}>
      <button
        className={styles.collapsibleBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id.current}
      >
        <span>{title}</span>
        <span className={styles.collapsibleIcon} aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div id={id.current} className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

function ContextViewer({
  messages,
  highlightMessageID,
}: Readonly<{
  messages: ContextMessage[];
  highlightMessageID?: string | null;
}>) {
  if (messages.length === 0) {
    return <div className={styles.listEmpty}>Aucun message de contexte.</div>;
  }

  return (
    <div className={styles.ctxViewer}>
      {messages.map((message) => {
        const authorName = message.authorUsername || message.authorID;
        const isHighlighted = highlightMessageID === message.id;
        return (
          <article
            key={message.id}
            className={`${styles.ctxMessage} ${isHighlighted ? styles.ctxMessageHighlight : ""}`}
          >
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
                      <img
                        key={`${message.id}-${attachment.url}`}
                        src={attachment.url}
                        alt={attachment.filename}
                        className={styles.ctxAttachmentImg}
                      />
                    ) : (
                      <a
                        key={`${message.id}-${attachment.url}`}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.ctxAttachmentFile}
                      >
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

function ReportDetail({
  guildID,
  report,
  linkedSanction,
  onNavigateToSanction,
}: Readonly<{
  guildID: string;
  report: ModerationReportItem;
  linkedSanction: SanctionItem | null;
  onNavigateToSanction: (sanctionID: string) => void;
}>) {
  const aiSummary = report.context?.aiSummary ?? null;

  return (
    <section className={styles.hero} aria-label="Détail du signalement">
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <span className={styles.heroKind}>Signalement</span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>{formatDate(report.createdAt)}</span>
            <span className={`${styles.statusBadge} ${getStatusClassName(report.status)}`}>{REPORT_STATUS_LABELS[report.status]}</span>
            {aiSummary?.severity && <SeverityTag value={aiSummary.severity} />}
            {aiSummary?.nature && <span className={styles.categoryBadge}>{NATURE_LABELS[aiSummary.nature]}</span>}
          </div>
        </div>
      </div>

      <div className={styles.heroBody}>
        <div className={styles.primaryGrid}>
          <section className={styles.panel} aria-label="Résumé du signalement">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Résumé</h2>
            </div>

            <div className={styles.userGrid}>
              <UserCard guildID={guildID} userID={report.reporterID} label="Signalant" />
              <UserCard guildID={guildID} userID={report.targetUserID} label="Mis en cause" />
            </div>

            <div className={styles.factsGrid}>
              <div className={styles.fact}>
                <span className={styles.label}>Confirmations</span>
                <span className={styles.factValue}>{report.confirmationCount ?? 0}</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.label}>Violation IA</span>
                <span className={styles.factValue}>{aiSummary?.isViolation ? "Oui" : "Non"}</span>
              </div>
            </div>

            <div className={styles.block}>
              <div className={styles.label}>Résumé du signalant</div>
              <p className={styles.blockText}>{report.reporterSummary || "—"}</p>
            </div>

            {aiSummary?.summary && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Synthèse IA</div>
                <p className={styles.blockTextMuted}>{aiSummary.summary}</p>
              </div>
            )}

            {aiSummary?.reason && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Motif IA</div>
                <p className={styles.blockTextMuted}>{aiSummary.reason}</p>
              </div>
            )}
          </section>

          <section className={styles.panel} aria-label="Sanction liée au signalement">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Sanction liée</h2>
            </div>

            {linkedSanction ? (
              <>
                <div className={styles.factsGrid}>
                  <div className={styles.fact}>
                    <span className={styles.label}>Type</span>
                    <span className={styles.factValue}>{TYPE_LABELS[linkedSanction.type]}</span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.label}>Sévérité</span>
                    <span className={styles.factValue}>{SEVERITY_LABELS[linkedSanction.severity]}</span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.label}>Nature</span>
                    <span className={styles.factValue}>{NATURE_LABELS[linkedSanction.nature]}</span>
                  </div>
                </div>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onNavigateToSanction(linkedSanction.id)}>
                  Voir la sanction →
                </button>
              </>
            ) : (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Statut</div>
                <p className={styles.blockTextMuted}>Aucune sanction liée.</p>
              </div>
            )}
          </section>
        </div>

        <Collapsible title="Messages de contexte" defaultOpen>
          <ContextViewer messages={report.context?.messages ?? []} />
        </Collapsible>
      </div>
    </section>
  );
}

function FlagDetail({
  guildID,
  flag,
  linkedSanction,
  allSanctions,
  onNavigateToSanction,
}: Readonly<{
  guildID: string;
  flag: FlaggedMessageItem;
  linkedSanction: SanctionItem | null;
  allSanctions: SanctionItem[];
  onNavigateToSanction: (sanctionID: string) => void;
}>) {
  const flaggedMessage = flag.context?.find((message) => message.id === flag.messageID) ?? null;
  const similarSanctions = (flag.aiAnalysis?.similarSanctionIDs ?? []).map((id) => ({
    id,
    sanction: allSanctions.find((item) => item.id === id) ?? null,
  }));

  return (
    <section className={styles.hero} aria-label="Détail du message signalé">
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <span className={styles.heroKind}>Message signalé</span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>{formatDate(flag.createdAt)}</span>
            <span className={`${styles.statusBadge} ${getStatusClassName(flag.status)}`}>{FLAG_STATUS_LABELS[flag.status]}</span>
            {flag.aiAnalysis?.severity && <SeverityTag value={flag.aiAnalysis.severity} />}
            {flag.aiAnalysis?.nature && <span className={styles.categoryBadge}>{NATURE_LABELS[flag.aiAnalysis.nature]}</span>}
          </div>
        </div>
      </div>

      <div className={styles.heroBody}>
        <div className={styles.primaryGrid}>
          <section className={styles.panel} aria-label="Analyse du message signalé">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Analyse</h2>
            </div>

            <div className={styles.userGrid}>
              <UserCard guildID={guildID} userID={flag.reporterID} label="Signalant" />
              <UserCard guildID={guildID} userID={flag.targetUserID} label="Mis en cause" />
            </div>

            <div className={styles.block}>
              <div className={styles.label}>Message signalé</div>
              <p className={styles.blockText}>{flaggedMessage?.content || "Message introuvable dans le contexte."}</p>
            </div>

            <div className={`${styles.block} ${styles.blockMuted}`}>
              <div className={styles.label}>Analyse IA</div>
              <div className={styles.aiFlags}>
                <span className={styles.aiFlag}>{flag.aiAnalysis?.isViolation ? "Violation probable" : "Violation non confirmée"}</span>
                {flag.aiAnalysis?.needsMoreContext && <span className={styles.aiFlag}>Contexte insuffisant</span>}
                {flag.aiAnalysis?.sanctionKind && <span className={styles.aiFlag}>{TYPE_LABELS[flag.aiAnalysis.sanctionKind]}</span>}
              </div>
              <p className={styles.blockTextMuted}>{flag.aiAnalysis?.reason || "—"}</p>
            </div>
          </section>

          <section className={styles.panel} aria-label="Sanctions liées et similaires">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Sanctions</h2>
            </div>

            {linkedSanction ? (
              <div className={styles.block}>
                <div className={styles.label}>Sanction liée</div>
                <p className={styles.blockText}>
                  {TYPE_LABELS[linkedSanction.type]} · {SEVERITY_LABELS[linkedSanction.severity]} · {NATURE_LABELS[linkedSanction.nature]}
                </p>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onNavigateToSanction(linkedSanction.id)}>
                  Voir la sanction →
                </button>
              </div>
            ) : (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Sanction liée</div>
                <p className={styles.blockTextMuted}>Aucune sanction liée.</p>
              </div>
            )}

            <Collapsible title="Sanctions similaires" defaultOpen={similarSanctions.length > 0}>
              {similarSanctions.length === 0 ? (
                <div className={styles.listEmpty}>Aucune sanction similaire proposée.</div>
              ) : (
                <div className={styles.similarList}>
                  {similarSanctions.map(({ id, sanction }) => (
                    <div key={id} className={styles.similarItem}>
                      {sanction ? (
                        <>
                          <div className={styles.similarItemMeta}>
                            <span>{TYPE_LABELS[sanction.type]}</span>
                            <span>{SEVERITY_LABELS[sanction.severity]}</span>
                            <span>{formatDate(sanction.createdAt)}</span>
                          </div>
                          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onNavigateToSanction(sanction.id)}>
                            Voir →
                          </button>
                        </>
                      ) : (
                        <span className={styles.similarItemId}>{id}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Collapsible>
          </section>
        </div>

        <Collapsible title="Messages de contexte" defaultOpen>
          <ContextViewer messages={flag.context ?? []} highlightMessageID={flag.messageID} />
        </Collapsible>
      </div>
    </section>
  );
}

// ─── SanctionEditor ──────────────────────────────────────────────────────────

function SanctionEditor({
  draft,
  onChange,
  isEditing,
}: Readonly<{
  draft: SanctionDraft;
  onChange: (d: SanctionDraft) => void;
  isEditing: boolean;
}>) {
  return (
    <>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label className={styles.label}>Gravité</label>
          {isEditing ? (
            <select
              className={styles.select}
              value={draft.severity}
              onChange={(e) => onChange({ ...draft, severity: e.target.value as Severity })}
            >
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
            <select
              className={styles.select}
              value={draft.type}
              onChange={(e) => onChange({ ...draft, type: e.target.value as SanctionType })}
            >
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
              onChange={(e) => {
                const v = e.target.value.trim();
                onChange({ ...draft, durationMs: v === "" ? null : Number(v) * 60_000 });
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
          <textarea
            className={styles.textarea}
            value={draft.reason}
            onChange={(e) => onChange({ ...draft, reason: e.target.value })}
          />
        ) : (
          <div className={styles.block}>
            <p className={styles.blockText}>{draft.reason}</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── AppealDetail ─────────────────────────────────────────────────────────────

function AppealDetail({
  guildID,
  appeal,
  linkedSanction,
  sourceMeta,
  onDecision,
}: Readonly<{
  guildID: string;
  appeal: AppealItem;
  linkedSanction: SanctionItem | null;
  sourceMeta: { kind: "flag"; data: FlaggedMessageItem } | { kind: "report"; data: ModerationReportItem } | null;
  onDecision: (decision: {
    reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith";
    resolutionReason: string;
    revisedSanction?: SanctionDraft;
    badFaithSanction?: SanctionDraft;
  }) => Promise<void>;
}>) {
  const [draft, setDraft] = useState<SanctionDraft | null>(linkedSanction ? toDraft(linkedSanction) : null);
  const [resolutionReason, setResolutionReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reasonFlash, setReasonFlash] = useState(false);
  const reasonMissing = resolutionReason.trim().length === 0;
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isResolved = appeal.status !== "pending_review";

  useEffect(() => {
    setDraft(linkedSanction ? toDraft(linkedSanction) : null);
    setIsEditing(false);
    setResolutionReason(appeal.resolutionReason ?? "");
    setReasonFlash(false);
  }, [appeal.id, appeal.resolutionReason, linkedSanction?.id]);

  useEffect(() => {
    if (!reasonFlash) return;
    const timeout = window.setTimeout(() => setReasonFlash(false), 650);
    return () => window.clearTimeout(timeout);
  }, [reasonFlash]);

  const aiSummary = sourceMeta?.kind === "report" ? sourceMeta.data.context?.aiSummary : null;
  const aiAnalysis = sourceMeta?.kind === "flag" ? sourceMeta.data.aiAnalysis : null;
  const reporterID = sourceMeta?.data.reporterID ?? null;
  const targetUserID = linkedSanction?.userID ?? null;

  const triggerReasonFlash = () => {
    setReasonFlash(false);
    requestAnimationFrame(() => setReasonFlash(true));
    reasonTextareaRef.current?.focus();
  };

  const handleSanctionSave = async () => {
    if (!linkedSanction || !draft) return;
    if (reasonMissing) {
      triggerReasonFlash();
      return;
    }
    await onDecision({
      reviewOutcome: "modified",
      resolutionReason,
      revisedSanction: draft,
    });
  };

  return (
    <section className={styles.hero} aria-label="Détail de l'appel">
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <span className={styles.heroKind}>{isResolved ? "Appel résolu" : "Appel en attente"}</span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>{formatDate(appeal.createdAt)}</span>
            <span className={`${styles.statusBadge} ${getStatusClassName(isResolved ? "sanctioned" : "pending")}`}>
              {isResolved ? (appeal.reviewOutcome === "overturned" ? "Accepté" : "Traité") : "En attente"}
            </span>
            {linkedSanction && (
              <span className={`${styles.pill} ${styles[`sev${linkedSanction.severity}`]}`}>
                {SEVERITY_LABELS[linkedSanction.severity]}
              </span>
            )}
            {linkedSanction && (
              <span className={styles.categoryBadge}>{NATURE_LABELS[linkedSanction.nature]}</span>
            )}
          </div>
        </div>

        {!isResolved && (
          <div className={styles.actionGroup}>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => {
              if (reasonMissing) {
                triggerReasonFlash();
                return;
              }
              void onDecision({ reviewOutcome: "upheld", resolutionReason });
            }}
          >
            Rejeter l'appel
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => {
              if (reasonMissing) {
                triggerReasonFlash();
                return;
              }
              void onDecision({ reviewOutcome: "overturned", resolutionReason });
            }}
          >
            Accepter · lever la sanction
          </button>
          </div>
        )}
      </div>

      <div className={styles.heroBody}>
        <div className={styles.primaryGrid}>
          {/* Dossier */}
          <section className={styles.panel} aria-label="Dossier">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Dossier</h2>
            </div>

            {(targetUserID || reporterID) && (
              <div className={styles.userGrid}>
                {targetUserID && <UserCard guildID={guildID} userID={targetUserID} label="Utilisateur sanctionné" />}
                {reporterID && <UserCard guildID={guildID} userID={reporterID} label="Signalé par" />}
              </div>
            )}

            <div className={styles.block}>
              <div className={styles.label}>Déclaration d'appel</div>
              <p className={styles.blockText}>{appeal.text || "—"}</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Motif de décision modérateur</label>
              {isResolved ? (
                <div className={styles.block}>
                  <p className={styles.blockText}>{appeal.resolutionReason || "—"}</p>
                </div>
              ) : (
                <>
                  <textarea
                    ref={reasonTextareaRef}
                    className={`${styles.textarea} ${reasonFlash ? styles.textareaFlashError : ""}`}
                    value={resolutionReason}
                    onChange={(e) => setResolutionReason(e.target.value)}
                    placeholder="Explique la décision humaine prise sur cet appel."
                  />
                  {reasonMissing && (
                    <div className={styles.panelHint}>Un motif de décision est requis avant de trancher cet appel.</div>
                  )}
                </>
              )}
            </div>

            {aiAnalysis && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Analyse IA</div>
                <p className={styles.blockTextMuted}>{aiAnalysis.reason}</p>
                {aiAnalysis.needsMoreContext && (
                  <span className={styles.aiFlag} style={{ marginTop: 6, display: "inline-flex" }}>Contexte insuffisant</span>
                )}
              </div>
            )}

            {aiSummary?.summary && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Synthèse IA (QQOQCCP)</div>
                <p className={styles.blockTextMuted}>{aiSummary.summary}</p>
              </div>
            )}

            {sourceMeta?.kind === "flag" && (
              <a
                className={styles.messageLink}
                href={`/history?guild=${encodeURIComponent(guildID)}&channel=${encodeURIComponent(sourceMeta.data.channelID)}&message=${encodeURIComponent(sourceMeta.data.messageID)}`}
              >
                <IconExternalLink />
                Ouvrir dans l'historique
              </a>
            )}
          </section>

          {/* Sanction liée */}
          <section className={styles.panel} aria-label="Sanction liée">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Sanction liée</h2>
              <div className={styles.panelHint}>Vérifie ou ajuste avant de trancher</div>
            </div>

            {linkedSanction && draft ? (
              <>
                <SanctionEditor draft={appeal.revisedSanction ?? draft} onChange={setDraft} isEditing={!isResolved && isEditing} />

                {!isResolved && (
                  <div className={styles.actionBar}>
                    <div className={styles.actionGroup}>
                      {!isEditing ? (
                        <button
                          className={`${styles.btn} ${styles.btnGhost} ${styles.iconOnly}`}
                          onClick={() => setIsEditing(true)}
                          title="Modifier la sanction"
                          aria-label="Modifier la sanction"
                        >
                          <IconEdit />
                        </button>
                      ) : (
                        <>
                          <button
                            className={`${styles.btn} ${styles.btnPrimary} ${styles.iconOnly}`}
                            onClick={() => void handleSanctionSave()}
                            title="Enregistrer"
                          >
                            <IconSave />
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnDanger}`}
                            onClick={() => {
                              if (reasonMissing) {
                                triggerReasonFlash();
                                return;
                              }
                              void onDecision({
                                reviewOutcome: "sanctioned_bad_faith",
                                resolutionReason,
                                badFaithSanction: {
                                  ...draft,
                                  reason: resolutionReason,
                                },
                              });
                            }}
                            title="Sanctionner l'appel de mauvaise foi"
                          >
                            Mauvaise foi
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnGhost} ${styles.iconOnly}`}
                            onClick={() => { setDraft(toDraft(linkedSanction)); setIsEditing(false); }}
                            title="Annuler"
                          >
                            <IconUndo />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune sanction liée à cet appel.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function ModerationInner() {
  const searchParams = useSearchParams();
  const guildID = searchParams.get("guild") ?? "";

  const [tab, setTab] = useState<Tab>("appeals");
  const [appeals, setAppeals] = useState<AppealItem[] | null>(null);
  const [sanctions, setSanctions] = useState<SanctionItem[] | null>(null);
  const [reports, setReports] = useState<ModerationReportItem[] | null>(null);
  const [flags, setFlags] = useState<FlaggedMessageItem[] | null>(null);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [selectedSanctionId, setSelectedSanctionId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [sanctionDraft, setSanctionDraft] = useState<SanctionDraft | null>(null);
  const [isEditingSanction, setIsEditingSanction] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [appealFilter, setAppealFilter] = useState<"pending_review" | "all">("pending_review");

  const refreshData = useCallback(async (preserveSelection = true) => {
    if (!guildID) return;
    const [a, s, r, f] = await Promise.all([
      fetchAppeals(guildID, appealFilter === "all" ? undefined : "pending_review"),
      fetchSanctions(guildID),
      fetchReports(guildID),
      fetchFlags(guildID),
    ]);

    setAppeals(a);
    setSanctions(s);
    setReports(r);
    setFlags(f);
    setSelectedAppealId((current) => {
      if (preserveSelection && current && a.some((item) => item.id === current)) return current;
      return a[0]?.id ?? null;
    });
    setSelectedSanctionId((current) => {
      if (preserveSelection && current && s.some((item) => item.id === current)) return current;
      return s[0]?.id ?? null;
    });
    setSelectedReportId((current) => {
      if (preserveSelection && current && r.some((item) => item.id === current)) return current;
      return r[0]?.id ?? null;
    });
    setSelectedFlagId((current) => {
      if (preserveSelection && current && f.some((item) => item.id === current)) return current;
      return f[0]?.id ?? null;
    });
  }, [appealFilter, guildID]);

  useEffect(() => {
    refreshData(false).catch(() => { setAppeals([]); setSanctions([]); setReports([]); setFlags([]); });
  }, [refreshData]);

  useEffect(() => {
    if (!guildID) return;

    const interval = window.setInterval(() => {
      refreshData(true).catch(() => undefined);
    }, 10_000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshData(true).catch(() => undefined);
      }
    }

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [guildID, refreshData]);

  const preloadUserIDs = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sanctions ?? []) { ids.add(s.userID); ids.add(s.moderatorID); }
    for (const r of reports ?? []) { ids.add(r.reporterID); ids.add(r.targetUserID); }
    for (const f of flags ?? []) { ids.add(f.reporterID); ids.add(f.targetUserID); }
    return [...ids];
  }, [flags, reports, sanctions]);

  usePreloadUserMetas(guildID, preloadUserIDs);

  const selectedAppeal = useMemo(
    () => appeals?.find((i) => i.id === selectedAppealId) ?? appeals?.[0] ?? null,
    [appeals, selectedAppealId],
  );
  const selectedSanction = useMemo(
    () => sanctions?.find((i) => i.id === selectedSanctionId) ?? sanctions?.[0] ?? null,
    [sanctions, selectedSanctionId],
  );
  const selectedReport = useMemo(
    () => reports?.find((item) => item.id === selectedReportId) ?? reports?.[0] ?? null,
    [reports, selectedReportId],
  );
  const selectedFlag = useMemo(
    () => flags?.find((item) => item.id === selectedFlagId) ?? flags?.[0] ?? null,
    [flags, selectedFlagId],
  );

  const linkedSanction = useMemo(
    () => sanctions?.find((i) => i.id === selectedAppeal?.sanctionID) ?? null,
    [sanctions, selectedAppeal],
  );
  const linkedSanctionForReport = useMemo(
    () => sanctions?.find((item) => item.id === selectedReport?.sanctionID) ?? null,
    [sanctions, selectedReport],
  );
  const linkedSanctionForFlag = useMemo(
    () => sanctions?.find((item) => item.id === selectedFlag?.sanctionID) ?? null,
    [sanctions, selectedFlag],
  );
  const appealSourceMeta = useMemo(() => {
    if (!linkedSanction) return null;
    const flag = flags?.find((item) => item.sanctionID === linkedSanction.id);
    if (flag) return { kind: "flag" as const, data: flag };
    const report = reports?.find((item) => item.sanctionID === linkedSanction.id);
    return report ? { kind: "report" as const, data: report } : null;
  }, [flags, linkedSanction, reports]);
  const selectedSanctionSourceMeta = useMemo(() => {
    if (!selectedSanction) return null;
    const flag = flags?.find((item) => item.sanctionID === selectedSanction.id);
    if (flag) return { kind: "flag" as const, data: flag };
    const report = reports?.find((item) => item.sanctionID === selectedSanction.id);
    return report ? { kind: "report" as const, data: report } : null;
  }, [flags, reports, selectedSanction]);

  useEffect(() => {
    if (selectedSanction) {
      setSanctionDraft(toDraft(selectedSanction));
      setIsEditingSanction(false);
      setConfirmRevoke(false);
    }
  }, [selectedSanction?.id]);

  const handleAppealDecision = useCallback(async (decision: {
    reviewOutcome: "upheld" | "overturned" | "modified" | "sanctioned_bad_faith";
    resolutionReason: string;
    revisedSanction?: SanctionDraft;
    badFaithSanction?: SanctionDraft;
  }) => {
    if (!selectedAppeal) return;
    if (!decision.resolutionReason.trim()) {
      throw new Error("Un motif de décision est requis.");
    }
    await patchAppeal(guildID, selectedAppeal.id, decision);
    if (decision.reviewOutcome === "overturned" && selectedAppeal.sanctionID) {
      setSanctions((cur) => cur?.map((i) => (
        i.id === selectedAppeal.sanctionID ? { ...i, state: "canceled" } : i
      )) ?? []);
    }
    if (decision.reviewOutcome === "modified" && selectedAppeal.sanctionID && decision.revisedSanction) {
      setSanctions((cur) => cur?.map((i) => (
        i.id === selectedAppeal.sanctionID ? { ...i, ...decision.revisedSanction } : i
      )) ?? []);
    }
    if (decision.reviewOutcome === "sanctioned_bad_faith" && decision.badFaithSanction && linkedSanction) {
      setSanctions((cur) => [
        {
          id: `tmp-${Date.now()}`,
          guildID,
          userID: linkedSanction.userID,
          moderatorID: linkedSanction.moderatorID,
          type: decision.badFaithSanction?.type,
          severity: decision.badFaithSanction?.severity,
          nature: decision.badFaithSanction?.nature,
          reason: decision.badFaithSanction?.reason,
          durationMs: decision.badFaithSanction?.durationMs,
          state: "created",
          createdAt: Date.now(),
        } as SanctionItem,
        ...(cur ?? []),
      ]);
    }
    const next = (appeals ?? []).filter((i) => i.id !== selectedAppeal.id);
    setAppeals(next);
    setSelectedAppealId(next[0]?.id ?? null);
  }, [guildID, selectedAppeal, appeals, linkedSanction]);

  const handleSanctionSave = useCallback(async () => {
    if (!selectedSanction || !sanctionDraft) return;
    const updated = await patchSanction(guildID, selectedSanction.id, sanctionDraft);
    setSanctions((cur) => cur?.map((i) => (i.id === updated.id ? updated : i)) ?? []);
    setSanctionDraft(toDraft(updated));
    setIsEditingSanction(false);
  }, [guildID, selectedSanction, sanctionDraft]);

  const handleSanctionRevoke = useCallback(async () => {
    if (!selectedSanction) return;
    const updated = await patchSanction(guildID, selectedSanction.id, { state: "canceled" });
    setSanctions((cur) => cur?.map((i) => (i.id === updated.id ? updated : i)) ?? []);
    setSanctionDraft(toDraft(updated));
    setConfirmRevoke(false);
  }, [guildID, selectedSanction]);

  const handleSanctionReopen = useCallback(async () => {
    if (!selectedSanction) return;
    const updated = await patchSanction(guildID, selectedSanction.id, { state: "created" });
    setSanctions((cur) => cur?.map((i) => (i.id === updated.id ? updated : i)) ?? []);
    setSanctionDraft(toDraft(updated));
    setConfirmRevoke(false);
  }, [guildID, selectedSanction]);

  const handleNavigateToSanction = useCallback((sanctionID: string) => {
    setSelectedSanctionId(sanctionID);
    setTab("sanctions");
  }, []);

  const handleNavigateToReport = useCallback((reportID: string) => {
    setSelectedReportId(reportID);
    setTab("reports");
  }, []);

  const handleNavigateToFlag = useCallback((flagID: string) => {
    setSelectedFlagId(flagID);
    setTab("flags");
  }, []);

  if (!guildID) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>⚙️</div>
        Sélectionne un serveur dans la barre du haut.
      </div>
    );
  }

  if (appeals === null || sanctions === null || reports === null || flags === null) {
    return <div className={styles.emptyState}>Chargement…</div>;
  }

  const actionableAppeals = appeals.filter((item) => item.status === "pending_review").length;
  const actionableReports = getActionableReportCount(reports);
  const actionableFlags = getActionableFlagCount(flags);
  const sidebarTitle = tab === "appeals"
    ? (appealFilter === "all" ? "Tous" : "En attente")
    : tab === "sanctions"
      ? "Toutes"
      : tab === "reports"
        ? "Signalements"
        : "Messages signalés";
  const sidebarCount = tab === "appeals"
    ? appeals.length
    : tab === "sanctions"
      ? sanctions.length
      : tab === "reports"
        ? reports.length
        : flags.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Modération</h1>
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={tab === "appeals"}
            className={`${styles.tab} ${tab === "appeals" ? styles.tabActive : ""}`}
            onClick={() => setTab("appeals")}
          >
            Appels
            {actionableAppeals > 0 && (
              <span className={styles.tabBadge} aria-label={`${actionableAppeals} en attente`}>
                {actionableAppeals}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === "sanctions"}
            className={`${styles.tab} ${tab === "sanctions" ? styles.tabActive : ""}`}
            onClick={() => setTab("sanctions")}
          >
            Sanctions
            {sanctions.length > 0 && <span className={styles.tabBadge}>{sanctions.length}</span>}
          </button>
          <button
            role="tab"
            aria-selected={tab === "reports"}
            className={`${styles.tab} ${tab === "reports" ? styles.tabActive : ""}`}
            onClick={() => setTab("reports")}
          >
            Signalements
            {actionableReports > 0 && <span className={styles.tabBadge}>{actionableReports}</span>}
          </button>
          <button
            role="tab"
            aria-selected={tab === "flags"}
            className={`${styles.tab} ${tab === "flags" ? styles.tabActive : ""}`}
            onClick={() => setTab("flags")}
          >
            Messages signalés
            {actionableFlags > 0 && <span className={styles.tabBadge}>{actionableFlags}</span>}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar} aria-label={tab === "appeals" ? "Liste des appels" : tab === "sanctions" ? "Liste des sanctions" : tab === "reports" ? "Liste des signalements" : "Liste des messages signalés"}>
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarTitle}>{sidebarTitle}</span>
            <span className={styles.sidebarCount}>{sidebarCount}</span>
          </div>
          {tab === "appeals" && (
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterPill} ${appealFilter === "pending_review" ? styles.filterPillActive : ""}`}
                onClick={() => setAppealFilter("pending_review")}
              >
                En attente
              </button>
              <button
                className={`${styles.filterPill} ${appealFilter === "all" ? styles.filterPillActive : ""}`}
                onClick={() => setAppealFilter("all")}
              >
                Tous
              </button>
            </div>
          )}
          <div className={styles.list}>
            {tab === "appeals" && appeals.length === 0 && (
              <div className={styles.listEmpty}>Aucun appel</div>
            )}
            {tab === "appeals" && appeals.map((appeal) => {
              const sanction = sanctions.find((s) => s.id === appeal.sanctionID);
              return (
                <SidebarCard
                  key={appeal.id}
                  guildID={guildID}
                  title={sanction ? TYPE_LABELS[sanction.type] : "Appel"}
                  userID={sanction?.userID ?? ""}
                  body={appeal.text}
                  active={selectedAppeal?.id === appeal.id}
                  onClick={() => setSelectedAppealId(appeal.id)}
                  severity={sanction?.severity}
                  date={new Date(appeal.createdAt).toLocaleDateString("fr-FR")}
                />
              );
            })}

            {tab === "sanctions" && sanctions.length === 0 && (
              <div className={styles.listEmpty}>Aucune sanction</div>
            )}
            {tab === "sanctions" && sanctions.map((sanction) => (
              <SidebarCard
                key={sanction.id}
                guildID={guildID}
                title={TYPE_LABELS[sanction.type]}
                userID={sanction.userID}
                body={sanction.reason}
                active={selectedSanction?.id === sanction.id}
                onClick={() => setSelectedSanctionId(sanction.id)}
                severity={sanction.severity}
                state={sanction.state}
                date={new Date(sanction.createdAt).toLocaleDateString("fr-FR")}
              />
            ))}

            {tab === "reports" && reports.length === 0 && (
              <div className={styles.listEmpty}>Aucun signalement</div>
            )}
            {tab === "reports" && reports.map((report) => (
              <SidebarCard
                key={report.id}
                guildID={guildID}
                title={REPORT_STATUS_LABELS[report.status]}
                userID={report.targetUserID}
                body={report.reporterSummary}
                active={selectedReport?.id === report.id}
                onClick={() => setSelectedReportId(report.id)}
                severity={report.context?.aiSummary?.severity}
                date={new Date(report.createdAt).toLocaleDateString("fr-FR")}
              />
            ))}

            {tab === "flags" && flags.length === 0 && (
              <div className={styles.listEmpty}>Aucun message signalé</div>
            )}
            {tab === "flags" && flags.map((flag) => {
              const flaggedMessage = flag.context?.find((message) => message.id === flag.messageID) ?? null;
              return (
                <SidebarCard
                  key={flag.id}
                  guildID={guildID}
                  title={FLAG_STATUS_LABELS[flag.status]}
                  userID={flag.targetUserID}
                  body={flaggedMessage?.content ?? "Message introuvable"}
                  active={selectedFlag?.id === flag.id}
                  onClick={() => setSelectedFlagId(flag.id)}
                  severity={flag.aiAnalysis?.severity}
                  date={new Date(flag.createdAt).toLocaleDateString("fr-FR")}
                />
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <main className={styles.main} role="tabpanel">

          {/* APPEALS */}
          {tab === "appeals" && !selectedAppeal && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>✅</div>
              Aucun appel en attente.
            </div>
          )}

          {tab === "appeals" && selectedAppeal && (
            <AppealDetail
              guildID={guildID}
              appeal={selectedAppeal}
              linkedSanction={linkedSanction}
              sourceMeta={appealSourceMeta}
              onDecision={handleAppealDecision}
            />
          )}

          {/* SANCTIONS */}
          {tab === "sanctions" && !selectedSanction && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>🛡️</div>
              Aucune sanction enregistrée.
            </div>
          )}

          {tab === "sanctions" && selectedSanction && sanctionDraft && (
            <section className={styles.hero} aria-label="Détail de la sanction">
              <div className={styles.heroHeader}>
                <div className={styles.heroTitleGroup}>
                  <span className={styles.heroKind}>{TYPE_LABELS[selectedSanction.type]}</span>
                  <div className={styles.heroMeta}>
                    <span className={styles.heroDate}>{formatDate(selectedSanction.createdAt)}</span>
                    <SeverityTag value={selectedSanction.severity} />
                    <span className={styles.categoryBadge}>{NATURE_LABELS[selectedSanction.nature]}</span>
                    <span className={`${styles.pill} ${selectedSanction.state === "created" ? styles.pillActive : styles.pillInactive}`}>
                      {selectedSanction.state === "created" ? "Active" : "Levée"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.heroBody}>
                <div className={styles.primaryGrid}>
                  <section className={styles.panel} aria-label="Résumé de la sanction">
                    <div className={styles.panelHeader}>
                      <h2 className={styles.panelTitle}>Résumé</h2>
                      <div className={styles.panelHint}>Lecture rapide de la mesure appliquée</div>
                    </div>

                    <div className={styles.userGrid}>
                      <UserCard guildID={guildID} userID={selectedSanction.userID} label="Utilisateur sanctionné" />
                      <UserCard guildID={guildID} userID={selectedSanction.moderatorID} label="Modérateur" />
                    </div>

                    <div className={styles.factsGrid}>
                      <div className={styles.fact}>
                        <span className={styles.label}>Type</span>
                        <span className={styles.factValue}>{TYPE_LABELS[selectedSanction.type]}</span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.label}>Durée</span>
                        <span className={styles.factValue}>{formatDuration(selectedSanction.durationMs)}</span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.label}>Nature</span>
                        <span className={styles.factValue}>{NATURE_LABELS[selectedSanction.nature]}</span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.label}>État</span>
                        <span className={styles.factValue}>{selectedSanction.state === "created" ? "Active" : "Levée"}</span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.label}>Créée le</span>
                        <span className={styles.factValue}>{formatDate(selectedSanction.createdAt)}</span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.label}>ID</span>
                        <span className={`${styles.factValue} ${styles.factMono}`}>{selectedSanction.id}</span>
                      </div>
                    </div>

                    <div className={styles.block}>
                      <div className={styles.label}>Motif</div>
                      <p className={styles.blockText}>{selectedSanction.reason}</p>
                    </div>

                    <div className={`${styles.block} ${styles.blockMuted}`}>
                      <div className={styles.label}>Source liée</div>
                      {selectedSanctionSourceMeta?.kind === "report" && (
                        <>
                          <p className={styles.blockTextMuted}>Cette sanction provient d’un signalement ticket.</p>
                          <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => handleNavigateToReport(selectedSanctionSourceMeta.data.id)}
                          >
                            Voir le signalement →
                          </button>
                        </>
                      )}
                      {selectedSanctionSourceMeta?.kind === "flag" && (
                        <>
                          <p className={styles.blockTextMuted}>Cette sanction provient d’un message signalé.</p>
                          <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => handleNavigateToFlag(selectedSanctionSourceMeta.data.id)}
                          >
                            Voir le message signalé →
                          </button>
                        </>
                      )}
                      {!selectedSanctionSourceMeta && (
                        <p className={styles.blockTextMuted}>Aucune source de signalement liée trouvée.</p>
                      )}
                    </div>
                  </section>

                  <section className={styles.panel} aria-label="Actions sur la sanction">
                    <div className={styles.panelHeader}>
                      <h2 className={styles.panelTitle}>Actions</h2>
                      <div className={styles.panelHint}>
                        {selectedSanction.state === "created"
                          ? "Ajuste ou révoque la sanction si nécessaire."
                          : "Cette sanction a déjà été levée et n'est plus modifiable."}
                      </div>
                    </div>

                    {selectedSanction.state === "created" ? (
                      <>
                        <SanctionEditor
                          draft={sanctionDraft}
                          onChange={setSanctionDraft}
                          isEditing={isEditingSanction}
                        />

                        <div className={styles.actionBar}>
                          <div className={styles.actionGroup}>
                            {!isEditingSanction ? (
                              <button
                                className={`${styles.btn} ${styles.btnGhost}`}
                                onClick={() => setIsEditingSanction(true)}
                              >
                                <IconEdit /> Modifier
                              </button>
                            ) : (
                              <>
                                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleSanctionSave()}>
                                  <IconSave /> Enregistrer
                                </button>
                                <button
                                  className={`${styles.btn} ${styles.btnGhost}`}
                                  onClick={() => { setSanctionDraft(toDraft(selectedSanction)); setIsEditingSanction(false); }}
                                >
                                  <IconUndo /> Réinitialiser
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className={`${styles.block} ${styles.blockMuted}`}>
                          <div className={styles.label}>Révocation</div>
                          <p className={styles.blockTextMuted}>
                            Utilise cette action seulement si la sanction doit être annulée côté dashboard et côté Discord.
                          </p>
                          {!confirmRevoke ? (
                            <button
                              className={`${styles.btn} ${styles.btnDanger}`}
                              onClick={() => setConfirmRevoke(true)}
                            >
                              Révoquer
                            </button>
                          ) : (
                            <div className={styles.actionGroup}>
                              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setConfirmRevoke(false)}>
                                Annuler
                              </button>
                              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => void handleSanctionRevoke()}>
                                Confirmer la révocation
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className={`${styles.block} ${styles.blockMuted}`}>
                        <div className={styles.label}>Statut</div>
                        <p className={styles.blockTextMuted}>
                          Cette sanction a été levée. Le panneau d’édition est désactivé pour conserver un historique lisible.
                        </p>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => void handleSanctionReopen()}
                        >
                          Réouvrir la sanction
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </section>
          )}

          {tab === "reports" && !selectedReport && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>📝</div>
              Aucun signalement disponible.
            </div>
          )}

          {tab === "reports" && selectedReport && (
            <ReportDetail
              guildID={guildID}
              report={selectedReport}
              linkedSanction={linkedSanctionForReport}
              onNavigateToSanction={handleNavigateToSanction}
            />
          )}

          {tab === "flags" && !selectedFlag && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>🚩</div>
              Aucun message signalé disponible.
            </div>
          )}

          {tab === "flags" && selectedFlag && (
            <FlagDetail
              guildID={guildID}
              flag={selectedFlag}
              linkedSanction={linkedSanctionForFlag}
              allSanctions={sanctions}
              onNavigateToSanction={handleNavigateToSanction}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Chargement…</div>}>
      <ModerationInner />
    </Suspense>
  );
}
