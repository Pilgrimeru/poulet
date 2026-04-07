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

const PAGE_SIZE = 50;
const MOBILE_BREAKPOINT = 760;

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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [limits, setLimits] = useState<Record<Tab, number>>({
    appeals: PAGE_SIZE,
    sanctions: PAGE_SIZE,
    reports: PAGE_SIZE,
    flags: PAGE_SIZE,
  });
  const [totals, setTotals] = useState<Record<Tab, number>>({
    appeals: 0,
    sanctions: 0,
    reports: 0,
    flags: 0,
  });
  const [hasMore, setHasMore] = useState<Record<Tab, boolean>>({
    appeals: false,
    sanctions: false,
    reports: false,
    flags: false,
  });

  const refreshData = useCallback(async (preserveSelection = true) => {
    if (!guildID) return;

    const [nextAppeals, nextSanctions, nextReports, nextFlags] = await Promise.all([
      fetchAppeals(guildID, {
        status: appealFilter === "all" ? undefined : "pending_review",
        limit: limits.appeals,
      }),
      fetchSanctions(guildID, { limit: limits.sanctions }),
      fetchReports(guildID, { limit: limits.reports }),
      fetchFlags(guildID, { limit: limits.flags }),
    ]);

    setAppeals(nextAppeals.items);
    setSanctions(nextSanctions.items);
    setReports(nextReports.items);
    setFlags(nextFlags.items);
    setTotals({
      appeals: nextAppeals.total,
      sanctions: nextSanctions.total,
      reports: nextReports.total,
      flags: nextFlags.total,
    });
    setHasMore({
      appeals: nextAppeals.hasMore,
      sanctions: nextSanctions.hasMore,
      reports: nextReports.hasMore,
      flags: nextFlags.hasMore,
    });
    setSelectedAppealId((current) => {
      if (preserveSelection && current && nextAppeals.items.some((item) => item.id === current)) return current;
      if (!preserveSelection && initialAppealId && nextAppeals.items.some((item) => item.id === initialAppealId)) return initialAppealId;
      return nextAppeals.items[0]?.id ?? null;
    });
    setSelectedSanctionId((current) => preserveSelection && current && nextSanctions.items.some((item) => item.id === current) ? current : (nextSanctions.items[0]?.id ?? null));
    setSelectedReportId((current) => {
      if (preserveSelection && current && nextReports.items.some((item) => item.id === current)) return current;
      if (!preserveSelection && initialReportId && nextReports.items.some((item) => item.id === initialReportId)) return initialReportId;
      return nextReports.items[0]?.id ?? null;
    });
    setSelectedFlagId((current) => preserveSelection && current && nextFlags.items.some((item) => item.id === current) ? current : (nextFlags.items[0]?.id ?? null));
  }, [appealFilter, guildID, initialAppealId, initialReportId, limits]);

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
  }, [isMobile]);

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

  const sanctionsById = useMemo(() => new Map((sanctions ?? []).map((item) => [item.id, item])), [sanctions]);
  const reportsBySanctionId = useMemo(() => new Map((reports ?? []).filter((item) => item.sanctionID).map((item) => [item.sanctionID as string, item])), [reports]);
  const flagsBySanctionId = useMemo(() => new Map((flags ?? []).filter((item) => item.sanctionID).map((item) => [item.sanctionID as string, item])), [flags]);

  const visibleAppeals = useMemo(
    () => (appeals ?? []).filter((item) => {
      const linked = sanctionsById.get(item.sanctionID);
      return !linked || linked.state !== "canceled";
    }),
    [appeals, sanctionsById],
  );

  const selectedAppeal = useMemo(() => visibleAppeals.find((item) => item.id === selectedAppealId) ?? visibleAppeals[0] ?? null, [visibleAppeals, selectedAppealId]);
  const selectedSanction = useMemo(() => sanctions?.find((item) => item.id === selectedSanctionId) ?? sanctions?.[0] ?? null, [sanctions, selectedSanctionId]);
  const selectedReport = useMemo(() => reports?.find((item) => item.id === selectedReportId) ?? reports?.[0] ?? null, [reports, selectedReportId]);
  const selectedFlag = useMemo(() => flags?.find((item) => item.id === selectedFlagId) ?? flags?.[0] ?? null, [flags, selectedFlagId]);

  useEffect(() => {
    if (!isMobile) return;
    const hasSelection = (
      (tab === "appeals" && selectedAppeal) ||
      (tab === "sanctions" && selectedSanction) ||
      (tab === "reports" && selectedReport) ||
      (tab === "flags" && selectedFlag)
    );

    if (!hasSelection) setMobileView("list");
  }, [isMobile, selectedAppeal, selectedFlag, selectedReport, selectedSanction, tab]);

  const linkedSanction = useMemo(() => selectedAppeal ? sanctionsById.get(selectedAppeal.sanctionID) ?? null : null, [sanctionsById, selectedAppeal]);
  const linkedSanctionForReport = useMemo(() => selectedReport?.sanctionID ? sanctionsById.get(selectedReport.sanctionID) ?? null : null, [sanctionsById, selectedReport]);
  const linkedSanctionForFlag = useMemo(() => selectedFlag?.sanctionID ? sanctionsById.get(selectedFlag.sanctionID) ?? null : null, [sanctionsById, selectedFlag]);

  const appealSourceMeta = useMemo(() => {
    if (!linkedSanction) return null;
    const flag = flagsBySanctionId.get(linkedSanction.id);
    if (flag) return { kind: "flag" as const, data: flag };
    const report = reportsBySanctionId.get(linkedSanction.id);
    return report ? { kind: "report" as const, data: report } : null;
  }, [flagsBySanctionId, linkedSanction, reportsBySanctionId]);

  const selectedSanctionSourceMeta = useMemo(() => {
    if (!selectedSanction) return null;
    const flag = flagsBySanctionId.get(selectedSanction.id);
    if (flag) return { kind: "flag" as const, data: flag };
    const report = reportsBySanctionId.get(selectedSanction.id);
    return report ? { kind: "report" as const, data: report } : null;
  }, [flagsBySanctionId, reportsBySanctionId, selectedSanction]);

  const preloadUserIDs = useMemo(() => {
    const ids = new Set<string>();
    const activeList = tab === "appeals" ? visibleAppeals : tab === "sanctions" ? (sanctions ?? []) : tab === "reports" ? (reports ?? []) : (flags ?? []);

    for (const item of activeList.slice(0, 20)) {
      if ("userID" in item) ids.add(item.userID);
      if ("moderatorID" in item && item.moderatorID) ids.add(item.moderatorID);
      if ("reporterID" in item) ids.add(item.reporterID);
      if ("targetUserID" in item) ids.add(item.targetUserID);
    }

    if (selectedAppeal) {
      const linked = sanctionsById.get(selectedAppeal.sanctionID);
      if (linked) {
        ids.add(linked.userID);
        ids.add(linked.moderatorID);
      }
    }
    if (selectedSanction) {
      ids.add(selectedSanction.userID);
      ids.add(selectedSanction.moderatorID);
    }
    if (selectedReport) {
      ids.add(selectedReport.reporterID);
      ids.add(selectedReport.targetUserID);
    }
    if (selectedFlag) {
      ids.add(selectedFlag.reporterID);
      ids.add(selectedFlag.targetUserID);
    }
    return [...ids];
  }, [flags, reports, sanctions, sanctionsById, selectedAppeal, selectedFlag, selectedReport, selectedSanction, tab]);

  usePreloadUserMetas(guildID, preloadUserIDs);

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

    setAppeals((current) => (current ?? []).filter((item) => item.id !== selectedAppeal.id));
    const nextVisible = visibleAppeals.find((item) => item.id !== selectedAppeal.id);
    setSelectedAppealId(nextVisible?.id ?? null);
  }, [appeals, guildID, linkedSanction, selectedAppeal, visibleAppeals]);

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
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleNavigateToReport = useCallback((reportID: string) => {
    setSelectedReportId(reportID);
    setTab("reports");
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleNavigateToFlag = useCallback((flagID: string) => {
    setSelectedFlagId(flagID);
    setTab("flags");
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleSelectAppeal = useCallback((appealID: string) => {
    setSelectedAppealId(appealID);
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleSelectSanction = useCallback((sanctionID: string) => {
    setSelectedSanctionId(sanctionID);
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleSelectReport = useCallback((reportID: string) => {
    setSelectedReportId(reportID);
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleSelectFlag = useCallback((flagID: string) => {
    setSelectedFlagId(flagID);
    if (isMobile) setMobileView("detail");
  }, [isMobile]);

  const handleBackToList = useCallback(() => {
    setMobileView("list");
  }, []);

  const handleLoadMore = useCallback(() => {
    setLimits((current) => ({ ...current, [tab]: current[tab] + PAGE_SIZE }));
  }, [tab]);

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

  const actionableAppeals = visibleAppeals.filter((item) => item.status === "pending_review").length;
  const sidebarTitle = tab === "appeals" ? (appealFilter === "all" ? "Tous" : "En attente") : tab === "sanctions" ? "Toutes" : tab === "reports" ? "Signalements" : "Messages signalés";
  const sidebarCount = totals[tab];
  const showLoadMore = hasMore[tab];
  const showMobileList = !isMobile || mobileView === "list";
  const showMobileDetail = !isMobile || mobileView === "detail";
  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${isMobile ? styles.headerMobile : ""}`}>
        <h1 className={styles.title}>Modération</h1>
        <div className={`${styles.tabs} ${isMobile ? styles.tabsMobile : ""}`} role="tablist">
          <button role="tab" aria-selected={tab === "appeals"} className={`${styles.tab} ${tab === "appeals" ? styles.tabActive : ""}`} onClick={() => { setTab("appeals"); if (isMobile) setMobileView("list"); }}>
            Appels
            {actionableAppeals > 0 && <span className={styles.tabBadge} aria-label={`${actionableAppeals} en attente`}>{actionableAppeals}</span>}
          </button>
          <button role="tab" aria-selected={tab === "sanctions"} className={`${styles.tab} ${tab === "sanctions" ? styles.tabActive : ""}`} onClick={() => { setTab("sanctions"); if (isMobile) setMobileView("list"); }}>Sanctions</button>
          <button role="tab" aria-selected={tab === "reports"} className={`${styles.tab} ${tab === "reports" ? styles.tabActive : ""}`} onClick={() => { setTab("reports"); if (isMobile) setMobileView("list"); }}>Signalements</button>
          <button role="tab" aria-selected={tab === "flags"} className={`${styles.tab} ${tab === "flags" ? styles.tabActive : ""}`} onClick={() => { setTab("flags"); if (isMobile) setMobileView("list"); }}>Messages signalés</button>
        </div>
      </header>

      <div className={`${styles.layout} ${isMobile ? styles.layoutMobile : ""}`}>
        {showMobileList && (
          <aside className={`${styles.sidebar} ${isMobile ? styles.sidebarMobile : ""}`} aria-label={tab === "appeals" ? "Liste des appels" : tab === "sanctions" ? "Liste des sanctions" : tab === "reports" ? "Liste des signalements" : "Liste des messages signalés"}>
            <div className={isMobile ? styles.sidebarStickyMobile : undefined}>
              <div className={`${styles.sidebarMeta} ${isMobile ? styles.sidebarMetaMobile : ""}`}>
                <span className={styles.sidebarTitle}>{sidebarTitle}</span>
                <span className={styles.sidebarCount}>{sidebarCount}</span>
              </div>

              {tab === "appeals" && (
                <div className={`${styles.filterRow} ${isMobile ? styles.filterRowMobile : ""}`}>
                  <button className={`${styles.filterPill} ${appealFilter === "pending_review" ? styles.filterPillActive : ""}`} onClick={() => setAppealFilter("pending_review")}>En attente</button>
                  <button className={`${styles.filterPill} ${appealFilter === "all" ? styles.filterPillActive : ""}`} onClick={() => setAppealFilter("all")}>Tous</button>
                </div>
              )}
            </div>

            <div className={styles.list}>
              {tab === "appeals" && visibleAppeals.length === 0 && <div className={styles.listEmpty}>Aucun appel</div>}
              {tab === "appeals" && visibleAppeals.map((appeal) => {
                const sanction = sanctionsById.get(appeal.sanctionID);
                return (
                  <SidebarCard
                    key={appeal.id}
                    guildID={guildID}
                    title={sanction ? TYPE_LABELS[sanction.type] : "Appel"}
                    userID={sanction?.userID ?? ""}
                    body={appeal.text}
                  active={!isMobile && selectedAppeal?.id === appeal.id}
                    onClick={() => handleSelectAppeal(appeal.id)}
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
                  active={!isMobile && selectedSanction?.id === sanction.id}
                  onClick={() => handleSelectSanction(sanction.id)}
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
                  active={!isMobile && selectedReport?.id === report.id}
                  onClick={() => handleSelectReport(report.id)}
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
                    active={!isMobile && selectedFlag?.id === flag.id}
                    onClick={() => handleSelectFlag(flag.id)}
                    severity={flag.aiAnalysis?.severity}
                    date={new Date(flag.createdAt).toLocaleDateString("fr-FR")}
                  />
                );
              })}

              {showLoadMore && (
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.loadMoreBtn}`} onClick={handleLoadMore}>
                  Charger plus
                </button>
              )}
            </div>
          </aside>
        )}

        {showMobileDetail && (
        <main className={`${styles.main} ${isMobile ? styles.mainMobile : ""}`} role="tabpanel">
          {isMobile && (
            <div className={styles.mobileDetailTopbar}>
              <button className={`${styles.btn} ${styles.btnGhost} ${styles.mobileBackBtn}`} onClick={handleBackToList}>
                ← Retour
              </button>
            </div>
          )}
            {tab === "appeals" && !selectedAppeal && <div className={styles.emptyState}><div className={styles.emptyStateIcon}>✅</div>Aucun appel en attente.</div>}
            {tab === "appeals" && selectedAppeal && <AppealsSection guildID={guildID} appeal={selectedAppeal} linkedSanction={linkedSanction} sourceMeta={appealSourceMeta} onDecision={handleAppealDecision} onNavigateToSanction={handleNavigateToSanction} />}

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
        )}
      </div>
    </div>
  );
}
