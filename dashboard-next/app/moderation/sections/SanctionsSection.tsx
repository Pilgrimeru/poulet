"use client";

import styles from "@/app/moderation/Moderation.module.css";
import {
  IconEdit,
  IconSave,
  IconUndo,
  SanctionEditor,
  UserCard,
} from "@/features/moderation/components/shared";
import {
  NATURE_LABELS,
  SEVERITY_LABELS,
  TYPE_LABELS,
} from "@/features/moderation/constants";
import { formatDate, toDraft } from "@/features/moderation/helpers";
import type {
  SanctionDraft,
  SanctionItem,
  SourceMeta,
} from "@/features/moderation/types";

export function SanctionsSection({
  guildID,
  selectedSanction,
  sanctionDraft,
  isEditingSanction,
  confirmRevoke,
  selectedSanctionSourceMeta,
  setSanctionDraft,
  setIsEditingSanction,
  setConfirmRevoke,
  onSave,
  onRevoke,
  onReopen,
  onNavigateToReport,
  onNavigateToFlag,
}: Readonly<{
  guildID: string;
  selectedSanction: SanctionItem;
  sanctionDraft: SanctionDraft;
  isEditingSanction: boolean;
  confirmRevoke: boolean;
  selectedSanctionSourceMeta: SourceMeta;
  setSanctionDraft: (draft: SanctionDraft) => void;
  setIsEditingSanction: (value: boolean) => void;
  setConfirmRevoke: (value: boolean) => void;
  onSave: () => Promise<void>;
  onRevoke: () => Promise<void>;
  onReopen: () => Promise<void>;
  onNavigateToReport: (reportID: string) => void;
  onNavigateToFlag: (flagID: string) => void;
}>) {
  const isRevoked = selectedSanction.state === "canceled";

  return (
    <section className={styles.detail} aria-label="Détail de la sanction">
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <span className={styles.detailTitle}>
            {TYPE_LABELS[selectedSanction.type]}
          </span>
          <time className={styles.detailDate} dateTime={new Date(selectedSanction.createdAt).toISOString()}>
            {formatDate(selectedSanction.createdAt)}
          </time>
        </div>
        <div className={styles.detailBadges}>
          <span className={`${styles.pill} ${isRevoked ? styles.pillInactive : styles.pillActive}`}>
            {isRevoked ? "Révoquée" : "Active"}
          </span>
          {selectedSanction.severity !== "NONE" && (
            <span className={`${styles.pill} ${styles[`sev${selectedSanction.severity}`]}`}>
              {SEVERITY_LABELS[selectedSanction.severity]}
            </span>
          )}
          <span className={styles.categoryBadge}>
            {NATURE_LABELS[selectedSanction.nature]}
          </span>
        </div>
      </header>

      <div className={styles.detailBody}>
        <div className={styles.detailUsers}>
          <UserCard
            guildID={guildID}
            userID={selectedSanction.userID}
            label="Utilisateur sanctionné"
          />
          <UserCard
            guildID={guildID}
            userID={selectedSanction.moderatorID}
            label="Modérateur"
          />
        </div>

        {/* Informations */}
        <div className={`${styles.detailCard} ${isRevoked ? styles.detailCardRevoked : ""}`}>
          {isRevoked && (
            <div className={styles.detailCardRevokedBanner}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm.5-4.5a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 1 0v1Zm.242-5.242a.5.5 0 0 1-.708.708l-1-1a.5.5 0 0 1 0-.708l1-1a.5.5 0 1 1 .708.708L8.5 7.5l-.258.258Z" />
              </svg>
              <span>Sanction révoquée — informations d'origine</span>
            </div>
          )}
          <h3 className={styles.detailCardTitle}>Informations</h3>
          <SanctionEditor
            draft={sanctionDraft}
            onChange={setSanctionDraft}
            isEditing={!isRevoked && isEditingSanction}
          />
          {!isRevoked && (
            <div className={styles.detailCardActions}>
              {!isEditingSanction ? (
                <button
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => setIsEditingSanction(true)}
                >
                  <IconEdit /> Modifier
                </button>
              ) : (
                <>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => void onSave()}
                  >
                    <IconSave /> Enregistrer
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => {
                      setSanctionDraft(toDraft(selectedSanction));
                      setIsEditingSanction(false);
                    }}
                  >
                    <IconUndo /> Réinitialiser
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Source liée + Révocation/Réouverture side by side */}
        <div className={styles.detailCardGrid}>
          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Source liée</h3>
            {selectedSanctionSourceMeta?.kind === "report" && (
              <>
                <p className={styles.detailCardTextMuted}>
                  Cette sanction provient d'un signalement ticket.
                </p>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => onNavigateToReport(selectedSanctionSourceMeta.data.id)}
                >
                  Voir le signalement →
                </button>
              </>
            )}
            {selectedSanctionSourceMeta?.kind === "flag" && (
              <>
                <p className={styles.detailCardTextMuted}>
                  Cette sanction provient d'un message signalé.
                </p>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => onNavigateToFlag(selectedSanctionSourceMeta.data.id)}
                >
                  Voir le message signalé →
                </button>
              </>
            )}
            {!selectedSanctionSourceMeta && (
              <p className={styles.detailCardTextMuted}>
                Aucune source de signalement liée trouvée.
              </p>
            )}
          </div>

          {!isRevoked ? (
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Révocation</h3>
              <p className={styles.detailCardTextMuted}>
                Annule la sanction côté dashboard et Discord.
              </p>
              {!confirmRevoke ? (
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => setConfirmRevoke(true)}
                >
                  Révoquer
                </button>
              ) : (
                <div className={styles.detailCardActions}>
                  <button
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => setConfirmRevoke(false)}
                  >
                    Annuler
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => void onRevoke()}
                  >
                    Confirmer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Réouverture</h3>
              <p className={styles.detailCardTextMuted}>
                Réouvre la sanction pour la réactiver.
              </p>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void onReopen()}
              >
                Réouvrir la sanction
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
