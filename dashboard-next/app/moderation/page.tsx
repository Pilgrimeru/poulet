"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./Moderation.module.css";

type Tab = "appeals" | "sanctions";

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
  channelID?: string;
  messageID?: string;
  aiAnalysis?: unknown;
  reporterSummary?: string;
  aiQQOQCCP?: string | null;
};

type SanctionDraft = {
  type: "MUTE" | "BAN_PENDING";
  reason: string;
  durationMs: number | null;
  isActive: boolean;
};

function formatDate(value: number | null): string {
  if (!value) return "Aucune";
  return new Date(value).toLocaleString("fr-FR");
}

function formatDuration(value: number | null): string {
  if (value === null) return "Aucune";
  const minutes = Math.ceil(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.ceil(hours / 24)} j`;
}

function toDraft(sanction: SanctionItem): SanctionDraft {
  return {
    type: sanction.type,
    reason: sanction.reason,
    durationMs: sanction.durationMs,
    isActive: sanction.isActive,
  };
}

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
  const response = await fetch(`/api/guilds/${guildID}/sanctions`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to fetch sanctions");
  const items = await response.json() as SanctionItem[];
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function patchAppeal(guildID: string, item: AppealItem, appealStatus: "rejected" | "overturned") {
  const path = item.kind === "flag"
    ? `/api/guilds/${guildID}/flagged-messages/${item.id}`
    : `/api/guilds/${guildID}/moderation-reports/${item.id}`;

  const response = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appealStatus }),
  });
  if (!response.ok) throw new Error("Failed to update appeal");
}

async function patchSanction(guildID: string, sanctionID: string, patch: Partial<SanctionDraft>) {
  const response = await fetch(`/api/guilds/${guildID}/sanctions/${sanctionID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("Failed to update sanction");
  return response.json() as Promise<SanctionItem>;
}

function SidebarCard(props: {
  title: string;
  subtitle: string;
  body?: string | null;
  active?: boolean;
  onClick: () => void;
  meta: string[];
  variant?: "appeal" | "sanction";
}) {
  return (
    <button className={`${styles.card} ${props.active ? styles.cardActive : ""}`} onClick={props.onClick}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>{props.title}</div>
      </div>
      <div className={styles.cardMeta}>
        {props.meta.map((item) => (
          <span key={item} className={`${styles.pill} ${props.variant === "appeal" ? styles.pillWarn : ""}`}>
            {item}
          </span>
        ))}
      </div>
      <div className={styles.cardText}>{props.subtitle}</div>
      {props.body ? <div className={styles.cardText}>{props.body}</div> : null}
    </button>
  );
}

function ModerationInner() {
  const searchParams = useSearchParams();
  const guildID = searchParams.get("guild") ?? "";

  const [tab, setTab] = useState<Tab>("appeals");
  const [appeals, setAppeals] = useState<AppealItem[] | null>(null);
  const [sanctions, setSanctions] = useState<SanctionItem[] | null>(null);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [selectedSanctionId, setSelectedSanctionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SanctionDraft | null>(null);

  useEffect(() => {
    if (!guildID) return;
    Promise.all([fetchAppeals(guildID), fetchSanctions(guildID)])
      .then(([appealsData, sanctionsData]) => {
        setAppeals(appealsData);
        setSanctions(sanctionsData);
        setSelectedAppealId(appealsData[0]?.id ?? null);
        setSelectedSanctionId(sanctionsData[0]?.id ?? null);
      })
      .catch(() => {
        setAppeals([]);
        setSanctions([]);
      });
  }, [guildID]);

  const selectedAppeal = useMemo(
    () => appeals?.find((item) => item.id === selectedAppealId) ?? appeals?.[0] ?? null,
    [appeals, selectedAppealId],
  );
  const selectedSanction = useMemo(
    () => sanctions?.find((item) => item.id === selectedSanctionId) ?? sanctions?.[0] ?? null,
    [sanctions, selectedSanctionId],
  );

  useEffect(() => {
    if (selectedSanction) setDraft(toDraft(selectedSanction));
  }, [selectedSanction]);

  const linkedSanction = useMemo(
    () => sanctions?.find((item) => item.id === selectedAppeal?.sanctionID) ?? null,
    [sanctions, selectedAppeal],
  );

  if (!guildID) {
    return <div className={styles.emptyState}>Selectionne un serveur dans la barre du haut.</div>;
  }

  if (appeals === null || sanctions === null) {
    return <div className={styles.emptyState}>Chargement de la moderation…</div>;
  }

  async function handleAppealDecision(decision: "rejected" | "overturned") {
    if (!selectedAppeal) return;
    await patchAppeal(guildID, selectedAppeal, decision);
    if (decision === "overturned" && selectedAppeal.sanctionID) {
      const revoked = await patchSanction(guildID, selectedAppeal.sanctionID, { isActive: false });
      setSanctions((current) => current?.map((item) => (item.id === revoked.id ? revoked : item)) ?? []);
    }
    const nextAppeals = (appeals ?? []).filter((item) => item.id !== selectedAppeal.id);
    setAppeals(nextAppeals);
    setSelectedAppealId(nextAppeals[0]?.id ?? null);
  }

  async function handleSanctionSave() {
    if (!selectedSanction || !draft) return;
    const updated = await patchSanction(guildID, selectedSanction.id, draft);
    setSanctions((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? []);
    setSelectedSanctionId(updated.id);
    setDraft(toDraft(updated));
  }

  async function handleSanctionRevoke() {
    if (!selectedSanction) return;
    const updated = await patchSanction(guildID, selectedSanction.id, { isActive: false });
    setSanctions((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? []);
    setSelectedSanctionId(updated.id);
    setDraft(toDraft(updated));
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Moderation</div>
          <div className={styles.subtitle}>
            Les appels affichent d’abord la decision a prendre, puis seulement le contexte utile.
            L’onglet sanctions permet de revoir ou modifier une peine meme sans appel.
          </div>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "appeals" ? styles.tabActive : ""}`} onClick={() => setTab("appeals")}>
            Appels
          </button>
          <button className={`${styles.tab} ${tab === "sanctions" ? styles.tabActive : ""}`} onClick={() => setTab("sanctions")}>
            Sanctions
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>{tab === "appeals" ? "Appels en attente" : "Toutes les sanctions"}</div>
            <div className={styles.count}>{tab === "appeals" ? appeals.length : sanctions.length}</div>
          </div>
          <div className={styles.list}>
            {tab === "appeals" && appeals.map((appeal) => (
              <SidebarCard
                key={`${appeal.kind}:${appeal.id}`}
                title={appeal.kind === "flag" ? "Appel sur signalement" : "Appel sur report"}
                subtitle={`Cible ${appeal.targetUserID}`}
                body={appeal.appealText}
                active={selectedAppeal?.id === appeal.id}
                onClick={() => setSelectedAppealId(appeal.id)}
                meta={[
                  new Date(appeal.createdAt).toLocaleDateString("fr-FR"),
                  appeal.kind === "flag" ? "Message" : "Ticket",
                ]}
                variant="appeal"
              />
            ))}

            {tab === "sanctions" && sanctions.map((sanction) => (
              <SidebarCard
                key={sanction.id}
                title={sanction.type === "BAN_PENDING" ? "Ban pending" : "Mute"}
                subtitle={`Utilisateur ${sanction.userID}`}
                body={sanction.reason}
                active={selectedSanction?.id === sanction.id}
                onClick={() => setSelectedSanctionId(sanction.id)}
                meta={[
                  sanction.isActive ? "Active" : "Inactive",
                  formatDuration(sanction.durationMs),
                ]}
              />
            ))}
          </div>
        </aside>

        <main className={styles.main}>
          {tab === "appeals" && !selectedAppeal && (
            <div className={styles.emptyState}>Aucun appel en attente.</div>
          )}

          {tab === "appeals" && selectedAppeal && (
            <>
              <section className={styles.hero}>
                <div className={styles.heroTitle}>Decision a prendre</div>
                <div className={styles.heroText}>{selectedAppeal.appealText || "Aucun texte d'appel fourni."}</div>
                <div className={styles.heroSub}>
                  Reporter {selectedAppeal.reporterID} · Cible {selectedAppeal.targetUserID} · Recu le {formatDate(selectedAppeal.createdAt)}
                </div>
                <div className={styles.actions}>
                  <button className={`${styles.button} ${styles.buttonGhost}`} onClick={() => void handleAppealDecision("rejected")}>
                    Maintenir
                  </button>
                  <button className={`${styles.button} ${styles.buttonDanger}`} onClick={() => void handleAppealDecision("overturned")}>
                    Annuler la sanction
                  </button>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>Informations essentielles</div>
                <div className={styles.sectionBody}>
                  <div className={styles.facts}>
                    <div className={styles.fact}>
                      <div className={styles.factLabel}>Type</div>
                      <div className={styles.factValue}>{selectedAppeal.kind === "flag" ? "Signalement message" : "Dossier report"}</div>
                    </div>
                    <div className={styles.fact}>
                      <div className={styles.factLabel}>Etat</div>
                      <div className={styles.factValue}>{selectedAppeal.status}</div>
                    </div>
                    {linkedSanction && (
                      <>
                        <div className={styles.fact}>
                          <div className={styles.factLabel}>Sanction</div>
                          <div className={styles.factValue}>{linkedSanction.type} · {formatDuration(linkedSanction.durationMs)}</div>
                        </div>
                        <div className={styles.fact}>
                          <div className={styles.factLabel}>Active</div>
                          <div className={styles.factValue}>{linkedSanction.isActive ? "Oui" : "Non"}</div>
                        </div>
                      </>
                    )}
                  </div>
                  {selectedAppeal.kind === "flag" && selectedAppeal.channelID && selectedAppeal.messageID && (
                    <a
                      className={styles.link}
                      href={`https://discord.com/channels/${guildID}/${selectedAppeal.channelID}/${selectedAppeal.messageID}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ouvrir le message source dans Discord
                    </a>
                  )}
                </div>
              </section>

              {linkedSanction && draft && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>Sanction actuelle</div>
                  <div className={styles.sectionBody}>
                    <div className={styles.form}>
                      <div className={styles.row}>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Type</label>
                          <select
                            className={styles.select}
                            value={draft.type}
                            onChange={(e) => setDraft({ ...draft, type: e.target.value as SanctionDraft["type"] })}
                          >
                            <option value="MUTE">MUTE</option>
                            <option value="BAN_PENDING">BAN_PENDING</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Duree (minutes)</label>
                          <input
                            className={styles.input}
                            type="number"
                            min={0}
                            value={draft.durationMs === null ? "" : Math.floor(draft.durationMs / 60_000)}
                            onChange={(e) => {
                              const value = e.target.value.trim();
                              setDraft({ ...draft, durationMs: value === "" ? null : Number(value) * 60_000 });
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Motif</label>
                        <textarea
                          className={styles.textarea}
                          value={draft.reason}
                          onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                        />
                      </div>
                      <div className={styles.actions}>
                        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void handleSanctionSave()}>
                          Modifier la sanction
                        </button>
                        <button className={`${styles.button} ${styles.buttonDanger}`} onClick={() => void handleSanctionRevoke()}>
                          Revoquer
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {selectedAppeal.kind === "report" && selectedAppeal.aiQQOQCCP && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>Synthese QQOQCCP</div>
                  <div className={styles.sectionBody}>
                    <div className={styles.textBlock}>{selectedAppeal.aiQQOQCCP}</div>
                  </div>
                </section>
              )}

              {selectedAppeal.kind === "report" && selectedAppeal.reporterSummary && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>Dossier complet</div>
                  <div className={styles.sectionBody}>
                    <div className={styles.textBlock}>{selectedAppeal.reporterSummary}</div>
                  </div>
                </section>
              )}

              {selectedAppeal.kind === "flag" && selectedAppeal.aiAnalysis && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>Analyse IA</div>
                  <div className={styles.sectionBody}>
                    <pre className={styles.codeBlock}>{JSON.stringify(selectedAppeal.aiAnalysis, null, 2)}</pre>
                  </div>
                </section>
              )}
            </>
          )}

          {tab === "sanctions" && !selectedSanction && (
            <div className={styles.emptyState}>Aucune sanction enregistree.</div>
          )}

          {tab === "sanctions" && selectedSanction && draft && (
            <>
              <section className={styles.hero}>
                <div className={styles.heroTitle}>{selectedSanction.type === "BAN_PENDING" ? "Ban pending" : "Mute"}</div>
                <div className={styles.heroText}>{selectedSanction.reason}</div>
                <div className={styles.heroSub}>
                  Utilisateur {selectedSanction.userID} · Modérateur {selectedSanction.moderatorID} · Cree le {formatDate(selectedSanction.createdAt)}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>Resume</div>
                <div className={styles.sectionBody}>
                  <div className={styles.facts}>
                    <div className={styles.fact}>
                      <div className={styles.factLabel}>Etat</div>
                      <div className={styles.factValue}>{selectedSanction.isActive ? "Active" : "Inactive"}</div>
                    </div>
                    <div className={styles.fact}>
                      <div className={styles.factLabel}>Duree</div>
                      <div className={styles.factValue}>{formatDuration(selectedSanction.durationMs)}</div>
                    </div>
                    <div className={styles.fact}>
                      <div className={styles.factLabel}>Expire le</div>
                      <div className={styles.factValue}>{formatDate(selectedSanction.expiresAt)}</div>
                    </div>
                    <div className={styles.fact}>
                      <div className={styles.factLabel}>Warn lié</div>
                      <div className={styles.factValue}>{selectedSanction.warnID || "Aucun"}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>Modifier la sanction</div>
                <div className={styles.sectionBody}>
                  <div className={styles.form}>
                    <div className={styles.row}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Type</label>
                        <select
                          className={styles.select}
                          value={draft.type}
                          onChange={(e) => setDraft({ ...draft, type: e.target.value as SanctionDraft["type"] })}
                        >
                          <option value="MUTE">MUTE</option>
                          <option value="BAN_PENDING">BAN_PENDING</option>
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Duree (minutes)</label>
                        <input
                          className={styles.input}
                          type="number"
                          min={0}
                          value={draft.durationMs === null ? "" : Math.floor(draft.durationMs / 60_000)}
                          onChange={(e) => {
                            const value = e.target.value.trim();
                            setDraft({ ...draft, durationMs: value === "" ? null : Number(value) * 60_000 });
                          }}
                        />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Motif</label>
                      <textarea
                        className={styles.textarea}
                        value={draft.reason}
                        onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                      />
                    </div>
                    <div className={styles.actions}>
                      <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void handleSanctionSave()}>
                        Enregistrer
                      </button>
                      <button className={`${styles.button} ${styles.buttonDanger}`} onClick={() => void handleSanctionRevoke()}>
                        Revoquer
                      </button>
                    </div>
                  </div>
                </div>
              </section>
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
