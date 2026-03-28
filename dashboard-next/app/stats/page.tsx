"use client";

import { fetchChannels, fetchGuilds } from "@/lib/api-client";
import {
  fetchMessagesByChannel,
  fetchMessagesByDay,
  fetchMessagesByHour,
  fetchMessagesByHourTimeline,
  fetchMessagesByUser,
  fetchVoiceByChannel,
  fetchVoiceByDay,
  fetchVoiceByHour,
  fetchVoiceByHourTimeline,
  fetchVoiceByUser,
  type ChannelValue,
  type DailyValue,
  type HourlyTimelineValue,
  type HourlyValue,
  type UserValue,
} from "@/lib/api-stats";
import type { ChannelEntry } from "@/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./Stats.module.css";

type Precision = "day" | "hour-timeline" | "hour";

type StatsData = {
  msgByDay: DailyValue[];
  msgByHour: HourlyValue[];
  msgByHourTimeline: HourlyTimelineValue[];
  msgByChannel: ChannelValue[];
  msgByUser: UserValue[];
  voiceByDay: DailyValue[];
  voiceByHour: HourlyValue[];
  voiceByHourTimeline: HourlyTimelineValue[];
  voiceByChannel: ChannelValue[];
  voiceByUser: UserValue[];
};

const EMPTY_STATS: StatsData = {
  msgByDay: [],
  msgByHour: [],
  msgByHourTimeline: [],
  msgByChannel: [],
  msgByUser: [],
  voiceByDay: [],
  voiceByHour: [],
  voiceByHourTimeline: [],
  voiceByChannel: [],
  voiceByUser: [],
};

const CHART_COLORS = [
  "#5865f2", "#ed4245", "#faa61a", "#23a55a", "#00a8fc",
  "#eb459e", "#57f287", "#fee75c", "#9b59b6", "#1abc9c",
];

const PRESETS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
];

