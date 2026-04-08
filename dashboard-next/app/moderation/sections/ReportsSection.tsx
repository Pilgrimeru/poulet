"use client";

import styles from "@/app/moderation/Moderation.module.css";
import {
  Collapsible,
  ContextViewer,
  UserCard,
} from "@/features/moderation/components/shared";
import {
  NATURE_LABELS,
  REPORT_STATUS_LABELS,
  SEVERITY_LABELS
} from "@/features/moderation/constants";
import { formatDate, getStatusClassName } from "@/features/moderation/helpers";
import type {
  ModerationReportItem,
  SanctionItem,
} from "@/features/moderation/types";
import { useState } from "react";

export function ReportsSection({
  guildID,
  report,
  linkedSanction,
  onNavigateToSanction,
  onBack,
}: Readonly<{
  guildID: string;
  report: ModerationReportItem;
  linkedSanction: SanctionItem | null;
  onNavigateToSanction: (sanctionID: string) => void;
  onBack?: () => void;
}>) {
  const aiSummary = report.context?.aiSummary ?? null;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!aiSummary?.summary) return;
    await navigator.clipboard.writeText(aiSummary.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className={styles.detail} aria-label="Détail du signalement">
      <header className={styles.detailHeader}>
        {onBack && (
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.detailBackBtn}`} onClick={onBack}>
            ←
          </button>
        )}
        <div className={styles.detailHeaderLeft}>
          <span className={styles.detailTitle}>Signalement</span>
          <time className={styles.detailDate} dateTime={new Date(report.createdAt).toISOString()}>
            {formatDate(report.createdAt)}
          </time>
        </div>
        <div className={styles.detailBadges}>
          <span className={`${styles.statusBadge} ${getStatusClassName(report.status)}`}>
            {REPORT_STATUS_LABELS[report.status]}
          </span>
          {aiSummary?.severity && aiSummary.severity !== "NONE" && (
            <span className={`${styles.pill} ${styles[`sev${aiSummary.severity}`]}`}>
              {SEVERITY_LABELS[aiSummary.severity]}
            </span>
          )}
          {aiSummary?.nature && (
            <span className={styles.categoryBadge}>
              {NATURE_LABELS[aiSummary.nature]}
            </span>
          )}
        </div>
      </header>

      <div className={styles.detailBody}>
        <div className={styles.detailUsers}>
          <UserCard
            guildID={guildID}
            userID={report.reporterID}
            label="Signalant"
          />
          <UserCard
            guildID={guildID}
            userID={report.targetUserID}
            label="Mis en cause"
          />
        </div>

        {aiSummary?.summary && (
          <div className={styles.detailCard}>
            <div className={styles.detailCardHeader}>
              <h3 className={styles.detailCardTitle}>Synthèse IA</h3>
              <button
                className={styles.copyBtn}
                onClick={handleCopy}
                title="Copier"
                aria-label="Copier la synthèse"
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                  </svg>
                )}
              </button>
            </div>
            <p className={styles.detailCardTextMuted}>{aiSummary.summary}</p>
          </div>
        )}

        {aiSummary?.reason && (
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Motif</h3>
            <p className={styles.detailCardTextMuted}>{aiSummary.reason}</p>
          </div>
        )}

        {linkedSanction && (
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Sanction liée</h3>
            <p className={styles.detailCardTextMuted}>
              Une sanction a été appliquée suite à ce signalement.
            </p>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => onNavigateToSanction(linkedSanction.id)}
            >
              Voir la sanction →
            </button>
          </div>
        )}

        <div className={styles.detailCard}>
          <Collapsible title="Messages de contexte" defaultOpen>
            <ContextViewer messages={report.context?.messages ?? []} />
          </Collapsible>
        </div>
      </div>
    </section>
  );
}
