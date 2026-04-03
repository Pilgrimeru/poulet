"use client";

import styles from "@/app/moderation/Moderation.module.css";
import {
  IconEdit,
  IconExternalLink,
  IconSave,
  IconUndo,
  SanctionEditor,
  UserCard,
} from "@/features/moderation/components/shared";
import {
  NATURE_LABELS,
  SEVERITY_LABELS,
} from "@/features/moderation/constants";
import { formatDate, toDraft } from "@/features/moderation/helpers";
import type {
  AppealDecision,
  AppealItem,
  SanctionDraft,
  SanctionItem,
  SourceMeta,
} from "@/features/moderation/types";
import { useEffect, useRef, useState } from "react";

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
  const [draft, setDraft] = useState<SanctionDraft | null>(
    linkedSanction ? toDraft(linkedSanction) : null,
  );
  const [resolutionReason, setResolutionReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reasonFlash, setReasonFlash] = useState(false);
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);

  const reasonMissing = resolutionReason.trim().length === 0;
  const isResolved = appeal.status !== "pending_review";
  const aiSummary =
    sourceMeta?.kind === "report" ? sourceMeta.data.context?.aiSummary : null;
  const aiAnalysis =
    sourceMeta?.kind === "flag" ? sourceMeta.data.aiAnalysis : null;
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
    await onDecision({
      reviewOutcome: "modified",
      resolutionReason,
      revisedSanction: draft,
    });
  };

  return (
    <section className={styles.detail} aria-label="Détail de l'appel">
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <span className={styles.detailTitle}>
            {isResolved ? "Appel résolu" : "Appel en attente"}
          </span>
          <time className={styles.detailDate} dateTime={new Date(appeal.createdAt).toISOString()}>
            {formatDate(appeal.createdAt)}
          </time>
        </div>
        <div className={styles.detailBadges}>
          <span className={`${styles.statusBadge} ${styles.statusNeutral}`}>
            {isResolved
              ? appeal.reviewOutcome === "overturned"
                ? "Accepté"
                : "Traité"
              : "En attente"}
          </span>
          {linkedSanction && linkedSanction.severity !== "NONE" && (
            <span className={`${styles.pill} ${styles[`sev${linkedSanction.severity}`]}`}>
              {SEVERITY_LABELS[linkedSanction.severity]}
            </span>
          )}
          {linkedSanction && (
            <span className={styles.categoryBadge}>
              {NATURE_LABELS[linkedSanction.nature]}
            </span>
          )}
        </div>
        {!isResolved && (
          <div className={styles.detailActions}>
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
                void onDecision({
                  reviewOutcome: "overturned",
                  resolutionReason,
                });
              }}
            >
              Accepter · lever la sanction
            </button>
          </div>
        )}
      </header>

      <div className={styles.detailBody}>
        {(targetUserID || reporterID) && (
          <div className={styles.detailUsers}>
            {targetUserID && (
              <UserCard
                guildID={guildID}
                userID={targetUserID}
                label="Utilisateur sanctionné"
              />
            )}
            {reporterID && (
              <UserCard
                guildID={guildID}
                userID={reporterID}
                label="Signalé par"
              />
            )}
          </div>
        )}

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Déclaration d'appel</h3>
          <p className={styles.detailCardText}>{appeal.text || "—"}</p>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Décision modérateur</h3>
          {isResolved ? (
            <p className={styles.detailCardText}>{appeal.resolutionReason || "—"}</p>
          ) : (
            <>
              <textarea
                ref={reasonTextareaRef}
                className={`${styles.textarea} ${reasonFlash ? styles.textareaFlashError : ""}`}
                value={resolutionReason}
                onChange={(event) => setResolutionReason(event.target.value)}
                placeholder="Explique la décision humaine prise sur cet appel."
              />
              {reasonMissing && (
                <p className={styles.detailHint}>
                  Un motif de décision est requis avant de trancher cet appel.
                </p>
              )}
            </>
          )}
        </div>

        {aiAnalysis && (
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Analyse IA</h3>
            <p className={styles.detailCardTextMuted}>{aiAnalysis.reason}</p>
            {aiAnalysis.needsMoreContext && (
              <span className={styles.aiFlag}>Contexte insuffisant</span>
            )}
          </div>
        )}

        {aiSummary?.summary && (
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Synthèse IA (QQOQCCP)</h3>
            <p className={styles.detailCardTextMuted}>{aiSummary.summary}</p>
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

        {linkedSanction && draft && (
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Sanction liée</h3>
            <SanctionEditor
              draft={appeal.revisedSanction ?? draft}
              onChange={setDraft}
              isEditing={!isResolved && isEditing}
            />
            {!isResolved && (
              <div className={styles.detailCardActions}>
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
                      onClick={() => {
                        setDraft(toDraft(linkedSanction));
                        setIsEditing(false);
                      }}
                      title="Annuler"
                    >
                      <IconUndo />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
