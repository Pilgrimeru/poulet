"use client";

import styles from "@/app/moderation/Moderation.module.css";
import {
  Collapsible,
  ContextViewer,
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
    <section className={styles.detail} aria-label="Détail du message signalé">
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <span className={styles.detailTitle}>Message signalé</span>
          <time className={styles.detailDate} dateTime={new Date(flag.createdAt).toISOString()}>
            {formatDate(flag.createdAt)}
          </time>
        </div>
        <div className={styles.detailBadges}>
          <span className={`${styles.statusBadge} ${getStatusClassName(flag.status)}`}>
            {FLAG_STATUS_LABELS[flag.status]}
          </span>
          {flag.aiAnalysis?.severity && flag.aiAnalysis.severity !== "NONE" && (
            <span className={`${styles.pill} ${styles[`sev${flag.aiAnalysis.severity}`]}`}>
              {SEVERITY_LABELS[flag.aiAnalysis.severity]}
            </span>
          )}
          {flag.aiAnalysis?.nature && (
            <span className={styles.categoryBadge}>
              {NATURE_LABELS[flag.aiAnalysis.nature]}
            </span>
          )}
        </div>
      </header>

      <div className={styles.detailBody}>
        <div className={styles.detailUsers}>
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

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Message signalé</h3>
          <p className={styles.detailCardText}>
            {flaggedMessage?.content || "Message introuvable dans le contexte."}
          </p>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Analyse IA</h3>
          {flag.aiAnalysis && (
            <div className={styles.aiFlags}>
              <span className={styles.aiFlag}>
                {flag.aiAnalysis.isViolation
                  ? "Violation probable"
                  : "Violation non confirmée"}
              </span>
              {flag.aiAnalysis.needsMoreContext && (
                <span className={styles.aiFlag}>Contexte insuffisant</span>
              )}
              {flag.aiAnalysis.sanctionKind && TYPE_LABELS[flag.aiAnalysis.sanctionKind] && (
                <span className={styles.aiFlag}>
                  {TYPE_LABELS[flag.aiAnalysis.sanctionKind]}
                </span>
              )}
            </div>
          )}
          <p className={styles.detailCardTextMuted}>
            {flag.aiAnalysis?.reason || "—"}
          </p>
        </div>

        {linkedSanction && (
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Sanction liée</h3>
            <p className={styles.detailCardText}>
              {TYPE_LABELS[linkedSanction.type]} · {SEVERITY_LABELS[linkedSanction.severity]} · {NATURE_LABELS[linkedSanction.nature]}
            </p>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => onNavigateToSanction(linkedSanction.id)}
            >
              Voir la sanction →
            </button>
          </div>
        )}

        {similarSanctions.length > 0 && (
          <div className={styles.detailCard}>
            <Collapsible title="Sanctions similaires" defaultOpen>
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
            </Collapsible>
          </div>
        )}

        <div className={styles.detailCard}>
          <Collapsible title="Messages de contexte" defaultOpen>
            <ContextViewer
              messages={flag.context ?? []}
              highlightMessageID={flag.messageID}
            />
          </Collapsible>
        </div>
      </div>
    </section>
  );
}
