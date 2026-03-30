"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./Moderation.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "appeals" | "sanctions";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";

type UserMeta = {
  userID: string;
  username: string;
  displayName: string;
  avatarURL: string;
};

type FlagAnalysis = {
  isViolation?: boolean;
  severity?: Severity;
  warnSuffices?: boolean;
  category?: string;
  reasoning?: string;
  isBlackHumor?: boolean;
  isInsult?: boolean;
  insultTargetID?: string | null;
  requiresCertification?: boolean;
  needsMoreContext?: boolean;
};

type QQOQCCP = {
  qui?: string;
  quoi?: string;
  ou?: string;
  quand?: string;
  comment?: string;
  combien?: string;
  pourquoi?: string;
};

type SanctionItem = {
  id: string;
  guildID: string;
  userID: string;
  moderatorID: string;
  type: "MUTE" | "BAN_PENDING";
  reason: string;
  warnID: string | null;
  isActive: boolean;
  durationMs: number | null;
  createdAt: number;
  expiresAt: number | null;
};

type AppealItem = {
  id: string;
  kind: "flag" | "report";
  createdAt: number;
  targetUserID: string;
  reporterID: string;
  appealText: string | null;
  appealStatus: string | null;
  sanctionID: string | null;
  status: string;
  // flag fields
  channelID?: string;
  messageID?: string;
  aiAnalysis?: FlagAnalysis | null;
  // report fields
  reporterSummary?: string;
  aiQQOQCCP?: string | null;
  aiQuestions?: string[];
};

type SanctionDraft = {
  type: "MUTE" | "BAN_PENDING";
  reason: string;
  durationMs: number | null;
  isActive: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

function formatDuration(value: number | null): string {
  if (value === null) return "Permanente";
  const minutes = Math.ceil(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.ceil(hours / 24)} j`;
}

function toDraft(s: SanctionItem): SanctionDraft {
  return { type: s.type, reason: s.reason, durationMs: s.durationMs, isActive: s.isActive };
}

function parseSafeJSON<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "object") return value as T;
  try { return JSON.parse(value as string) as T; } catch { return null; }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAppeals(guildID: string): Promise<AppealItem[]> {
  const [flagsRes, reportsRes] = await Promise.all([
    fetch(`/api/guilds/${guildID}/flagged-messages?appealStatus=pending_review`, { cache: "no-store" }),
    fetch(`/api/guilds/${guildID}/moderation-reports?appealStatus=pending_review`, { cache: "no-store" }),
  ]);
  const [flags, reports] = await Promise.all([
    flagsRes.json() as Promise<AppealItem[]>,
    reportsRes.json() as Promise<AppealItem[]>,
  ]);
  return [
    ...flags.map((item) => ({ ...item, kind: "flag" as const })),
    ...reports.map((item) => ({ ...item, kind: "report" as const })),
  ].sort((a, b) => b.createdAt - a.createdAt);
}

async function fetchSanctions(guildID: string): Promise<SanctionItem[]> {
  const r = await fetch(`/api/guilds/${guildID}/sanctions`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch sanctions");
  return ((await r.json()) as SanctionItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

async function patchAppeal(guildID: string, item: AppealItem, appealStatus: "rejected" | "overturned") {
  const path = item.kind === "flag"
    ? `/api/guilds/${guildID}/flagged-messages/${item.id}`
    : `/api/guilds/${guildID}/moderation-reports/${item.id}`;
  const r = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appealStatus }) });
  if (!r.ok) throw new Error("Failed to update appeal");
}

async function patchSanction(guildID: string, sanctionID: string, patch: Partial<SanctionDraft>) {
  const r = await fetch(`/api/guilds/${guildID}/sanctions/${sanctionID}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Failed to update sanction");
  return r.json() as Promise<SanctionItem>;
}

// ─── User meta ────────────────────────────────────────────────────────────────

const userMetaCache = new Map<string, UserMeta>();

function useUserMeta(guildID: string, userID: string | null | undefined): UserMeta | null {
  const [meta, setMeta] = useState<UserMeta | null>(null);
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

function EditIcon() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h9a7 7 0 1 1 0 14h-1" />
    </svg>
  );
}

