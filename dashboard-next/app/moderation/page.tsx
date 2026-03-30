"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Moderation.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "appeals" | "sanctions";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
type SanctionType = "WARN_LOW" | "WARN_MEDIUM" | "WARN_HIGH" | "MUTE" | "BAN_PENDING";
type SanctionNature = "Extremism" | "Violence" | "Hate" | "Harassment" | "Spam" | "Manipulation" | "Recidivism" | "Other";
type SanctionState = "created" | "canceled";
type AppealStatus = "pending_review" | "upheld" | "overturned";

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
  targetID?: string | null;
  needsMoreContext?: boolean;
};

type AiSummary = {
  isViolation?: boolean;
  severity?: Severity;
  reason?: string;
  nature?: SanctionNature;
  targetID?: string | null;
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
};

type FlaggedMessageItem = {
  id: string;
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  targetUserID: string;
  status: string;
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
  status: string;
  reporterSummary: string;
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

const SEVERITY_LEVELS: Severity[] = ["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

const SEVERITY_LABELS: Record<Severity, string> = {
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

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAppeals(guildID: string): Promise<AppealItem[]> {
  const r = await fetch(`/api/guilds/${guildID}/appeals?status=pending_review`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch appeals");
  return ((await r.json()) as AppealItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

async function fetchSanctions(guildID: string): Promise<SanctionItem[]> {
  const r = await fetch(`/api/guilds/${guildID}/sanctions`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch sanctions");
  return ((await r.json()) as SanctionItem[]).sort((a, b) => b.createdAt - a.createdAt);
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
  onDecision,
}: Readonly<{
  guildID: string;
  appeal: AppealItem;
  linkedSanction: SanctionItem | null;
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
  const [sourceMeta, setSourceMeta] = useState<{ kind: "flag"; data: FlaggedMessageItem } | { kind: "report"; data: ModerationReportItem } | null>(null);
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(linkedSanction ? toDraft(linkedSanction) : null);
    setIsEditing(false);
    setResolutionReason("");
    setReasonFlash(false);
  }, [linkedSanction?.id]);

  useEffect(() => {
    if (!reasonFlash) return;
    const timeout = window.setTimeout(() => setReasonFlash(false), 650);
    return () => window.clearTimeout(timeout);
  }, [reasonFlash]);

  useEffect(() => {
    setSourceMeta(null);
    if (!linkedSanction) return;
    // Try to find which source (flaggedMessage or report) is linked to this sanction
    fetch(`/api/guilds/${guildID}/flagged-messages?status=sanctioned`, { cache: "no-store" })
      .then((r) => r.json() as Promise<FlaggedMessageItem[]>)
      .then((flags) => {
        const flag = flags.find((f) => f.sanctionID === linkedSanction.id);
        if (flag) { setSourceMeta({ kind: "flag", data: flag }); return; }
        return fetch(`/api/guilds/${guildID}/moderation-reports?status=sanctioned`, { cache: "no-store" })
          .then((r) => r.json() as Promise<ModerationReportItem[]>)
          .then((reports) => {
            const report = reports.find((rep) => rep.sanctionID === linkedSanction.id);
            if (report) setSourceMeta({ kind: "report", data: report });
          });
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildID, linkedSanction?.id]);

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
          <span className={styles.heroKind}>Appel en attente</span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>{formatDate(appeal.createdAt)}</span>
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
                <SanctionEditor draft={draft} onChange={setDraft} isEditing={isEditing} />

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
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [selectedSanctionId, setSelectedSanctionId] = useState<string | null>(null);
  const [sanctionDraft, setSanctionDraft] = useState<SanctionDraft | null>(null);
  const [isEditingSanction, setIsEditingSanction] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!guildID) return;
    Promise.all([fetchAppeals(guildID), fetchSanctions(guildID)])
      .then(([a, s]) => {
        setAppeals(a);
        setSanctions(s);
        setSelectedAppealId(a[0]?.id ?? null);
        setSelectedSanctionId(s[0]?.id ?? null);
      })
      .catch(() => { setAppeals([]); setSanctions([]); });
  }, [guildID]);

  const sanctionUserIDs = useMemo(() => {
    if (!sanctions) return [];
    const ids = new Set<string>();
    for (const s of sanctions) { ids.add(s.userID); ids.add(s.moderatorID); }
    return [...ids];
  }, [sanctions]);

  usePreloadUserMetas(guildID, sanctionUserIDs);

  const selectedAppeal = useMemo(
    () => appeals?.find((i) => i.id === selectedAppealId) ?? appeals?.[0] ?? null,
    [appeals, selectedAppealId],
  );
  const selectedSanction = useMemo(
    () => sanctions?.find((i) => i.id === selectedSanctionId) ?? sanctions?.[0] ?? null,
    [sanctions, selectedSanctionId],
  );

  const linkedSanction = useMemo(
    () => sanctions?.find((i) => i.id === selectedAppeal?.sanctionID) ?? null,
    [sanctions, selectedAppeal],
  );

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

  if (!guildID) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>⚙️</div>
        Sélectionne un serveur dans la barre du haut.
      </div>
    );
  }

  if (appeals === null || sanctions === null) {
    return <div className={styles.emptyState}>Chargement…</div>;
  }

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
            {appeals.length > 0 && (
              <span className={styles.tabBadge} aria-label={`${appeals.length} en attente`}>
                {appeals.length}
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
        </div>
      </header>

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar} aria-label={tab === "appeals" ? "Liste des appels" : "Liste des sanctions"}>
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarTitle}>{tab === "appeals" ? "En attente" : "Toutes"}</span>
            <span className={styles.sidebarCount}>{tab === "appeals" ? appeals.length : sanctions.length}</span>
          </div>
          <div className={styles.list}>
            {tab === "appeals" && appeals.length === 0 && (
              <div className={styles.listEmpty}>Aucun appel en attente</div>
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