function fmtSecs(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}h`;
}

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function fmtDatetime(dt: string): string {
  const [datePart, hourPart] = dt.split(" ");
  const [, m, d] = datePart.split("-");
  return `${d}/${m} ${hourPart}h`;
}

function SectionTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

function Card({ children, wide }: Readonly<{ children: React.ReactNode; wide?: boolean }>) {
  return <div className={`${styles.card} ${wide ? styles.cardWide : ""}`}>{children}</div>;
}

function Empty() {
  return <div className={styles.empty}>Aucune donnée sur cette période</div>;
}

function StatsSkeleton() {
  return (
    <div className={styles.content}>
      <SectionTitle>Messages</SectionTitle>
      <div className={styles.row}>
        <Card wide>
          <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} />
        </Card>
      </div>
      <div className={styles.row}>
        <Card><div className={`${styles.skeletonBlock} ${styles.skeletonPie}`} /></Card>
        <Card><div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} /></Card>
      </div>
      <SectionTitle>Vocal</SectionTitle>
      <div className={styles.row}>
        <Card wide>
          <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} />
        </Card>
      </div>
      <div className={styles.row}>
        <Card><div className={`${styles.skeletonBlock} ${styles.skeletonPie}`} /></Card>
        <Card><div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} /></Card>
      </div>
    </div>
  );
}

function PrecisionToggle({ value, onChange, disableHourTimeline }: Readonly<{ value: Precision; onChange: (v: Precision) => void; disableHourTimeline?: boolean }>) {
  return (
    <div className={styles.precisionToggle}>
      <button className={`${styles.precisionBtn} ${value === "day" ? styles.precisionBtnActive : ""}`} onClick={() => onChange("day")}>Jour</button>
      <button className={`${styles.precisionBtn} ${value === "hour-timeline" ? styles.precisionBtnActive : ""} ${disableHourTimeline ? styles.precisionBtnDisabled : ""}`} onClick={() => !disableHourTimeline && onChange("hour-timeline")} title={disableHourTimeline ? "Disponible sur 7 et 30 jours uniquement" : undefined}>Heure (timeline)</button>
      <button className={`${styles.precisionBtn} ${value === "hour" ? styles.precisionBtnActive : ""}`} onClick={() => onChange("hour")}>Heure (somme)</button>
    </div>
  );
}

function EvolutionChart({ byDay, byHour, byHourTimeline, precision, color, gradientId, label, formatValue }: Readonly<{ byDay: DailyValue[]; byHour: HourlyValue[]; byHourTimeline: HourlyTimelineValue[]; precision: Precision; color: string; gradientId: string; label: string; formatValue?: (v: number) => string }>) {
  const tooltipStyle = { background: "#2b2d31", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#dcdee1" };
  const tooltipFmt = formatValue ? (v: unknown) => [formatValue(v as number), label] as [string, string] : undefined;

  if (precision === "day") {
    if (byDay.length === 0) return <Empty />;
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={byDay.map((d) => ({ ...d, date: fmtDate(d.date) }))}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fill: "#80848e", fontSize: 11 }} />
          <YAxis tick={{ fill: "#80848e", fontSize: 11 }} allowDecimals={false} tickFormatter={formatValue} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#b5bac1" }} formatter={tooltipFmt} />
          <Area type="monotone" dataKey="value" name={label} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (precision === "hour-timeline") {
    if (byHourTimeline.length === 0) return <Empty />;
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={byHourTimeline.map((d) => ({ ...d, datetime: fmtDatetime(d.datetime) }))}>
          <defs><linearGradient id={`${gradientId}Ht`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="datetime" tick={{ fill: "#80848e", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#80848e", fontSize: 11 }} allowDecimals={false} tickFormatter={formatValue} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#b5bac1" }} formatter={tooltipFmt} />
          <Area type="monotone" dataKey="value" name={label} stroke={color} fill={`url(#${gradientId}Ht)`} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (!byHour.some((h) => h.value > 0)) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={byHour.map((h) => ({ ...h, hour: fmtHour(h.hour) }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="hour" tick={{ fill: "#80848e", fontSize: 10 }} interval={1} />
        <YAxis tick={{ fill: "#80848e", fontSize: 11 }} allowDecimals={false} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={tooltipFmt}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar
          dataKey="value"
          name={label}
          fill={color}
          activeBar={{ fill: color, fillOpacity: 0.9, stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          radius={[3, 3, 0, 0]}
          isAnimationActive
          animationDuration={500}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function UserTable({ rows, formatValue }: Readonly<{ rows: UserValue[]; formatValue: (v: number) => string }>) {
  const [tooltip, setTooltip] = useState<{ userID: string; x: number; y: number } | null>(null);

  function openTooltip(target: HTMLElement, userID: string) {
    const rect = target.getBoundingClientRect();
    setTooltip({
      userID,
      x: rect.left,
      y: rect.bottom + 6,
    });
  }

  if (rows.length === 0) return <Empty />;
  return (
    <div className={styles.tableShell}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thRank}>#</th>
            <th className={styles.thUser}>Utilisateur</th>
            <th className={styles.thValue}>Valeur</th>
          </tr>
        </thead>
      </table>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <tbody>
            {rows.map((r, i) => {
              const name = r.displayName || r.username || r.userID;
              return (
                <tr key={r.userID} className={styles.tr}>
                  <td className={styles.tdRank}>{i + 1}</td>
                  <td className={styles.tdUser}>
                    <div className={styles.userCell}>
                      {r.avatarURL ? <img src={r.avatarURL} alt="" className={styles.userAvatar} /> : <span className={styles.userAvatarFallback}>{name.slice(0, 2).toUpperCase()}</span>}
                      <span
                        className={styles.userName}
                        onMouseEnter={(e) => openTooltip(e.currentTarget, r.userID)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span className={styles.userNameText}>{name}</span>
                      </span>
                    </div>
                  </td>
                  <td className={styles.tdValue}>{formatValue(r.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tooltip && (
        <span className={`${styles.userIDTooltip} ${styles.userIDTooltipFloating}`} style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.userID}
        </span>
      )}
    </div>
  );
}

function ChannelPie({ data, formatValue = (v) => `${v}` }: Readonly<{ data: { name: string; value: number }[]; formatValue?: (v: number) => string }>) {
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(new Set());

  if (data.length === 0) return <Empty />;
  const top = data.slice(0, 10);
  const visible = top
    .filter((entry) => !hiddenNames.has(entry.name))
    .map((entry) => ({
      ...entry,
      fill: CHART_COLORS[top.findIndex((candidate) => candidate.name === entry.name) % CHART_COLORS.length],
    }));

  function toggleName(name: string) {
    setHiddenNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const total = visible.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className={styles.pieCard}>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={visible}
            dataKey="value"
            nameKey="name"
            fill="#5865f2"
            cx="50%"
            cy="50%"
            innerRadius={54}
            outerRadius={118}
            paddingAngle={2}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload as { name: string; value: number } | undefined;
              if (!item) return null;
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div
                  style={{
                    background: "#2b2d31",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "#dcdee1",
                    padding: "10px 12px",
                    boxShadow: "0 10px 26px rgba(0,0,0,0.22)",
                  }}
                >
                  <div style={{ color: "#f2f3f5", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{item.name}</div>
                  <div style={{ color: "#b5bac1", fontSize: 12 }}>{formatValue(item.value)}</div>
                  <div style={{ color: "#b5bac1", fontSize: 12 }}>{percentage.toFixed(1)}%</div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.pieLegend}>
        {top.map((entry, index) => {
          const hidden = hiddenNames.has(entry.name);
          return (
            <button
              key={entry.name}
              type="button"
              className={`${styles.pieLegendItem} ${hidden ? styles.pieLegendItemHidden : ""}`}
              onClick={() => toggleName(entry.name)}
              title={hidden ? `Afficher ${entry.name}` : `Masquer ${entry.name}`}
            >
              <span
                className={styles.pieLegendSwatch}
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className={styles.pieLegendLabel}>{entry.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatsPageContent() {
  const searchParams = useSearchParams();
  const [selectedGuildID, setSelectedGuildID] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [presetIdx, setPresetIdx] = useState(0);
  const [msgPrecision, setMsgPrecision] = useState<Precision>("day");
  const [voicePrecision, setVoicePrecision] = useState<Precision>("day");
  const [stats, setStats] = useState<StatsData>(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const statsRequestRef = useRef(0);
  const hasLoadedStatsRef = useRef(false);
  const guildFromQuery = searchParams.get("guild");

  const { start, end } = useMemo(() => {
    const days = PRESETS[presetIdx].days;
    const end = Date.now();
    return { start: end - days * 86400000, end };
  }, [presetIdx]);

  const channelNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of channels) m.set(c.channelID, c.channelName);
    return m;
  }, [channels]);

  useEffect(() => {
    fetchGuilds().then((gs) => {
      if (guildFromQuery && gs.some((guild) => guild.guildID === guildFromQuery)) {
        setSelectedGuildID(guildFromQuery);
      } else if (gs.length > 0) {
        setSelectedGuildID(gs[0].guildID);
      }
      else setLoadingStats(false);
    });
  }, [guildFromQuery]);

  useEffect(() => {
    if (guildFromQuery && guildFromQuery !== selectedGuildID) {
      setSelectedGuildID(guildFromQuery);
    }
  }, [guildFromQuery, selectedGuildID]);

  useEffect(() => {
    if (!selectedGuildID) return;
    fetchChannels(selectedGuildID).then(setChannels).catch(() => setChannels([]));
  }, [selectedGuildID]);

  useEffect(() => {
    if (!selectedGuildID) return;

    const requestId = statsRequestRef.current + 1;
    statsRequestRef.current = requestId;
    setStatsError(null);

    if (hasLoadedStatsRef.current) setIsRefreshing(true);
    else setLoadingStats(true);

    Promise.all([
      fetchMessagesByDay(selectedGuildID, start, end),
      fetchMessagesByHour(selectedGuildID, start, end),
      fetchMessagesByHourTimeline(selectedGuildID, start, end),
      fetchMessagesByChannel(selectedGuildID, start, end),
      fetchMessagesByUser(selectedGuildID, start, end),
      fetchVoiceByDay(selectedGuildID, start, end),
      fetchVoiceByHour(selectedGuildID, start, end),
      fetchVoiceByHourTimeline(selectedGuildID, start, end),
      fetchVoiceByChannel(selectedGuildID, start, end),
      fetchVoiceByUser(selectedGuildID, start, end),
    ])
      .then(([mDay, mHour, mHourTl, mChan, mUser, vDay, vHour, vHourTl, vChan, vUser]) => {
        if (statsRequestRef.current !== requestId) return;
        setStats({
          msgByDay: mDay,
          msgByHour: mHour,
          msgByHourTimeline: mHourTl,
          msgByChannel: mChan,
          msgByUser: mUser,
          voiceByDay: vDay,
          voiceByHour: vHour,
          voiceByHourTimeline: vHourTl,
          voiceByChannel: vChan,
          voiceByUser: vUser,
        });
        hasLoadedStatsRef.current = true;
      })
      .catch(() => {
        if (statsRequestRef.current !== requestId) return;
        setStatsError("Impossible de charger les statistiques.");
      })
      .finally(() => {
        if (statsRequestRef.current !== requestId) return;
        setLoadingStats(false);
        setIsRefreshing(false);
      });
  }, [selectedGuildID, start, end, refreshKey]);

  const msgPieData = stats.msgByChannel.map((c) => ({ name: c.channelName ?? channelNames.get(c.channelID) ?? c.channelID, value: c.value }));
  const voicePieData = stats.voiceByChannel.map((c) => ({ name: c.channelName ?? channelNames.get(c.channelID) ?? c.channelID, value: c.value }));
  const showInitialSkeleton = loadingStats && !hasLoadedStatsRef.current;
  const refreshDisabled = loadingStats || isRefreshing;

  function handleRefresh() {
    if (refreshDisabled) return;
    setRefreshKey((k) => k + 1);
  }

  const pageContent = useMemo(() => {
    if (statsError && !hasLoadedStatsRef.current) {
      return (
        <div className={styles.fullLoading}>
          <div className={styles.error}>Impossible de charger les statistiques.</div>
        </div>
      );
    }
    if (showInitialSkeleton) {
      return <StatsSkeleton />;
    }
    return (
      <div className={`${styles.content} ${isRefreshing ? styles.contentRefreshing : ""}`}>
        {statsError && <div className={styles.errorBanner}>{statsError}</div>}

        <SectionTitle>Messages</SectionTitle>
        <div className={styles.row}>
          <Card wide>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Évolution</span>
              <PrecisionToggle value={msgPrecision} onChange={setMsgPrecision} disableHourTimeline={presetIdx === 2} />
            </div>
            <EvolutionChart byDay={stats.msgByDay} byHour={stats.msgByHour} byHourTimeline={stats.msgByHourTimeline} precision={msgPrecision} color="#5865f2" gradientId="msgGrad" label="Messages" />
          </Card>
        </div>
        <div className={styles.row}>
          <Card><p className={styles.cardTitle}>Salons les plus actifs</p><ChannelPie data={msgPieData} formatValue={(v) => `${v}`} /></Card>
          <Card><p className={styles.cardTitle}>Classement des membres</p><UserTable rows={stats.msgByUser} formatValue={(v) => `${v}`} /></Card>
        </div>

        <SectionTitle>Vocal</SectionTitle>
        <div className={styles.row}>
          <Card wide>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Évolution</span>
              <PrecisionToggle value={voicePrecision} onChange={setVoicePrecision} disableHourTimeline={presetIdx === 2} />
            </div>
            <EvolutionChart byDay={stats.voiceByDay} byHour={stats.voiceByHour} byHourTimeline={stats.voiceByHourTimeline} precision={voicePrecision} color="#23a55a" gradientId="voiceGrad" label="Temps vocal" formatValue={fmtSecs} />
          </Card>
        </div>
        <div className={styles.row}>
          <Card><p className={styles.cardTitle}>Salons vocaux les plus utilisés</p><ChannelPie data={voicePieData} formatValue={fmtSecs} /></Card>
          <Card><p className={styles.cardTitle}>Classement des membres (vocal)</p><UserTable rows={stats.voiceByUser} formatValue={fmtSecs} /></Card>
        </div>
      </div>
    );
  }, [statsError, showInitialSkeleton, isRefreshing, msgPrecision, voicePrecision, presetIdx, stats, msgPieData, voicePieData]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Activité</h1>
        </div>
        <div className={styles.controls}>
          <div className={styles.presetButtons}>
            {PRESETS.map((p, i) => (
              <button key={i} className={`${styles.presetBtn} ${presetIdx === i ? styles.presetBtnActive : ""}`} onClick={() => setPresetIdx(i)}>{p.label}</button>
            ))}
          </div>
          <button
            className={`${styles.refreshBtn} ${refreshDisabled ? styles.refreshBtnDisabled : ""}`}
            onClick={handleRefresh}
            aria-disabled={refreshDisabled}
            title="Rafraîchir les statistiques"
          >
            <svg className={`${styles.refreshIcon} ${isRefreshing ? styles.spinning : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Rafraîchir
          </button>
        </div>
      </div>

      {pageContent}
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={null}>
      <StatsPageContent />
    </Suspense>
  );
}