function RejectIcon() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function AcceptIcon() {
  return (
    <svg className={styles.iconGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ─── UserCard: photo + pseudo, ID au click ────────────────────────────────────

function UserCard({ guildID, userID, label }: Readonly<{ guildID: string; userID: string; label: string }>) {
  const meta = useUserMeta(guildID, userID);
  const name = meta?.displayName || meta?.username || userID;
  const sub = meta?.username && meta.username !== meta.displayName ? `@${meta.username}` : null;
  const [showID, setShowID] = useState(false);

  return (
    <div className={styles.userCard}>
      <div className={styles.userCardLabel}>{label}</div>
      <div className={styles.userCardBody}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={40} />
        <div className={styles.userCardInfo}>
          <span className={styles.userCardName}>{name}</span>
          {sub && <span className={styles.userCardSub}>{sub}</span>}
          <button className={styles.userCardIdBtn} onClick={() => setShowID((v) => !v)}>
            {showID ? <span className={styles.userCardIdValue}>{userID}</span> : "ID"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SeverityTag: badge cliquable avec dropdown ───────────────────────────────

const SEVERITY_LEVELS: Severity[] = ["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"];

const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Faible",
  MEDIUM: "Modérée",
  HIGH: "Élevée",
  UNFORGIVABLE: "Impardonnable",
};

function SeverityTag({ value, onChange }: Readonly<{ value: Severity; onChange?: (v: Severity) => void }>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className={styles.severityWrap} ref={ref}>
      <button
        className={[styles.severityTag, styles[`sev${value}`]].join(" ")}
        onClick={() => onChange && setOpen((v) => !v)}
        title={onChange ? "Changer la sévérité" : undefined}
      >
        {SEVERITY_LABELS[value]}
        {onChange && <span className={styles.severityArrow}>▾</span>}
      </button>
      {open && onChange && (
        <div className={styles.severityDropdown}>
          {SEVERITY_LEVELS.map((level) => (
            <button
              key={level}
              className={[styles.severityOption, level === value ? styles.severityOptionActive : "", styles[`sev${level}`]].join(" ")}
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

// ─── QQOQCCP table ───────────────────────────────────────────────────────────

const QQOQCCP_LABELS: [keyof QQOQCCP, string][] = [
  ["qui", "Qui"],
  ["quoi", "Quoi"],
  ["ou", "Où"],
  ["quand", "Quand"],
  ["comment", "Comment"],
  ["combien", "Combien"],
  ["pourquoi", "Pourquoi"],
];

function QQOQCCPTable({ data }: Readonly<{ data: QQOQCCP }>) {
  return (
    <dl className={styles.qqoqccp}>
      {QQOQCCP_LABELS.map(([key, label]) => {
        const value = data[key];
        if (!value) return null;
        return (
          <div key={key} className={styles.qqoqccpRow}>
            <dt className={styles.qqoqccpLabel}>{label}</dt>
            <dd className={styles.qqoqccpValue}>{value}</dd>
          </div>
        );
      })}
    </dl>
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
  isActive?: boolean;
  date: string;
}) {
  const meta = useUserMeta(props.guildID, props.userID);
  const name = meta?.displayName || meta?.username || props.userID;

  return (
    <button className={`${styles.card} ${props.active ? styles.cardActive : ""}`} onClick={props.onClick}>
      <div className={styles.cardRow}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={28} />
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{name}</div>
          <div className={styles.cardDate}>{props.date}</div>
        </div>
        {props.severity && (
          <span className={`${styles.cardSevPill} ${styles[`sev${props.severity}`]}`}>
            {SEVERITY_LABELS[props.severity]}
          </span>
        )}
        {props.isActive !== undefined && (
          <span className={`${styles.cardSevPill} ${props.isActive ? styles.pillActive : styles.pillInactive}`}>
            {props.isActive ? "Active" : "Levée"}
          </span>
        )}
      </div>
      <div className={styles.cardTitle}>{props.title}</div>
      {props.body && <div className={styles.cardExcerpt}>{props.body}</div>}
    </button>
  );
}

// ─── Collapsible section ─────────────────────────────────────────────────────

function Collapsible({ title, children, defaultOpen = false }: Readonly<{ title: string; children: React.ReactNode; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.section}>
      <button className={styles.collapsibleBtn} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className={styles.collapsibleIcon} aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
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
  const [appealDraft, setAppealDraft] = useState<SanctionDraft | null>(null);
  const [isAppealEditing, setIsAppealEditing] = useState(false);

  // Local override of severity before submitting decision
  const [localSeverity, setLocalSeverity] = useState<Severity | null>(null);

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

  const appealUserIDs = useMemo(() => {
    if (!appeals) return [];
    const ids = new Set<string>();
    for (const a of appeals) { ids.add(a.targetUserID); ids.add(a.reporterID); }
    return [...ids];
  }, [appeals]);

  const sanctionUserIDs = useMemo(() => {
    if (!sanctions) return [];
    const ids = new Set<string>();
    for (const s of sanctions) { ids.add(s.userID); ids.add(s.moderatorID); }
    return [...ids];
  }, [sanctions]);

  usePreloadUserMetas(guildID, appealUserIDs);
  usePreloadUserMetas(guildID, sanctionUserIDs);

  const selectedAppeal = useMemo(
    () => appeals?.find((i) => i.id === selectedAppealId) ?? appeals?.[0] ?? null,
    [appeals, selectedAppealId],
  );
  const selectedSanction = useMemo(
    () => sanctions?.find((i) => i.id === selectedSanctionId) ?? sanctions?.[0] ?? null,
    [sanctions, selectedSanctionId],
  );

  useEffect(() => {
    if (selectedSanction) setSanctionDraft(toDraft(selectedSanction));
  }, [selectedSanction]);

  // Reset local severity when appeal changes
  useEffect(() => { setLocalSeverity(null); }, [selectedAppealId]);

  const linkedSanction = useMemo(
    () => sanctions?.find((i) => i.id === selectedAppeal?.sanctionID) ?? null,
    [sanctions, selectedAppeal],
  );

  useEffect(() => {
    setAppealDraft(linkedSanction ? toDraft(linkedSanction) : null);
    setIsAppealEditing(false);
  }, [linkedSanction?.id]);

  const flagAnalysis = useMemo(() => {
    if (selectedAppeal?.kind !== "flag") return null;
    return parseSafeJSON<FlagAnalysis>(selectedAppeal.aiAnalysis) ?? null;
  }, [selectedAppeal]);

  const qqoqccp = useMemo(() => {
    if (selectedAppeal?.kind !== "report") return null;
    return parseSafeJSON<QQOQCCP>(selectedAppeal.aiQQOQCCP) ?? null;
  }, [selectedAppeal]);

  const effectiveSeverity: Severity | null = localSeverity ?? flagAnalysis?.severity ?? null;
  const analysisMatchesReason = normalizeText(flagAnalysis?.reasoning) !== "" && normalizeText(flagAnalysis?.reasoning) === normalizeText(appealDraft?.reason);

  if (!guildID) return <div className={styles.emptyState}>Sélectionne un serveur dans la barre du haut.</div>;
  if (appeals === null || sanctions === null) return <div className={styles.emptyState}>Chargement…</div>;

  async function handleAppealDecision(decision: "rejected" | "overturned") {
    if (!selectedAppeal) return;
    await patchAppeal(guildID, selectedAppeal, decision);
    if (decision === "overturned" && selectedAppeal.sanctionID) {
      const revoked = await patchSanction(guildID, selectedAppeal.sanctionID, { isActive: false });
      setSanctions((cur) => cur?.map((i) => (i.id === revoked.id ? revoked : i)) ?? []);
    }
    const next = (appeals ?? []).filter((i) => i.id !== selectedAppeal.id);
    setAppeals(next);
    setSelectedAppealId(next[0]?.id ?? null);
  }

  async function handleAppealSanctionSave() {
    if (!linkedSanction || !appealDraft) return;
    const updated = await patchSanction(guildID, linkedSanction.id, appealDraft);
    setSanctions((cur) => cur?.map((i) => (i.id === updated.id ? updated : i)) ?? []);
    setAppealDraft(toDraft(updated));
    setIsAppealEditing(false);
  }

  async function handleSanctionSave() {
    if (!selectedSanction || !sanctionDraft) return;
    const updated = await patchSanction(guildID, selectedSanction.id, sanctionDraft);
    setSanctions((cur) => cur?.map((i) => (i.id === updated.id ? updated : i)) ?? []);
    setSanctionDraft(toDraft(updated));
  }

  async function handleSanctionRevoke() {
    if (!selectedSanction) return;
    const updated = await patchSanction(guildID, selectedSanction.id, { isActive: false });
    setSanctions((cur) => cur?.map((i) => (i.id === updated.id ? updated : i)) ?? []);
    setSanctionDraft(toDraft(updated));
  }

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>Modération</div>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "appeals" ? styles.tabActive : ""}`} onClick={() => setTab("appeals")}>
            Appels
            {appeals.length > 0 && <span className={styles.tabBadge}>{appeals.length}</span>}
          </button>
          <button className={`${styles.tab} ${tab === "sanctions" ? styles.tabActive : ""}`} onClick={() => setTab("sanctions")}>
            Sanctions
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Sidebar ──────────────────────────────────── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarTitle}>{tab === "appeals" ? "En attente" : "Toutes"}</span>
            <span className={styles.sidebarCount}>{tab === "appeals" ? appeals.length : sanctions.length}</span>
          </div>
          <div className={styles.list}>
            {tab === "appeals" && appeals.length === 0 && <div className={styles.listEmpty}>Aucun appel en attente</div>}
            {tab === "appeals" && appeals.map((appeal) => {
              const analysis = parseSafeJSON<FlagAnalysis>(appeal.aiAnalysis);
              return (
                <SidebarCard
                  key={`${appeal.kind}:${appeal.id}`}
                  guildID={guildID}
                  title={appeal.kind === "flag" ? "Signalement de message" : "Dossier de report"}
                  userID={appeal.targetUserID}
                  body={appeal.appealText}
                  active={selectedAppeal?.id === appeal.id}
                  onClick={() => setSelectedAppealId(appeal.id)}
                  severity={analysis?.severity}
                  date={new Date(appeal.createdAt).toLocaleDateString("fr-FR")}
                />
              );
            })}

            {tab === "sanctions" && sanctions.length === 0 && <div className={styles.listEmpty}>Aucune sanction</div>}
            {tab === "sanctions" && sanctions.map((sanction) => (
              <SidebarCard
                key={sanction.id}
                guildID={guildID}
                title={sanction.type === "BAN_PENDING" ? "Ban en attente" : "Mute · " + formatDuration(sanction.durationMs)}
                userID={sanction.userID}
                body={sanction.reason}
                active={selectedSanction?.id === sanction.id}
                onClick={() => setSelectedSanctionId(sanction.id)}
                isActive={sanction.isActive}
                date={new Date(sanction.createdAt).toLocaleDateString("fr-FR")}
              />
            ))}
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────── */}
        <main className={styles.main}>

          {/* ════ APPEALS ════ */}
          {tab === "appeals" && !selectedAppeal && (
            <div className={styles.emptyState}>Aucun appel en attente.</div>
          )}

          {tab === "appeals" && selectedAppeal && (
            <>
              <section className={styles.hero}>
                <div className={styles.heroTopRow}>
                  <div className={styles.heroIdentity}>
                    <span className={styles.heroKind}>
                      {selectedAppeal.kind === "flag" ? "Signalement de message" : "Dossier de report"}
                    </span>
                    <div className={styles.heroDate}>{formatDate(selectedAppeal.createdAt)}</div>
                  </div>
                  <div className={styles.heroTopRight}>
                    {effectiveSeverity && (
                      <SeverityTag
                        value={effectiveSeverity}
                        onChange={flagAnalysis ? setLocalSeverity : undefined}
                      />
                    )}
                    {flagAnalysis?.category && <span className={styles.categoryBadge}>{flagAnalysis.category}</span>}
                  </div>
                </div>

                <div className={styles.primaryGrid}>
                  <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <h2 className={styles.panelTitle}>Dossier</h2>
                      <div className={styles.panelHint}>Contexte du signalement et personnes concernées</div>
                    </div>

                    <div className={styles.userGrid}>
                      <UserCard guildID={guildID} userID={selectedAppeal.targetUserID} label="Utilisateur visé" />
                      <UserCard guildID={guildID} userID={selectedAppeal.reporterID} label="Auteur du signalement" />
                    </div>

                    {selectedAppeal.appealText && (
                      <div className={styles.contentBlock}>
                        <div className={styles.blockLabel}>Déclaration</div>
                        <div className={styles.blockText}>{selectedAppeal.appealText}</div>
                      </div>
                    )}

                    {flagAnalysis?.reasoning && !analysisMatchesReason && (
                      <div className={styles.contentBlockMuted}>
                        <div className={styles.blockLabel}>Analyse IA</div>
                        <div className={styles.blockTextSecondary}>{flagAnalysis.reasoning}</div>
                      </div>
                    )}

                    {selectedAppeal.kind === "flag" && selectedAppeal.channelID && selectedAppeal.messageID && (
                      <a
                        className={styles.messageLink}
                        href={`https://discord.com/channels/${guildID}/${selectedAppeal.channelID}/${selectedAppeal.messageID}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ouvrir le message dans Discord
                      </a>
                    )}
                  </section>

                  <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <h2 className={styles.panelTitle}>Sanction proposée</h2>
                      <div className={styles.panelHint}>Vérifie ou ajuste la sanction avant de trancher l’appel</div>
                    </div>

                    {linkedSanction && appealDraft ? (
                      <>
                        <div className={styles.sanctionSummary}>
                          <div>
                            <div className={styles.blockLabel}>État de la sanction</div>
                            <div className={styles.sanctionSummaryTitle}>Sanction actuellement appliquée</div>
                          </div>
                          <span className={`${styles.statusPill} ${linkedSanction.isActive ? styles.pillActive : styles.pillInactive}`}>
                            {linkedSanction.isActive ? "Active" : "Levée"}
                          </span>
                        </div>

                        <div className={styles.editorGrid}>
                          <div className={styles.editorField}>
                            <label className={styles.fieldLabel}>Type</label>
                            {isAppealEditing ? (
                              <select
                                className={styles.select}
                                value={appealDraft.type}
                                onChange={(e) => setAppealDraft({ ...appealDraft, type: e.target.value as SanctionDraft["type"] })}
                              >
                                <option value="MUTE">Mute</option>
                                <option value="BAN_PENDING">Ban en attente</option>
                              </select>
                            ) : (
                              <div className={styles.readValue}>{appealDraft.type === "BAN_PENDING" ? "Ban en attente" : "Mute"}</div>
                            )}
                          </div>

                          <div className={styles.editorField}>
                            <label className={styles.fieldLabel}>Durée</label>
                            {isAppealEditing ? (
                              <input
                                className={styles.input}
                                type="number"
                                min={0}
                                value={appealDraft.durationMs === null ? "" : Math.floor(appealDraft.durationMs / 60_000)}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  setAppealDraft({ ...appealDraft, durationMs: v === "" ? null : Number(v) * 60_000 });
                                }}
                              />
                            ) : (
                              <div className={styles.readValue}>{formatDuration(appealDraft.durationMs)}</div>
                            )}
                          </div>
                        </div>

                        <div className={styles.editorField}>
                          <label className={styles.fieldLabel}>Motif de la sanction</label>
                          {isAppealEditing ? (
                            <textarea
                              className={styles.textarea}
                              value={appealDraft.reason}
                              onChange={(e) => setAppealDraft({ ...appealDraft, reason: e.target.value })}
                            />
                          ) : (
                            <div className={styles.reasonCard}>{appealDraft.reason}</div>
                          )}
                        </div>

                        <div className={styles.actionBar}>
                          <div className={styles.actionBarGroup}>
                            {!isAppealEditing && (
                              <button
                                className={`${styles.btn} ${styles.btnPrimary} ${styles.iconBtn}`}
                                onClick={() => setIsAppealEditing(true)}
                                title="Modifier la sanction"
                                aria-label="Modifier la sanction"
                              >
                                <EditIcon />
                              </button>
                            )}
                            {isAppealEditing && (
                              <>
                                <button
                                  className={`${styles.btn} ${styles.btnPrimary} ${styles.iconBtn}`}
                                  onClick={() => void handleAppealSanctionSave()}
                                  title="Enregistrer la sanction"
                                  aria-label="Enregistrer la sanction"
                                >
                                  <SaveIcon />
                                </button>
                                <button
                                  className={`${styles.btn} ${styles.btnGhost} ${styles.iconBtn}`}
                                  onClick={() => {
                                    setAppealDraft(toDraft(linkedSanction));
                                    setIsAppealEditing(false);
                                  }}
                                  title="Annuler l'édition"
                                  aria-label="Annuler l'édition"
                                >
                                  <UndoIcon />
                                </button>
                              </>
                            )}
                          </div>

                          <div className={styles.actionBarGroup}>
                            <button
                              className={`${styles.btn} ${styles.btnGhost} ${styles.iconBtn}`}
                              onClick={() => void handleAppealDecision("rejected")}
                              title="Rejeter l'appel"
                              aria-label="Rejeter l'appel"
                            >
                              <RejectIcon />
                            </button>
                            <button
                              className={`${styles.btn} ${styles.btnDanger} ${styles.iconBtn}`}
                              onClick={() => void handleAppealDecision("overturned")}
                              title="Accepter l'appel"
                              aria-label="Accepter l'appel"
                            >
                              <AcceptIcon />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={styles.emptyPanel}>Aucune sanction liée à cet appel.</div>
                    )}
                  </section>
                </div>
              </section>

              {/* Fiche QQOQCCP pour les reports */}
              {qqoqccp && (
                <Collapsible title="Fiche de synthèse" defaultOpen>
                  <QQOQCCPTable data={qqoqccp} />
                </Collapsible>
              )}

              {/* Questions de suivi */}
              {selectedAppeal.kind === "report" && selectedAppeal.aiQuestions && selectedAppeal.aiQuestions.length > 0 && (
                <Collapsible title="Questions de suivi posées">
                  <ul className={styles.questionList}>
                    {selectedAppeal.aiQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </Collapsible>
              )}

              {/* Dossier reporter */}
              {selectedAppeal.kind === "report" && selectedAppeal.reporterSummary && (
                <Collapsible title="Récit du reporter">
                  <p className={styles.prose}>{selectedAppeal.reporterSummary}</p>
                </Collapsible>
              )}
            </>
          )}

          {/* ════ SANCTIONS ════ */}
          {tab === "sanctions" && !selectedSanction && (
            <div className={styles.emptyState}>Aucune sanction enregistrée.</div>
          )}

          {tab === "sanctions" && selectedSanction && sanctionDraft && (
            <>
              <section className={styles.hero}>
                <div className={styles.heroTopRow}>
                  <span className={styles.heroKind}>
                    {selectedSanction.type === "BAN_PENDING" ? "Ban en attente" : "Mute"}
                  </span>
                  <span className={`${styles.cardSevPill} ${selectedSanction.isActive ? styles.pillActive : styles.pillInactive}`}>
                    {selectedSanction.isActive ? "Active" : "Levée"}
                  </span>
                </div>

                <div className={styles.heroUsers}>
                  <UserCard guildID={guildID} userID={selectedSanction.userID} label="Utilisateur" />
                  <UserCard guildID={guildID} userID={selectedSanction.moderatorID} label="Modérateur" />
                </div>

                <div className={styles.appealBox}>
                  <div className={styles.appealBoxLabel}>Motif</div>
                  <div className={styles.appealBoxText}>{selectedSanction.reason}</div>
                </div>

                {selectedSanction.isActive && (
                  <div className={styles.heroActions}>
                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => void handleSanctionRevoke()}>
                      Révoquer la sanction
                    </button>
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>Détails</div>
                <div className={styles.sectionBody}>
                  <div className={styles.sanctionRow}>
                    <div className={styles.sanctionFact}>
                      <span className={styles.factLabel}>Durée</span>
                      <span className={styles.factValue}>{formatDuration(selectedSanction.durationMs)}</span>
                    </div>
                    <div className={styles.sanctionFact}>
                      <span className={styles.factLabel}>Créé le</span>
                      <span className={styles.factValue}>{formatDate(selectedSanction.createdAt)}</span>
                    </div>
                    <div className={styles.sanctionFact}>
                      <span className={styles.factLabel}>Expire le</span>
                      <span className={styles.factValue}>{formatDate(selectedSanction.expiresAt)}</span>
                    </div>
                    {selectedSanction.warnID && (
                      <div className={styles.sanctionFact}>
                        <span className={styles.factLabel}>Warn lié</span>
                        <span className={styles.factValue}>{selectedSanction.warnID}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <Collapsible title="Modifier la sanction">
                <div className={styles.editForm}>
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Type</label>
                      <select className={styles.select} value={sanctionDraft.type}
                        onChange={(e) => setSanctionDraft({ ...sanctionDraft, type: e.target.value as SanctionDraft["type"] })}>
                        <option value="MUTE">Mute</option>
                        <option value="BAN_PENDING">Ban en attente</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Durée (min)</label>
                      <input className={styles.input} type="number" min={0}
                        value={sanctionDraft.durationMs === null ? "" : Math.floor(sanctionDraft.durationMs / 60_000)}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setSanctionDraft({ ...sanctionDraft, durationMs: v === "" ? null : Number(v) * 60_000 });
                        }} />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Motif</label>
                    <textarea className={styles.textarea} value={sanctionDraft.reason}
                      onChange={(e) => setSanctionDraft({ ...sanctionDraft, reason: e.target.value })} />
                  </div>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleSanctionSave()}>
                    Enregistrer
                  </button>
                </div>
              </Collapsible>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<div className={styles.emptyState}>Chargement…</div>}>
      <ModerationInner />
    </Suspense>
  );
}
