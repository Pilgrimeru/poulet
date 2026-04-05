"use client";

import { ErrorBanner } from "@/components/ui";
import styles from "@/app/stats/Stats.module.css";
import { ActivityChart, Card, ChannelPie, MemberChart, PrecisionToggle, SectionTitle, StatsSkeleton, UserTable } from "./StatsCharts";
import { PRESETS, fmtSecs } from "./stats.utils";
import { useStatsDashboard } from "./useStatsDashboard";

export function StatsScreen() {
  const dashboard = useStatsDashboard();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Activité</h1>
        </div>
        <div className={styles.controls}>
          <div className={styles.presetButtons}>
            {PRESETS.map((preset, index) => (
              <button
                key={preset.label}
                className={`${styles.presetBtn} ${dashboard.presetIdx === index ? styles.presetBtnActive : ""}`}
                onClick={() => dashboard.setPresetIdx(index)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <button
            className={`${styles.refreshBtn} ${dashboard.refreshDisabled ? styles.refreshBtnDisabled : ""}`}
            onClick={dashboard.refresh}
            aria-disabled={dashboard.refreshDisabled}
            title="Rafraîchir les statistiques"
          >
            <svg className={`${styles.refreshIcon} ${dashboard.refreshing ? styles.spinning : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Rafraîchir
          </button>
        </div>
      </div>

      {dashboard.showInitialSkeleton ? <StatsSkeleton /> : (
        <div className={`${styles.content} ${dashboard.refreshing ? styles.contentRefreshing : ""}`}>
          {dashboard.error ? <ErrorBanner message={dashboard.error} className={styles.errorBanner} /> : null}

          <SectionTitle>Membres</SectionTitle>
          <div className={styles.row}>
            <Card wide className={styles.chartCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Évolution détaillée</span>
                <PrecisionToggle value={dashboard.memberPrecision} onChange={dashboard.setMemberPrecision} disableHourTimeline={dashboard.disableHourTimeline} />
              </div>
              <MemberChart overview={dashboard.stats.memberOverview} precision={dashboard.memberPrecision} />
            </Card>
          </div>

          <SectionTitle>Messages</SectionTitle>
          <div className={styles.row}>
            <Card wide className={styles.chartCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Évolution détaillée</span>
                <PrecisionToggle value={dashboard.msgPrecision} onChange={dashboard.setMsgPrecision} disableHourTimeline={dashboard.disableHourTimeline} />
              </div>
              <ActivityChart overview={dashboard.stats.msgOverview} precision={dashboard.msgPrecision} totalLabel="Total messages" />
            </Card>
          </div>
          <div className={styles.row}>
            <Card>
              <div className={styles.cardHeader}><span className={styles.cardTitle}>Salons les plus actifs</span></div>
              <ChannelPie data={dashboard.msgPieData} formatValue={(value) => `${value}`} />
            </Card>
            <Card>
              <p className={styles.cardTitle}>Classement des membres</p>
              <UserTable rows={dashboard.stats.msgByUser} formatValue={(value) => `${value}`} />
            </Card>
          </div>

          <SectionTitle>Vocal</SectionTitle>
          <div className={styles.row}>
            <Card wide className={styles.chartCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Évolution détaillée</span>
                <PrecisionToggle value={dashboard.voicePrecision} onChange={dashboard.setVoicePrecision} disableHourTimeline={dashboard.disableHourTimeline} />
              </div>
              <ActivityChart overview={dashboard.stats.voiceOverview} precision={dashboard.voicePrecision} totalLabel="Temps vocal" totalFormatter={fmtSecs} />
            </Card>
          </div>
          <div className={styles.row}>
            <Card>
              <div className={styles.cardHeader}><span className={styles.cardTitle}>Salons vocaux les plus utilisés</span></div>
              <ChannelPie data={dashboard.voicePieData} formatValue={fmtSecs} />
            </Card>
            <Card>
              <p className={styles.cardTitle}>Classement des membres (vocal)</p>
              <UserTable rows={dashboard.stats.voiceByUser} formatValue={fmtSecs} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
