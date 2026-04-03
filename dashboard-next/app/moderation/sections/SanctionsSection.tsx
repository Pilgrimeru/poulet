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
  TYPE_LABELS
} from "@/features/moderation/constants";
import {
  formatDate,
  formatDuration,
  toDraft,
} from "@/features/moderation/helpers";
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
  return (
    <section className={styles.hero} aria-label="Détail de la sanction">
      <div className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <span className={styles.heroKind}>
            {TYPE_LABELS[selectedSanction.type]}
          </span>
          <div className={styles.heroMeta}>
            <span className={styles.heroDate}>
              {formatDate(selectedSanction.createdAt)}
            </span>
            {selectedSanction.severity !== "NONE" && (
              <span
                className={`${styles.pill} ${styles[`sev${selectedSanction.severity}`]}`}
              >
                {SEVERITY_LABELS[selectedSanction.severity]}
              </span>
            )}
            <span className={styles.categoryBadge}>
              {NATURE_LABELS[selectedSanction.nature]}
            </span>
            <span
              className={`${styles.pill} ${selectedSanction.state === "created" ? styles.pillActive : styles.pillInactive}`}
            >
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
              <div className={styles.panelHint}>
                Lecture rapide de la mesure appliquée
              </div>
            </div>

            <div className={styles.userGrid}>
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

            <div className={styles.factsGrid}>
              <div className={styles.fact}>
                <span className={styles.label}>Type</span>
                <span className={styles.factValue}>
                  {TYPE_LABELS[selectedSanction.type]}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.label}>Durée</span>
                <span className={styles.factValue}>
                  {formatDuration(selectedSanction.durationMs)}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.label}>Nature</span>
                <span className={styles.factValue}>
                  {NATURE_LABELS[selectedSanction.nature]}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.label}>État</span>
                <span className={styles.factValue}>
                  {selectedSanction.state === "created" ? "Active" : "Levée"}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.label}>Créée le</span>
                <span className={styles.factValue}>
                  {formatDate(selectedSanction.createdAt)}
                </span>
              </div>
            </div>

            <div className={styles.block}>
              <div className={styles.label}>Motif</div>
              <p className={styles.blockText}>{selectedSanction.reason}</p>
            </div>

            <div className={`${styles.block} ${styles.blockMuted}`}>
              <div className={styles.label}>Source liée</div>
              {selectedSanctionSourceMeta?.kind === "report" && (
                <>
                  <p className={styles.blockTextMuted}>
                    Cette sanction provient d’un signalement ticket.
                  </p>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() =>
                      onNavigateToReport(selectedSanctionSourceMeta.data.id)
                    }
                  >
                    Voir le signalement →
                  </button>
                </>
              )}
              {selectedSanctionSourceMeta?.kind === "flag" && (
                <>
                  <p className={styles.blockTextMuted}>
                    Cette sanction provient d’un message signalé.
                  </p>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() =>
                      onNavigateToFlag(selectedSanctionSourceMeta.data.id)
                    }
                  >
                    Voir le message signalé →
                  </button>
                </>
              )}
              {!selectedSanctionSourceMeta && (
                <p className={styles.blockTextMuted}>
                  Aucune source de signalement liée trouvée.
                </p>
              )}
            </div>
          </section>

          <section
            className={styles.panel}
            aria-label="Actions sur la sanction"
          >
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
                </div>

                <div className={`${styles.block} ${styles.blockMuted}`}>
                  <div className={styles.label}>Révocation</div>
                  <p className={styles.blockTextMuted}>
                    Utilise cette action seulement si la sanction doit être
                    annulée côté dashboard et côté Discord.
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
                  Cette sanction a été levée. Le panneau d’édition est désactivé
                  pour conserver un historique lisible.
                </p>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => void onReopen()}
                >
                  Réouvrir la sanction
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
