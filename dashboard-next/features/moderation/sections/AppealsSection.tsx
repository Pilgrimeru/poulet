"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/moderation/Moderation.module.css";
import { IconEdit, IconExternalLink, IconSave, IconUndo, SanctionEditor, UserCard } from "../components/shared";
import { NATURE_LABELS, SEVERITY_LABELS } from "../constants";
import { formatDate, toDraft } from "../helpers";
import type { AppealDecision, AppealItem, SanctionDraft, SanctionItem, SourceMeta } from "../types";

export function AppealsSection({
  guildID,
  appeal,
  linkedSanction,
  sourceMeta,
  onDecision,
}: Readonly<{
  guildID: string;
  appeal: AppealItem;
  linkedSanction: SanctionItem | null;
  sourceMeta: SourceMeta;
  onDecision: (decision: AppealDecision) => Promise<void>;
}>) {
  const [draft, setDraft] = useState<SanctionDraft | null>(linkedSanction ? toDraft(linkedSanction) : null);
  const [resolutionReason, setResolutionReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reasonFlash, setReasonFlash] = useState(false);
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);

  const reasonMissing = resolutionReason.trim().length === 0;
  const isResolved = appeal.status !== "pending_review";
  const aiSummary = sourceMeta?.kind === "report" ? sourceMeta.data.context?.aiSummary : null;
  const aiAnalysis = sourceMeta?.kind === "flag" ? sourceMeta.data.aiAnalysis : null;
  const reporterID = sourceMeta?.data.reporterID ?? null;
  const targetUserID = linkedSanction?.userID ?? null;

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
    await onDecision({ reviewOutcome: "modified", resolutionReason, revisedSanction: draft });
  };

  return (
    <section className={styles.hero} aria-label="Détail de l'appel">
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <span className={styles.heroKind}>{isResolved ? "Appel résolu" : "Appel en attente"}</span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>{formatDate(appeal.createdAt)}</span>
            <span className={`${styles.statusBadge} ${styles.statusNeutral}`}>
              {isResolved ? (appeal.reviewOutcome === "overturned" ? "Accepté" : "Traité") : "En attente"}
            </span>
            {linkedSanction && <span className={`${styles.pill} ${styles[`sev${linkedSanction.severity}`]}`}>{SEVERITY_LABELS[linkedSanction.severity]}</span>}
            {linkedSanction && <span className={styles.categoryBadge}>{NATURE_LABELS[linkedSanction.nature]}</span>}
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
                    onChange={(event) => setResolutionReason(event.target.value)}
                    placeholder="Explique la décision humaine prise sur cet appel."
                  />
                  {reasonMissing && <div className={styles.panelHint}>Un motif de décision est requis avant de trancher cet appel.</div>}
                </>
              )}
            </div>

            {aiAnalysis && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Analyse IA</div>
                <p className={styles.blockTextMuted}>{aiAnalysis.reason}</p>
                {aiAnalysis.needsMoreContext && <span className={styles.aiFlag} style={{ marginTop: 6, display: "inline-flex" }}>Contexte insuffisant</span>}
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
                        <button className={`${styles.btn} ${styles.btnGhost} ${styles.iconOnly}`} onClick={() => setIsEditing(true)} title="Modifier la sanction" aria-label="Modifier la sanction">
                          <IconEdit />
                        </button>
                      ) : (
                        <>
                          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.iconOnly}`} onClick={() => void handleSanctionSave()} title="Enregistrer">
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
                                badFaithSanction: { ...draft, reason: resolutionReason },
                              });
                            }}
                            title="Sanctionner l'appel de mauvaise foi"
                          >
                            Mauvaise foi
                          </button>
                          <button className={`${styles.btn} ${styles.btnGhost} ${styles.iconOnly}`} onClick={() => { setDraft(toDraft(linkedSanction)); setIsEditing(false); }} title="Annuler">
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
