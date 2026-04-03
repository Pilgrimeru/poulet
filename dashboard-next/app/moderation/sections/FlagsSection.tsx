"use client";

import styles from "@/app/moderation/Moderation.module.css";
import {
  Collapsible,
  ContextViewer,
  SeverityTag,
  UserCard,
} from "@/features/moderation/components/shared";
import {
  FLAG_STATUS_LABELS,
  NATURE_LABELS,
  SEVERITY_LABELS,
  TYPE_LABELS,
} from "@/features/moderation/constants";
import { formatDate, getStatusClassName } from "@/features/moderation/helpers";
import type {
  FlaggedMessageItem,
  SanctionItem,
} from "@/features/moderation/types";

export function FlagsSection({
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
  const flaggedMessage =
    flag.context?.find((message) => message.id === flag.messageID) ?? null;
  const similarSanctions = (flag.aiAnalysis?.similarSanctionIDs ?? []).map(
    (id) => ({
      id,
      sanction: allSanctions.find((item) => item.id === id) ?? null,
    }),
  );

  return (
    <section className={styles.hero} aria-label="Détail du message signalé">
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <span className={styles.heroKind}>Message signalé</span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>
              {formatDate(flag.createdAt)}
            </span>
            <span
              className={`${styles.statusBadge} ${getStatusClassName(flag.status)}`}
            >
              {FLAG_STATUS_LABELS[flag.status]}
            </span>
            {flag.aiAnalysis?.severity && (
              <SeverityTag value={flag.aiAnalysis.severity} />
            )}
            {flag.aiAnalysis?.nature && (
              <span className={styles.categoryBadge}>
                {NATURE_LABELS[flag.aiAnalysis.nature]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.heroBody}>
        <div className={styles.primaryGrid}>
          <section
            className={styles.panel}
            aria-label="Analyse du message signalé"
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Analyse</h2>
            </div>

            <div className={styles.userGrid}>
              <UserCard
                guildID={guildID}
                userID={flag.reporterID}
                label="Signalant"
              />
              <UserCard
                guildID={guildID}
                userID={flag.targetUserID}
                label="Mis en cause"
              />
            </div>

            <div className={styles.block}>
              <div className={styles.label}>Message signalé</div>
              <p className={styles.blockText}>
                {flaggedMessage?.content ||
                  "Message introuvable dans le contexte."}
              </p>
            </div>

            <div className={`${styles.block} ${styles.blockMuted}`}>
              <div className={styles.label}>Analyse IA</div>
              <div className={styles.aiFlags}>
                <span className={styles.aiFlag}>
                  {flag.aiAnalysis?.isViolation
                    ? "Violation probable"
                    : "Violation non confirmée"}
                </span>
                {flag.aiAnalysis?.needsMoreContext && (
                  <span className={styles.aiFlag}>Contexte insuffisant</span>
                )}
                {flag.aiAnalysis?.sanctionKind && (
                  <span className={styles.aiFlag}>
                    {TYPE_LABELS[flag.aiAnalysis.sanctionKind]}
                  </span>
                )}
              </div>
              <p className={styles.blockTextMuted}>
                {flag.aiAnalysis?.reason || "—"}
              </p>
            </div>
          </section>

          <section
            className={styles.panel}
            aria-label="Sanctions liées et similaires"
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Sanctions</h2>
            </div>

            {linkedSanction ? (
              <div className={styles.block}>
                <div className={styles.label}>Sanction liée</div>
                <p className={styles.blockText}>
                  {TYPE_LABELS[linkedSanction.type]} ·{" "}
                  {SEVERITY_LABELS[linkedSanction.severity]} ·{" "}
                  {NATURE_LABELS[linkedSanction.nature]}
                </p>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => onNavigateToSanction(linkedSanction.id)}
                >
                  Voir la sanction →
                </button>
              </div>
            ) : (
              <div className={`${styles.block} ${styles.blockMuted}`}>
                <div className={styles.label}>Sanction liée</div>
                <p className={styles.blockTextMuted}>Aucune sanction liée.</p>
              </div>
            )}

            <Collapsible
              title="Sanctions similaires"
              defaultOpen={similarSanctions.length > 0}
            >
              {similarSanctions.length === 0 ? (
                <div className={styles.listEmpty}>
                  Aucune sanction similaire proposée.
                </div>
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
                          <button
                            className={`${styles.btn} ${styles.btnGhost}`}
                            onClick={() => onNavigateToSanction(sanction.id)}
                          >
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
          <ContextViewer
            messages={flag.context ?? []}
            highlightMessageID={flag.messageID}
          />
        </Collapsible>
      </div>
    </section>
  );
}
