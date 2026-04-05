"use client";

import { AppealsSection } from "@/app/moderation/sections/AppealsSection";
import { FlagsSection } from "@/app/moderation/sections/FlagsSection";
import { ReportsSection } from "@/app/moderation/sections/ReportsSection";
import { SanctionsSection } from "@/app/moderation/sections/SanctionsSection";
import { fetchAppeals, fetchFlags, fetchReports, fetchSanctions, patchAppeal, patchSanction } from "@/features/moderation/api";
import { SidebarCard } from "@/features/moderation/components/shared";
import { FLAG_STATUS_LABELS, REPORT_STATUS_LABELS, TYPE_LABELS } from "@/features/moderation/constants";
import { toDraft } from "@/features/moderation/helpers";
import { usePreloadUserMetas } from "@/features/moderation/hooks/userMeta";
import type { AppealDecision, AppealItem, FlaggedMessageItem, ModerationReportItem, SanctionDraft, SanctionItem, Tab } from "@/features/moderation/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Moderation.module.css";

export default function ModerationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Chargement…</div>}>
      <ModerationPageContent />
    </Suspense>
  );
}

function ModerationPageContent() {
  const searchParams = useSearchParams();
  const guildID = searchParams.get("guild") ?? "";

  const initialTab = (searchParams.get("tab") as Tab | null) ?? "appeals";
  const initialAppealId = searchParams.get("appealId");
  const initialReportId = searchParams.get("reportId");

  const [tab, setTab] = useState<Tab>(initialTab);
  const [appeals, setAppeals] = useState<AppealItem[] | null>(null);
  const [sanctions, setSanctions] = useState<SanctionItem[] | null>(null);
  const [reports, setReports] = useState<ModerationReportItem[] | null>(null);
  const [flags, setFlags] = useState<FlaggedMessageItem[] | null>(null);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [selectedSanctionId, setSelectedSanctionId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [sanctionDraft, setSanctionDraft] = useState<SanctionDraft | null>(null);
  const [isEditingSanction, setIsEditingSanction] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [appealFilter, setAppealFilter] = useState<"pending_review" | "all">("pending_review");

  const refreshData = useCallback(async (preserveSelection = true) => {
    if (!guildID) return;

    const [nextAppeals, nextSanctions, nextReports, nextFlags] = await Promise.all([
      fetchAppeals(guildID, appealFilter === "all" ? undefined : "pending_review"),
      fetchSanctions(guildID),
      fetchReports(guildID),
      fetchFlags(guildID),
    ]);

    setAppeals(nextAppeals);
    setSanctions(nextSanctions);
    setReports(nextReports);
    setFlags(nextFlags);
    setSelectedAppealId((current) => {
      if (preserveSelection && current && nextAppeals.some((item) => item.id === current)) return current;
      if (!preserveSelection && initialAppealId && nextAppeals.some((item) => item.id === initialAppealId)) return initialAppealId;
      return nextAppeals[0]?.id ?? null;
    });
    setSelectedSanctionId((current) => preserveSelection && current && nextSanctions.some((item) => item.id === current) ? current : (nextSanctions[0]?.id ?? null));
    setSelectedReportId((current) => {
      if (preserveSelection && current && nextReports.some((item) => item.id === current)) return current;
      if (!preserveSelection && initialReportId && nextReports.some((item) => item.id === initialReportId)) return initialReportId;
      return nextReports[0]?.id ?? null;
    });
    setSelectedFlagId((current) => preserveSelection && current && nextFlags.some((item) => item.id === current) ? current : (nextFlags[0]?.id ?? null));
  }, [appealFilter, guildID]);

  useEffect(() => {
    refreshData(false).catch(() => {
      setAppeals([]);
      setSanctions([]);
      setReports([]);
      setFlags([]);
    });
  }, [refreshData]);

  useEffect(() => {
    if (!guildID) return;

    const interval = window.setInterval(() => {
      refreshData(true).catch(() => undefined);
    }, 10_000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshData(true).catch(() => undefined);
      }
    }

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [guildID, refreshData]);

  const preloadUserIDs = useMemo(() => {
    const ids = new Set<string>();
    for (const sanction of sanctions ?? []) {
      ids.add(sanction.userID);
      ids.add(sanction.moderatorID);
    }
    for (const report of reports ?? []) {
      ids.add(report.reporterID);
      ids.add(report.targetUserID);
    }
    for (const flag of flags ?? []) {
      ids.add(flag.reporterID);
      ids.add(flag.targetUserID);
    }
    return [...ids];
  }, [flags, reports, sanctions]);

  usePreloadUserMetas(guildID, preloadUserIDs);

  const selectedAppeal = useMemo(() => appeals?.find((item) => item.id === selectedAppealId) ?? appeals?.[0] ?? null, [appeals, selectedAppealId]);
  const selectedSanction = useMemo(() => sanctions?.find((item) => item.id === selectedSanctionId) ?? sanctions?.[0] ?? null, [sanctions, selectedSanctionId]);
  const selectedReport = useMemo(() => reports?.find((item) => item.id === selectedReportId) ?? reports?.[0] ?? null, [reports, selectedReportId]);
  const selectedFlag = useMemo(() => flags?.find((item) => item.id === selectedFlagId) ?? flags?.[0] ?? null, [flags, selectedFlagId]);

  const linkedSanction = useMemo(() => sanctions?.find((item) => item.id === selectedAppeal?.sanctionID) ?? null, [sanctions, selectedAppeal]);
  const linkedSanctionForReport = useMemo(() => sanctions?.find((item) => item.id === selectedReport?.sanctionID) ?? null, [sanctions, selectedReport]);
  const linkedSanctionForFlag = useMemo(() => sanctions?.find((item) => item.id === selectedFlag?.sanctionID) ?? null, [sanctions, selectedFlag]);

  const appealSourceMeta = useMemo(() => {
    if (!linkedSanction) return null;
    const flag = flags?.find((item) => item.sanctionID === linkedSanction.id);
    if (flag) return { kind: "flag" as const, data: flag };
    const report = reports?.find((item) => item.sanctionID === linkedSanction.id);
    return report ? { kind: "report" as const, data: report } : null;
  }, [flags, linkedSanction, reports]);

  const selectedSanctionSourceMeta = useMemo(() => {
    if (!selectedSanction) return null;
    const flag = flags?.find((item) => item.sanctionID === selectedSanction.id);
    if (flag) return { kind: "flag" as const, data: flag };
    const report = reports?.find((item) => item.sanctionID === selectedSanction.id);
    return report ? { kind: "report" as const, data: report } : null;
  }, [flags, reports, selectedSanction]);

  useEffect(() => {
    if (!selectedSanction) return;
    setSanctionDraft(toDraft(selectedSanction));
    setIsEditingSanction(false);
    setConfirmRevoke(false);
  }, [selectedSanction?.id]);

  const handleAppealDecision = useCallback(async (decision: AppealDecision) => {
    if (!selectedAppeal) return;
    if (!decision.resolutionReason.trim()) throw new Error("Un motif de décision est requis.");

    await patchAppeal(guildID, selectedAppeal.id, decision);

    if (decision.reviewOutcome === "overturned" && selectedAppeal.sanctionID) {
      setSanctions((current) => current?.map((item) => item.id === selectedAppeal.sanctionID ? { ...item, state: "canceled" } : item) ?? []);
    }

    if (decision.reviewOutcome === "modified" && selectedAppeal.sanctionID && decision.revisedSanction) {
      setSanctions((current) => current?.map((item) => item.id === selectedAppeal.sanctionID ? { ...item, ...decision.revisedSanction } : item) ?? []);
    }

    if (decision.reviewOutcome === "sanctioned_bad_faith" && decision.badFaithSanction && linkedSanction) {
      const badFaithSanction = decision.badFaithSanction;
      setSanctions((current) => [
        {
          id: `tmp-${Date.now()}`,
          guildID,
          userID: linkedSanction.userID,
          moderatorID: linkedSanction.moderatorID,
          type: badFaithSanction.type,
          severity: badFaithSanction.severity,
          nature: badFaithSanction.nature,
          reason: badFaithSanction.reason,
          durationMs: badFaithSanction.durationMs,
          state: "created",
          createdAt: Date.now(),
        },
        ...(current ?? []),
      ]);
    }

    const nextAppeals = (appeals ?? []).filter((item) => item.id !== selectedAppeal.id);
    setAppeals(nextAppeals);
    setSelectedAppealId(nextAppeals[0]?.id ?? null);
  }, [appeals, guildID, linkedSanction, selectedAppeal]);

  const handleSanctionSave = useCallback(async () => {
    if (!selectedSanction || !sanctionDraft) return;
    const updated = await patchSanction(guildID, selectedSanction.id, sanctionDraft);
    setSanctions((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? []);
    setSanctionDraft(toDraft(updated));
    setIsEditingSanction(false);
  }, [guildID, sanctionDraft, selectedSanction]);

  const handleSanctionRevoke = useCallback(async () => {
    if (!selectedSanction) return;
    const updated = await patchSanction(guildID, selectedSanction.id, { state: "canceled" });
    setSanctions((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? []);
    setSanctionDraft(toDraft(updated));
    setConfirmRevoke(false);
  }, [guildID, selectedSanction]);

  const handleSanctionReopen = useCallback(async () => {
    if (!selectedSanction) return;
    const updated = await patchSanction(guildID, selectedSanction.id, { state: "created" });
    setSanctions((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? []);
    setSanctionDraft(toDraft(updated));
    setConfirmRevoke(false);
  }, [guildID, selectedSanction]);

  const handleNavigateToSanction = useCallback((sanctionID: string) => {
    setSelectedSanctionId(sanctionID);
    setTab("sanctions");
  }, []);

  const handleNavigateToReport = useCallback((reportID: string) => {
    setSelectedReportId(reportID);
    setTab("reports");
  }, []);

  const handleNavigateToFlag = useCallback((flagID: string) => {
    setSelectedFlagId(flagID);
    setTab("flags");
  }, []);

  if (!guildID) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>⚙️</div>
        Sélectionne un serveur dans la barre du haut.
      </div>
    );
  }

  if (appeals === null || sanctions === null || reports === null || flags === null) {
    return <div className={styles.emptyState}>Chargement…</div>;
  }

  const actionableAppeals = appeals.filter((item) => item.status === "pending_review").length;
  const sidebarTitle = tab === "appeals" ? (appealFilter === "all" ? "Tous" : "En attente") : tab === "sanctions" ? "Toutes" : tab === "reports" ? "Signalements" : "Messages signalés";
  const sidebarCount = tab === "appeals" ? appeals.length : tab === "sanctions" ? sanctions.length : tab === "reports" ? reports.length : flags.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Modération</h1>
        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={tab === "appeals"} className={`${styles.tab} ${tab === "appeals" ? styles.tabActive : ""}`} onClick={() => setTab("appeals")}>
            Appels
            {actionableAppeals > 0 && <span className={styles.tabBadge} aria-label={`${actionableAppeals} en attente`}>{actionableAppeals}</span>}
          </button>
          <button role="tab" aria-selected={tab === "sanctions"} className={`${styles.tab} ${tab === "sanctions" ? styles.tabActive : ""}`} onClick={() => setTab("sanctions")}>Sanctions</button>
          <button role="tab" aria-selected={tab === "reports"} className={`${styles.tab} ${tab === "reports" ? styles.tabActive : ""}`} onClick={() => setTab("reports")}>Signalements</button>
          <button role="tab" aria-selected={tab === "flags"} className={`${styles.tab} ${tab === "flags" ? styles.tabActive : ""}`} onClick={() => setTab("flags")}>Messages signalés</button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label={tab === "appeals" ? "Liste des appels" : tab === "sanctions" ? "Liste des sanctions" : tab === "reports" ? "Liste des signalements" : "Liste des messages signalés"}>
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarTitle}>{sidebarTitle}</span>
            <span className={styles.sidebarCount}>{sidebarCount}</span>
          </div>

          {tab === "appeals" && (
            <div className={styles.filterRow}>
              <button className={`${styles.filterPill} ${appealFilter === "pending_review" ? styles.filterPillActive : ""}`} onClick={() => setAppealFilter("pending_review")}>En attente</button>
              <button className={`${styles.filterPill} ${appealFilter === "all" ? styles.filterPillActive : ""}`} onClick={() => setAppealFilter("all")}>Tous</button>
            </div>
          )}

          <div className={styles.list}>
            {tab === "appeals" && appeals.length === 0 && <div className={styles.listEmpty}>Aucun appel</div>}
            {tab === "appeals" && appeals.map((appeal) => {
              const sanction = sanctions.find((item) => item.id === appeal.sanctionID);
              return (
                <SidebarCard
                  key={appeal.id}
                  guildID={guildID}
                  title={sanction ? TYPE_LABELS[sanction.type] : "Appel"}
                  userID={sanction?.userID ?? ""}
                  body={appeal.text}
                  active={selectedAppeal?.id === appeal.id}
                  onClick={() => setSelectedAppealId(appeal.id)}
                  severity={sanction?.severity}
                  date={new Date(appeal.createdAt).toLocaleDateString("fr-FR")}
                />
              );
            })}

            {tab === "sanctions" && sanctions.length === 0 && <div className={styles.listEmpty}>Aucune sanction</div>}
            {tab === "sanctions" && sanctions.map((sanction) => (
              <SidebarCard
                key={sanction.id}
                guildID={guildID}
                title={TYPE_LABELS[sanction.type]}
                userID={sanction.userID}
                body={sanction.reason}
                active={selectedSanction?.id === sanction.id}
                onClick={() => setSelectedSanctionId(sanction.id)}
                severity={sanction.severity}
                state={sanction.state}
                date={new Date(sanction.createdAt).toLocaleDateString("fr-FR")}
              />
            ))}

            {tab === "reports" && reports.length === 0 && <div className={styles.listEmpty}>Aucun signalement</div>}
            {tab === "reports" && reports.map((report) => (
              <SidebarCard
                key={report.id}
                guildID={guildID}
                title={REPORT_STATUS_LABELS[report.status]}
                userID={report.targetUserID}
                body={report.reporterSummary}
                active={selectedReport?.id === report.id}
                onClick={() => setSelectedReportId(report.id)}
                severity={report.context?.aiSummary?.severity}
                date={new Date(report.createdAt).toLocaleDateString("fr-FR")}
              />
            ))}

            {tab === "flags" && flags.length === 0 && <div className={styles.listEmpty}>Aucun message signalé</div>}
            {tab === "flags" && flags.map((flag) => {
              const flaggedMessage = flag.context?.find((message) => message.id === flag.messageID) ?? null;
              return (
                <SidebarCard
                  key={flag.id}
                  guildID={guildID}
                  title={FLAG_STATUS_LABELS[flag.status]}
                  userID={flag.targetUserID}
                  body={flaggedMessage?.content ?? "Message introuvable"}
                  active={selectedFlag?.id === flag.id}
                  onClick={() => setSelectedFlagId(flag.id)}
                  severity={flag.aiAnalysis?.severity}
                  date={new Date(flag.createdAt).toLocaleDateString("fr-FR")}
                />
              );
            })}
          </div>
        </aside>

        <main className={styles.main} role="tabpanel">
          {tab === "appeals" && !selectedAppeal && <div className={styles.emptyState}><div className={styles.emptyStateIcon}>✅</div>Aucun appel en attente.</div>}
          {tab === "appeals" && selectedAppeal && <AppealsSection guildID={guildID} appeal={selectedAppeal} linkedSanction={linkedSanction} sourceMeta={appealSourceMeta} onDecision={handleAppealDecision} />}

          {tab === "sanctions" && !selectedSanction && <div className={styles.emptyState}><div className={styles.emptyStateIcon}>🛡️</div>Aucune sanction enregistrée.</div>}
          {tab === "sanctions" && selectedSanction && sanctionDraft && (
            <SanctionsSection
              guildID={guildID}
              selectedSanction={selectedSanction}
              sanctionDraft={sanctionDraft}
              isEditingSanction={isEditingSanction}
              confirmRevoke={confirmRevoke}
              selectedSanctionSourceMeta={selectedSanctionSourceMeta}
              setSanctionDraft={setSanctionDraft}
              setIsEditingSanction={setIsEditingSanction}
              setConfirmRevoke={setConfirmRevoke}
              onSave={handleSanctionSave}
              onRevoke={handleSanctionRevoke}
              onReopen={handleSanctionReopen}
              onNavigateToReport={handleNavigateToReport}
              onNavigateToFlag={handleNavigateToFlag}
            />
          )}

          {tab === "reports" && !selectedReport && <div className={styles.emptyState}><div className={styles.emptyStateIcon}>📝</div>Aucun signalement disponible.</div>}
          {tab === "reports" && selectedReport && <ReportsSection guildID={guildID} report={selectedReport} linkedSanction={linkedSanctionForReport} onNavigateToSanction={handleNavigateToSanction} />}

          {tab === "flags" && !selectedFlag && <div className={styles.emptyState}><div className={styles.emptyStateIcon}>🚩</div>Aucun message signalé disponible.</div>}
          {tab === "flags" && selectedFlag && <FlagsSection guildID={guildID} flag={selectedFlag} linkedSanction={linkedSanctionForFlag} allSanctions={sanctions} onNavigateToSanction={handleNavigateToSanction} />}
        </main>
      </div>
    </div>
  );
}
