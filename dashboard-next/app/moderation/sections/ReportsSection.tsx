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
    SEVERITY_LABELS,
    TYPE_LABELS,
} from "@/features/moderation/constants";
import { formatDate, getStatusClassName } from "@/features/moderation/helpers";
import type {
    ModerationReportItem,
    SanctionItem,
} from "@/features/moderation/types";

export function ReportsSection({
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
            <span className={styles.heroDate}>
              {formatDate(report.createdAt)}
            </span>
            <span
              className={`${styles.statusBadge} ${getStatusClassName(report.status)}`}
            >
              {REPORT_STATUS_LABELS[report.status]}
            </span>
            {aiSummary?.severity && aiSummary.severity !== "NONE" && (
              <span
                className={`${styles.pill} ${styles[`sev${aiSummary.severity}`]}`}
              >
                {SEVERITY_LABELS[aiSummary.severity]}
              </span>
            )}
            {aiSummary?.nature && (
              <span className={styles.categoryBadge}>
                {NATURE_LABELS[aiSummary.nature]}
              </span>
            )}
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

            <div className={styles.factsGrid}>
              <div className={styles.fact}>
                <span className={styles.label}>Confirmations</span>
                <span className={styles.factValue}>
                  {report.confirmationCount ?? 0}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.label}>Violation</span>
                <span className={styles.factValue}>
                  {aiSummary?.isViolation ? "Oui" : "Non"}
                </span>
              </div>
            </div>

            {aiSummary?.summary && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Synthèse</div>
                <p className={styles.blockTextMuted}>{aiSummary.summary}</p>
              </div>
            )}

            {aiSummary?.reason && (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Motif</div>
                <p className={styles.blockTextMuted}>{aiSummary.reason}</p>
              </div>
            )}
          </section>

          <section
            className={styles.panel}
            aria-label="Sanction liée au signalement"
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Sanction liée</h2>
            </div>

            {linkedSanction ? (
              <>
                <div className={styles.factsGrid}>
                  <div className={styles.fact}>
                    <span className={styles.label}>Type</span>
                    <span className={styles.factValue}>
                      {TYPE_LABELS[linkedSanction.type]}
                    </span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.label}>Sévérité</span>
                    <span className={styles.factValue}>
                      {SEVERITY_LABELS[linkedSanction.severity]}
                    </span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.label}>Nature</span>
                    <span className={styles.factValue}>
                      {NATURE_LABELS[linkedSanction.nature]}
                    </span>
                  </div>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => onNavigateToSanction(linkedSanction.id)}
                >
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
