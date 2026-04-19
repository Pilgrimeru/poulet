"use client";

import { MultiRoleSelect } from "@/components/ui";
import {
  createForm,
  deleteForm,
  fetchDiscordChannels,
  fetchDiscordRoles,
  fetchForms,
  fetchSubmissions,
  reviewSubmission,
  updateForm,
} from "@/features/applications/api";
import { Avatar, UserCard, usePreloadUserMetas, useUserMeta } from "@/features/moderation/hooks/userMeta";
import type {
  ApplicationFormItem,
  ApplicationSubmissionItem,
  ApplicationTab,
  DiscordChannel,
  DiscordRole,
  Question,
  QuestionType,
  SubmissionStatus,
} from "@/features/applications/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import styles from "./Applications.module.css";

const MOBILE_BREAKPOINT = 760;

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  rejected: "Refusée",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  open_text: "Texte libre",
  single_choice: "Choix unique",
  multiple_choice: "Choix multiples",
};

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Chargement…</div>}>
      <ApplicationsPageContent />
    </Suspense>
  );
}

function ApplicationsPageContent() {
  const searchParams = useSearchParams();
  const guildID = searchParams.get("guild") ?? "";

  const [tab, setTab] = useState<ApplicationTab>("forms");
  const [forms, setForms] = useState<ApplicationFormItem[] | null>(null);
  const [submissions, setSubmissions] = useState<ApplicationSubmissionItem[] | null>(null);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsHasMore, setSubmissionsHasMore] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionFormFilter, setSubmissionFormFilter] = useState<string | null>(null);
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<SubmissionStatus | "all">("pending");
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const selectedForm = forms?.find((f) => f.id === selectedFormId) ?? null;
  const selectedSubmission = submissions?.find((s) => s.id === selectedSubmissionId) ?? null;
  const pendingCount = submissions?.filter((s) => s.status === "pending").length ?? 0;

  usePreloadUserMetas(guildID, submissions?.map((submission) => submission.userID) ?? []);

  const loadForms = useCallback(async () => {
    if (!guildID) return;
    const data = await fetchForms(guildID);
    setForms(data);
    if (!selectedFormId && data.length > 0) setSelectedFormId(data[0]!.id);
  }, [guildID, selectedFormId]);

  const loadSubmissions = useCallback(async () => {
    if (!guildID || !submissionFormFilter) return;
    const data = await fetchSubmissions(guildID, submissionFormFilter, {
      status: submissionStatusFilter === "all" ? undefined : submissionStatusFilter,
      limit: 50,
    });
    setSubmissions(data.items);
    setSubmissionsTotal(data.total);
    setSubmissionsHasMore(data.hasMore);
    if (data.items.length > 0 && !selectedSubmissionId) {
      setSelectedSubmissionId(data.items[0]!.id);
    }
  }, [guildID, submissionFormFilter, submissionStatusFilter, selectedSubmissionId]);

  useEffect(() => {
    if (!guildID) return;
    Promise.all([fetchDiscordRoles(guildID), fetchDiscordChannels(guildID)]).then(([r, c]) => {
      setRoles(r);
      setChannels(c);
    }).catch(() => undefined);
  }, [guildID]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => setIsMobile(media.matches);
    sync();

    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileView("detail");
      return;
    }
    setMobileView("list");
  }, [isMobile, tab]);

  useEffect(() => {
    if (!isMobile) return;
    const hasSelection = tab === "forms" ? !!selectedForm : !!selectedSubmission;
    if (!hasSelection) setMobileView("list");
  }, [isMobile, selectedForm, selectedSubmission, tab]);

  useEffect(() => {
    loadForms().catch(() => setForms([]));
  }, [guildID]);

  useEffect(() => {
    if (tab === "submissions" && submissionFormFilter) {
      loadSubmissions().catch(() => setSubmissions([]));
    }
  }, [tab, submissionFormFilter, submissionStatusFilter]);

  useEffect(() => {
    if (tab === "submissions" && forms && forms.length > 0 && !submissionFormFilter) {
      setSubmissionFormFilter(forms[0]!.id);
    }
  }, [tab, forms, submissionFormFilter]);

  const handleCreateForm = useCallback(async () => {
    if (!guildID) return;
    const form = await createForm(guildID, {
      name: "Nouveau formulaire",
      description: "",
      questions: [],
    }).catch((err: unknown) => { setError(String(err)); return null; });
    if (!form) return;
    setForms((prev) => (prev ? [form, ...prev] : [form]));
    setSelectedFormId(form.id);
    setTab("forms");
  }, [guildID]);

  const handleSaveForm = useCallback(async (formID: string, patch: Partial<ApplicationFormItem>) => {
    if (!guildID) return;
    const updated = await updateForm(guildID, formID, patch).catch((err: unknown) => {
      setError(String(err));
      return null;
    });
    if (!updated) return;
    setForms((prev) => prev?.map((f) => f.id === updated.id ? updated : f) ?? null);
  }, [guildID]);

  const handleDeleteForm = useCallback(async (formID: string) => {
    if (!guildID || !window.confirm("Supprimer ce formulaire ? Les candidatures existantes seront conservées.")) return;
    await deleteForm(guildID, formID).catch((err: unknown) => setError(String(err)));
    setForms((prev) => prev?.filter((f) => f.id !== formID) ?? null);
    setSelectedFormId(null);
  }, [guildID]);

  const handleReview = useCallback(async (
    submissionID: string,
    status: "accepted" | "rejected",
    reviewerNotes: string,
  ) => {
    if (!guildID || !submissionFormFilter) return;
    const updated = await reviewSubmission(guildID, submissionFormFilter, submissionID, {
      status,
      reviewerNotes: reviewerNotes.trim() || undefined,
    }).catch((err: unknown) => { setError(String(err)); return null; });
    if (!updated) return;
    setSubmissions((prev) => prev?.map((s) => s.id === updated.id ? updated : s) ?? null);
  }, [guildID, submissionFormFilter]);

  if (!guildID) {
    return <div className={styles.emptyState}>Sélectionne un serveur dans la barre du haut.</div>;
  }

  const showMobileList = !isMobile || mobileView === "list";
  const showMobileDetail = !isMobile || mobileView === "detail";

  return (
    <div className={styles.page}>
      {error && (
        <div style={{ padding: "8px 24px", background: "rgba(239,68,68,0.1)", color: "var(--danger, #e53e3e)", fontSize: 13, borderBottom: "1px solid var(--border-subtle)" }}>
          Erreur : {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}

      <header className={`${styles.header} ${isMobile ? styles.headerMobile : ""}`}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Candidatures</h1>
          <div className={`${styles.tabs} ${isMobile ? styles.tabsMobile : ""}`} role="tablist">
            <button
              role="tab"
              aria-selected={tab === "forms"}
              className={`${styles.tab} ${tab === "forms" ? styles.tabActive : ""}`}
              onClick={() => setTab("forms")}
            >
              Formulaires
            </button>
            <button
              role="tab"
              aria-selected={tab === "submissions"}
              className={`${styles.tab} ${tab === "submissions" ? styles.tabActive : ""}`}
              onClick={() => setTab("submissions")}
            >
              Candidatures
              {pendingCount > 0 && <span className={styles.tabBadge}>{pendingCount}</span>}
            </button>
          </div>
        </div>

        <div className={`${styles.headerActions} ${isMobile ? styles.headerActionsMobile : ""}`}>
          {tab === "forms" && (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreateForm}>
              + Nouveau formulaire
            </button>
          )}
          {tab === "submissions" && forms && forms.length > 0 && (
            <select
              className={styles.fieldInput}
              style={{ width: "auto", minWidth: 200 }}
              value={submissionFormFilter ?? ""}
              onChange={(e) => {
                setSubmissionFormFilter(e.target.value || null);
                setSelectedSubmissionId(null);
                setSubmissions(null);
              }}
            >
              {forms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div className={`${styles.layout} ${isMobile ? styles.layoutMobile : ""}`}>
        {showMobileList && (
          <aside className={`${styles.sidebar} ${isMobile ? styles.sidebarMobile : ""}`}>
            <div className={isMobile ? styles.sidebarStickyMobile : undefined}>
              {tab === "forms" && (
                <div className={`${styles.sidebarMeta} ${isMobile ? styles.sidebarMetaMobile : ""}`}>
                  <span className={styles.sidebarTitle}>Formulaires</span>
                  <span className={styles.sidebarCount}>{forms?.length ?? 0}</span>
                </div>
              )}

              {tab === "submissions" && (
                <>
                  <div className={`${styles.sidebarMeta} ${isMobile ? styles.sidebarMetaMobile : ""}`}>
                    <span className={styles.sidebarTitle}>Candidatures</span>
                    <span className={styles.sidebarCount}>{submissionsTotal}</span>
                  </div>
                  <div className={`${styles.filterRow} ${isMobile ? styles.filterRowMobile : ""}`}>
                    {(["pending", "accepted", "rejected", "all"] as const).map((s) => (
                      <button
                        key={s}
                        className={`${styles.filterPill} ${submissionStatusFilter === s ? styles.filterPillActive : ""}`}
                        onClick={() => { setSubmissionStatusFilter(s); setSelectedSubmissionId(null); setSubmissions(null); }}
                      >
                        {s === "all" ? "Toutes" : STATUS_LABELS[s as SubmissionStatus]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className={styles.list}>
              {tab === "forms" && forms === null && <div className={styles.listEmpty}>Chargement…</div>}
              {tab === "forms" && forms?.length === 0 && <div className={styles.listEmpty}>Aucun formulaire</div>}
              {tab === "forms" && forms?.map((form) => (
                <button
                  key={form.id}
                  className={`${styles.sidebarItem} ${!isMobile && selectedFormId === form.id ? styles.sidebarItemActive : ""}`}
                  onClick={() => {
                    setSelectedFormId(form.id);
                    if (isMobile) setMobileView("detail");
                  }}
                >
                  <span className={styles.sidebarItemName}>{form.name}</span>
                  <span className={styles.sidebarItemMeta}>
                    <span className={`${styles.statusBadge} ${form.isActive ? styles.statusActive : styles.statusInactive}`}>
                      {form.isActive ? "Actif" : "Inactif"}
                    </span>
                    {" · "}
                    {form.questions.length} question{form.questions.length !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}

              {tab === "submissions" && submissions === null && <div className={styles.listEmpty}>Chargement…</div>}
              {tab === "submissions" && submissions?.length === 0 && <div className={styles.listEmpty}>Aucune candidature</div>}
              {tab === "submissions" && submissions?.map((sub) => (
                <SubmissionListItem
                  key={sub.id}
                  guildID={guildID}
                  submission={sub}
                  active={!isMobile && selectedSubmissionId === sub.id}
                  onClick={() => {
                    setSelectedSubmissionId(sub.id);
                    if (isMobile) setMobileView("detail");
                  }}
                />
              ))}
              {tab === "submissions" && submissionsHasMore && (
                <div className={styles.loadMoreWrap}>
                  <button className={`${styles.btn} ${styles.btnGhost} ${styles.loadMoreBtn}`} onClick={() => loadSubmissions()}>
                    Charger plus
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        {showMobileDetail && (
          <main className={`${styles.main} ${isMobile ? styles.mainMobile : ""}`}>
            {tab === "forms" && !selectedForm && forms !== null && (
              <div className={styles.emptyState}>
                {forms.length === 0
                  ? "Crée ton premier formulaire de candidature."
                  : "Sélectionne un formulaire."}
              </div>
            )}
            {tab === "forms" && selectedForm && (
              <FormEditor
                form={selectedForm}
                roles={roles}
                channels={channels}
                onSave={(patch) => handleSaveForm(selectedForm.id, patch)}
                onDelete={() => handleDeleteForm(selectedForm.id)}
                onBack={isMobile ? () => setMobileView("list") : undefined}
              />
            )}

            {tab === "submissions" && !selectedSubmission && submissions !== null && (
              <div className={styles.emptyState}>
                {submissions.length === 0 ? "Aucune candidature pour ce formulaire." : "Sélectionne une candidature."}
              </div>
            )}
            {tab === "submissions" && selectedSubmission && (
              <SubmissionDetail
                guildID={guildID}
                submission={selectedSubmission}
                form={forms?.find((f) => f.id === selectedSubmission.formID) ?? null}
                onReview={handleReview}
                onBack={isMobile ? () => setMobileView("list") : undefined}
              />
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function SubmissionListItem({
  guildID,
  submission,
  active,
  onClick,
}: {
  guildID: string;
  submission: ApplicationSubmissionItem;
  active: boolean;
  onClick: () => void;
}) {
  const meta = useUserMeta(guildID, submission.userID);
  const name = meta?.displayName || meta?.username || submission.userID;
  const handle = meta?.username ? `@${meta.username}` : submission.userID;
  const statusClass = `status${submission.status.charAt(0).toUpperCase()}${submission.status.slice(1)}` as keyof typeof styles;

  return (
    <button
      className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ""}`}
      onClick={onClick}
    >
      <span className={styles.sidebarItemName} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={28} />
        <span style={{ display: "flex", minWidth: 0, flexDirection: "column" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{handle}</span>
        </span>
      </span>
      <span className={styles.sidebarItemMeta}>
        <span className={`${styles.statusBadge} ${styles[statusClass]}`}>
          {STATUS_LABELS[submission.status]}
        </span>
        {" · "}
        {new Date(submission.createdAt).toLocaleDateString("fr-FR")}
      </span>
    </button>
  );
}

// ─── Form Editor ──────────────────────────────────────────────────────────────

interface FormEditorProps {
  form: ApplicationFormItem;
  roles: DiscordRole[];
  channels: DiscordChannel[];
  onSave: (patch: Partial<ApplicationFormItem>) => Promise<void>;
  onDelete: () => Promise<void>;
  onBack?: () => void;
}

function FormEditor({ form, roles, channels, onSave, onDelete, onBack }: FormEditorProps) {
  const [draft, setDraft] = useState<ApplicationFormItem>({ ...form });
  const [optionBuffers, setOptionBuffers] = useState<Record<string, string>>(
    () => Object.fromEntries(form.questions.map((question) => [question.id, (question.options ?? []).join("\n")])),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft({ ...form });
    setOptionBuffers(Object.fromEntries(form.questions.map((question) => [question.id, (question.options ?? []).join("\n")])));
  }, [form.id]);

  const update = (patch: Partial<ApplicationFormItem>) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft).finally(() => setSaving(false));
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete().finally(() => setDeleting(false));
  };

  const addQuestion = () => {
    const newQ: Question = {
      id: Date.now().toString(36),
      label: "",
      type: "open_text",
      required: true,
    };
    setOptionBuffers((current) => ({ ...current, [newQ.id]: "" }));
    update({ questions: [...draft.questions, newQ] });
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    update({
      questions: draft.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    });
  };

  const updateQuestionOptions = (idx: number, rawValue: string) => {
    const question = draft.questions[idx];
    if (!question) return;

    setOptionBuffers((current) => ({ ...current, [question.id]: rawValue }));
    updateQuestion(idx, {
      options: rawValue
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 25),
    });
  };

  const removeQuestion = (idx: number) => {
    const question = draft.questions[idx];
    if (question) {
      setOptionBuffers((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
    }
    update({ questions: draft.questions.filter((_, i) => i !== idx) });
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const qs = [...draft.questions];
    const target = idx + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[idx], qs[target]] = [qs[target]!, qs[idx]!];
    update({ questions: qs });
  };

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);

  return (
    <div className={styles.formEditor}>
      {onBack && (
        <div className={styles.mobileDetailTopbar}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.mobileBackBtn}`} onClick={onBack}>
            ← Retour
          </button>
        </div>
      )}
      <div className={styles.formEditorHeader}>
        <h2 className={styles.formEditorTitle}>{draft.name || "Sans titre"}</h2>
        <div className={styles.formEditorActions}>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression…" : "Supprimer"}
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* Basic fields */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Nom du formulaire</label>
        <input className={styles.fieldInput} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Description (affichée dans le message d'accueil)</label>
        <textarea className={`${styles.fieldInput} ${styles.fieldTextarea}`} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
      </div>

      <div className={styles.toggleRow}>
        <label className={styles.fieldLabel}>Formulaire actif</label>
        <input type="checkbox" checked={draft.isActive} onChange={(e) => update({ isActive: e.target.checked })} />
      </div>

      <hr className={styles.divider} />

      {/* Channel settings */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Salon d'accueil (bouton "Commencer")</label>
        <select className={styles.fieldInput} value={draft.welcomeChannelID ?? ""} onChange={(e) => update({ welcomeChannelID: e.target.value || null })}>
          <option value="">Aucun</option>
          {textChannels.map((c) => (
            <option key={c.id} value={c.id}>#{c.name}</option>
          ))}
        </select>
        {draft.welcomeChannelID && draft.welcomeMessageID && (
          <span className={styles.fieldHint}>✓ Message posté (ID: {draft.welcomeMessageID})</span>
        )}
        {draft.welcomeChannelID && !draft.welcomeMessageID && (
          <span className={styles.fieldHint}>⏳ Le message sera posté automatiquement dans les 30s.</span>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Salon de notification (nouvelles candidatures)</label>
        <select className={styles.fieldInput} value={draft.submissionChannelID ?? ""} onChange={(e) => update({ submissionChannelID: e.target.value || null })}>
          <option value="">Aucun</option>
          {textChannels.map((c) => (
            <option key={c.id} value={c.id}>#{c.name}</option>
          ))}
        </select>
      </div>

      <hr className={styles.divider} />

      {/* Role settings */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Rôles ajoutés si accepté</label>
        <MultiRoleSelect roles={roles} value={draft.acceptRoleIDs} onChange={(v) => update({ acceptRoleIDs: v })} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Rôles retirés si accepté</label>
        <MultiRoleSelect roles={roles} value={draft.removeRoleIDs} onChange={(v) => update({ removeRoleIDs: v })} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Rôles ajoutés si refusé</label>
        <MultiRoleSelect roles={roles} value={draft.rejectRoleIDs} onChange={(v) => update({ rejectRoleIDs: v })} />
      </div>

      <hr className={styles.divider} />

      {/* Timing */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Délai de cooldown après refus (heures, 0 = désactivé)</label>
        <input
          type="number"
          min={0}
          className={styles.fieldInput}
          style={{ width: 120 }}
          value={Math.round(draft.cooldownMs / 3_600_000)}
          onChange={(e) => update({ cooldownMs: Number(e.target.value) * 3_600_000 })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Timeout session non terminée (minutes)</label>
        <input
          type="number"
          min={1}
          max={60}
          className={styles.fieldInput}
          style={{ width: 120 }}
          value={Math.round(draft.sessionTimeoutMs / 60_000)}
          onChange={(e) => update({ sessionTimeoutMs: Number(e.target.value) * 60_000 })}
        />
      </div>

      <hr className={styles.divider} />

      {/* Questions */}
      <div className={styles.questionsSection}>
        <div className={styles.questionsSectionHeader}>
          <span className={styles.fieldLabel}>Questions ({draft.questions.length}/25)</span>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={addQuestion}
            disabled={draft.questions.length >= 25}
          >
            + Ajouter
          </button>
        </div>

        {draft.questions.length === 0 && (
          <div className={styles.listEmpty}>Aucune question. Ajoute-en une.</div>
        )}

        {draft.questions.map((q, idx) => (
          <div key={q.id} className={styles.questionCard}>
            <div className={styles.questionCardHeader}>
              <span className={styles.questionIndex}>Q{idx + 1}</span>
              <div className={styles.questionCardActions}>
                <button className={styles.iconBtn} onClick={() => moveQuestion(idx, -1)} disabled={idx === 0} title="Monter">↑</button>
                <button className={styles.iconBtn} onClick={() => moveQuestion(idx, 1)} disabled={idx === draft.questions.length - 1} title="Descendre">↓</button>
                <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => removeQuestion(idx)} title="Supprimer">✕</button>
              </div>
            </div>

            <div className={styles.questionRow}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Intitulé</label>
                <input
                  className={styles.fieldInput}
                  value={q.label}
                  onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                  placeholder="Pose ta question…"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Type</label>
                <select
                  className={styles.fieldInput}
                  value={q.type}
                  onChange={(e) => updateQuestion(idx, { type: e.target.value as QuestionType })}
                >
                  {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            {(q.type === "single_choice" || q.type === "multiple_choice") && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Options (une par ligne, max 25)</label>
                <textarea
                  className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                  value={optionBuffers[q.id] ?? (q.options ?? []).join("\n")}
                  onChange={(e) => updateQuestionOptions(idx, e.target.value)}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={4}
                />
              </div>
            )}

            <div className={styles.toggleRow}>
              <label className={styles.fieldLabel}>Obligatoire</label>
              <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(idx, { required: e.target.checked })} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Placeholder (optionnel)</label>
              <input
                className={styles.fieldInput}
                value={q.placeholder ?? ""}
                onChange={(e) => updateQuestion(idx, { placeholder: e.target.value || undefined })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Submission Detail ────────────────────────────────────────────────────────

function SubmissionDetail({
  guildID,
  submission,
  form,
  onReview,
  onBack,
}: {
  guildID: string;
  submission: ApplicationSubmissionItem;
  form: ApplicationFormItem | null;
  onReview: (id: string, status: "accepted" | "rejected", notes: string) => Promise<void>;
  onBack?: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNotes("");
  }, [submission.id]);

  const handleDecision = async (status: "accepted" | "rejected") => {
    setSubmitting(true);
    await onReview(submission.id, status, notes).finally(() => setSubmitting(false));
  };

  const getAnswerDisplay = (questionId: string): string => {
    const a = submission.answers[questionId];
    if (!a) return "(sans réponse)";
    return Array.isArray(a) ? a.join(", ") : a;
  };

  const statusClass = `status${submission.status.charAt(0).toUpperCase()}${submission.status.slice(1)}` as keyof typeof styles;

  return (
    <div className={styles.submissionDetail}>
      {onBack && (
        <div className={styles.mobileDetailTopbar}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.mobileBackBtn}`} onClick={onBack}>
            ← Retour
          </button>
        </div>
      )}
      <div className={styles.submissionHeader}>
        <div>
          <UserCard guildID={guildID} userID={submission.userID} label="Candidat" />
          <div className={styles.userDate}>{new Date(submission.createdAt).toLocaleString("fr-FR")}</div>
        </div>
        <span className={`${styles.statusBadge} ${styles[statusClass]}`}>
          {STATUS_LABELS[submission.status]}
        </span>
      </div>

      {/* Answers */}
      <div className={styles.answersSection}>
        {form?.questions.map((q) => (
          <div key={q.id} className={styles.answerCard}>
            <div className={styles.answerQuestion}>{q.label}</div>
            <div className={styles.answerValue}>{getAnswerDisplay(q.id)}</div>
          </div>
        ))}
        {!form && Object.entries(submission.answers).map(([qId, ans]) => (
          <div key={qId} className={styles.answerCard}>
            <div className={styles.answerQuestion}>{qId}</div>
            <div className={styles.answerValue}>{Array.isArray(ans) ? ans.join(", ") : ans}</div>
          </div>
        ))}
      </div>

      {/* Review panel */}
      <div className={styles.reviewSection}>
        {submission.status === "pending" ? (
          <>
            <div className={styles.reviewTitle}>Révision</div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Note pour l'utilisateur (optionnel)</label>
              <textarea
                className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Message envoyé par DM avec la décision…"
                rows={3}
              />
            </div>
            <div className={styles.reviewActions}>
              <button
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={() => handleDecision("accepted")}
                disabled={submitting}
              >
                ✅ Accepter
              </button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => handleDecision("rejected")}
                disabled={submitting}
              >
                ❌ Refuser
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className={styles.reviewTitle}>
              {submission.status === "accepted" ? "✅ Acceptée" : "❌ Refusée"}
            </div>
            {submission.reviewedAt && (
              <div className={styles.reviewedInfo}>
                Le {new Date(submission.reviewedAt).toLocaleString("fr-FR")}
                {submission.reviewedByUserID && ` · par <@${submission.reviewedByUserID}>`}
              </div>
            )}
            {submission.reviewerNotes && (
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                {submission.reviewerNotes}
              </div>
            )}
            <div className={styles.reviewedInfo} style={{ marginTop: 6 }}>
              {submission.rolesApplied ? "✓ Rôles appliqués" : "⏳ Application des rôles en attente…"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
