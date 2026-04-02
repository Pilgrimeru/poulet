"use client";

import { fetchChannels, fetchGuilds } from "@/lib/api-client";
import {
  fetchMessagesByChannel,
  fetchMessagesByUser,
  fetchMessagesOverview,
  fetchVoiceByChannel,
  fetchVoiceByUser,
  fetchVoiceOverview,
  type ChannelValue,
  type StatsOverview,
  type UserValue,
} from "@/lib/api-stats";
import type { ChannelEntry } from "@/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./Stats.module.css";

type Precision = "day" | "hour-timeline" | "hour";
type ActivityPoint = {
  label: string;
  total: number;
  uniqueUsers: number;
  uniqueChannels: number;
};
type ActivitySeriesKey = "total" | "uniqueUsers" | "uniqueChannels";
type ActivityTooltipEntry = {
  dataKey?: string | number;
  color?: string;
  value?: number;
};

type StatsData = {
  msgOverview: StatsOverview;
  msgByChannel: ChannelValue[];
  msgByUser: UserValue[];
  voiceOverview: StatsOverview;
  voiceByChannel: ChannelValue[];
  voiceByUser: UserValue[];
};

const EMPTY_OVERVIEW: StatsOverview = {
  summary: { total: 0, uniqueUsers: 0, uniqueChannels: 0 },
  byDay: [],
  byHour: [],
  byHourTimeline: [],
};

const EMPTY_STATS: StatsData = {
  msgOverview: EMPTY_OVERVIEW,
  msgByChannel: [],
  msgByUser: [],
  voiceOverview: EMPTY_OVERVIEW,
  voiceByChannel: [],
  voiceByUser: [],
};

const CHART_COLORS = [
  "#5865f2", "#ed4245", "#faa61a", "#23a55a", "#00a8fc",
  "#eb459e", "#57f287", "#fee75c", "#9b59b6", "#1abc9c",
];

const SERIES_COLORS = {
  total: "#38d26b",
  users: "#8d6bff",
  channels: "#ff4f9a",
};

const PRESETS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
];

const CHILD_TYPES = new Set([11, 12]);

function groupChannelData(channels: ChannelValue[]): { name: string; value: number }[] {
  const grouped = new Map<string, number>();

  for (const c of channels) {
    const isChild = (c.channelType != null && CHILD_TYPES.has(c.channelType)) ||
      (c.parentID != null && c.channelType != null && CHILD_TYPES.has(c.channelType));
    const parentIsForumOrMedia = c.parentID != null;
    const useParent = isChild && parentIsForumOrMedia && c.parentName;

    const key = useParent ? (c.parentName ?? c.channelName ?? c.channelID) : (c.channelName ?? c.channelID);
    grouped.set(key, (grouped.get(key) ?? 0) + c.value);
  }

  const sorted = Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= 10) return sorted;

  const top9 = sorted.slice(0, 9);
  const rest = sorted.slice(9);
  const othersValue = rest.reduce((sum, e) => sum + e.value, 0);
  return [...top9, { name: "Autres", value: othersValue }];
}

function fmtSecs(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtCompactCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
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

function MetricCard({ label, value, color, hidden, onClick }: Readonly<{ label: string; value: string; color: string; hidden?: boolean; onClick?: () => void }>) {
  return (
    <div 
      className={`${styles.metricCard} ${hidden ? styles.metricCardHidden : ""} ${onClick ? styles.metricCardClickable : ""}`} 
      style={{ "--metric-color": color } as React.CSSProperties}
      onClick={onClick}
    >
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
    </div>
  );
}

function ActivityTooltip({
  active,
  label,
  payload,
  totalLabel,
  totalFormatter,
}: Readonly<{
  active?: boolean;
  label?: string;
  payload?: readonly ActivityTooltipEntry[];
  totalLabel: string;
  totalFormatter: (value: number) => string;
}>) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((entry) => {
      const key = String(entry.dataKey ?? "");
      if (key === "total") {
        return {
          label: totalLabel,
          value: totalFormatter(entry.value ?? 0),
          color: entry.color ?? SERIES_COLORS.total,
        };
      }
      if (key === "uniqueUsers") {
        return {
          label: "Membres uniques",
          value: fmtCompactCount(entry.value ?? 0),
          color: entry.color ?? SERIES_COLORS.users,
        };
      }
      if (key === "uniqueChannels") {
        return {
          label: "Salons uniques",
          value: fmtCompactCount(entry.value ?? 0),
          color: entry.color ?? SERIES_COLORS.channels,
        };
      }
      return null;
    })
    .filter((entry): entry is { label: string; value: string; color: string } => entry !== null);

  if (rows.length === 0) return null;

  return (
    <div className={styles.activityTooltip}>
      <div className={styles.activityTooltipLabel}>{label}</div>
      <div className={styles.activityTooltipRows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.activityTooltipRow}>
            <div className={styles.activityTooltipSeries}>
              <span className={styles.activityTooltipDot} style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </div>
            <strong className={styles.activityTooltipValue}>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityChart({
  overview,
  precision,
  totalLabel,
  totalFormatter = fmtCompactCount,
}: Readonly<{
  overview: StatsOverview;
  precision: Precision;
  totalLabel: string;
  totalFormatter?: (value: number) => string;
}>) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<ActivitySeriesKey>>(new Set());
  const data: ActivityPoint[] = precision === "day"
    ? overview.byDay.map((item) => ({ ...item, label: fmtDate(item.date) }))
    : precision === "hour-timeline"
      ? overview.byHourTimeline.map((item) => ({ ...item, label: fmtDatetime(item.datetime) }))
      : overview.byHour.map((item) => ({ ...item, label: fmtHour(item.hour) }));

  const hasActivity = data.some((item) => item.total > 0 || item.uniqueUsers > 0 || item.uniqueChannels > 0);
  const showTotal = !hiddenSeries.has("total");
  const showUsers = !hiddenSeries.has("uniqueUsers");
  const showChannels = !hiddenSeries.has("uniqueChannels");
  const showCountAxis = showUsers || showChannels;

  if (!hasActivity) return <Empty />;

  function toggleSeries(key: ActivitySeriesKey) {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={styles.activityChartShell}>
      <div className={styles.metricGrid}>
        <MetricCard label={totalLabel} value={totalFormatter(overview.summary.total)} color={SERIES_COLORS.total} hidden={!showTotal} onClick={() => toggleSeries("total")} />
        <MetricCard label="Membres uniques" value={fmtCompactCount(overview.summary.uniqueUsers)} color={SERIES_COLORS.users} hidden={!showUsers} onClick={() => toggleSeries("uniqueUsers")} />
        <MetricCard label="Salons uniques" value={fmtCompactCount(overview.summary.uniqueChannels)} color={SERIES_COLORS.channels} hidden={!showChannels} onClick={() => toggleSeries("uniqueChannels")} />
      </div>
      <div className={styles.seriesToggleRow}>
        <button type="button" className={`${styles.seriesToggleBtn} ${!showTotal ? styles.seriesToggleBtnHidden : ""}`} onClick={() => toggleSeries("total")}>
          <span className={styles.seriesToggleSwatch} style={{ backgroundColor: SERIES_COLORS.total }} />
          {totalLabel}
        </button>
        <button type="button" className={`${styles.seriesToggleBtn} ${!showUsers ? styles.seriesToggleBtnHidden : ""}`} onClick={() => toggleSeries("uniqueUsers")}>
          <span className={styles.seriesToggleSwatch} style={{ backgroundColor: SERIES_COLORS.users }} />
          Membres uniques
        </button>
        <button type="button" className={`${styles.seriesToggleBtn} ${!showChannels ? styles.seriesToggleBtnHidden : ""}`} onClick={() => toggleSeries("uniqueChannels")}>
          <span className={styles.seriesToggleSwatch} style={{ backgroundColor: SERIES_COLORS.channels }} />
          Salons uniques
        </button>
      </div>

      {precision === "hour" ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }} barGap={6} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: "#80848e", fontSize: 10 }} interval={1} />
            {showTotal && (
              <YAxis
                yAxisId="total"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={totalFormatter}
                width={56}
              />
            )}
            {showCountAxis && (
              <YAxis
                yAxisId="counts"
                orientation="right"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={42}
              />
            )}
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={(props) => (
                <ActivityTooltip
                  active={props.active}
                  label={typeof props.label === "string" ? props.label : undefined}
                  payload={props.payload as readonly ActivityTooltipEntry[] | undefined}
                  totalLabel={totalLabel}
                  totalFormatter={totalFormatter}
                />
              )}
            />
            {showTotal && <Bar yAxisId="total" dataKey="total" name={totalLabel} fill={SERIES_COLORS.total} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500} animationEasing="ease-out" />}
            {showUsers && <Bar yAxisId="counts" dataKey="uniqueUsers" name="Membres uniques" fill={SERIES_COLORS.users} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500} animationEasing="ease-out" />}
            {showChannels && <Bar yAxisId="counts" dataKey="uniqueChannels" name="Salons uniques" fill={SERIES_COLORS.channels} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500} animationEasing="ease-out" />}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#80848e", fontSize: precision === "hour-timeline" ? 10 : 11 }}
              interval={precision === "hour-timeline" ? "preserveStartEnd" : 0}
              minTickGap={20}
            />
            {showTotal && (
              <YAxis
                yAxisId="total"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={totalFormatter}
                width={56}
              />
            )}
            {showCountAxis && (
              <YAxis
                yAxisId="counts"
                orientation="right"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={42}
              />
            )}
            <Tooltip
              content={(props) => (
                <ActivityTooltip
                  active={props.active}
                  label={typeof props.label === "string" ? props.label : undefined}
                  payload={props.payload as readonly ActivityTooltipEntry[] | undefined}
                  totalLabel={totalLabel}
                  totalFormatter={totalFormatter}
                />
              )}
            />
            {showTotal && <Line yAxisId="total" type="monotone" dataKey="total" name={totalLabel} stroke={SERIES_COLORS.total} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive animationDuration={600} animationEasing="ease-out" />}
            {showUsers && <Line yAxisId="counts" type="monotone" dataKey="uniqueUsers" name="Membres uniques" stroke={SERIES_COLORS.users} strokeWidth={2.4} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={600} animationEasing="ease-out" />}
            {showChannels && <Line yAxisId="counts" type="monotone" dataKey="uniqueChannels" name="Salons uniques" stroke={SERIES_COLORS.channels} strokeWidth={2.4} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={600} animationEasing="ease-out" />}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
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
  const [mode, setMode] = useState<"pie" | "list">("pie");

  if (data.length === 0) return <Empty />;

  const visible = data
    .filter((entry) => !hiddenNames.has(entry.name))
    .map((entry) => ({
      ...entry,
      fill: CHART_COLORS[data.findIndex((candidate) => candidate.name === entry.name) % CHART_COLORS.length],
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
      <div className={styles.pieViewToggle}>
        <button type="button" className={`${styles.precisionBtn} ${mode === "pie" ? styles.precisionBtnActive : ""}`} onClick={() => setMode("pie")}>
          Donut
        </button>
        <button type="button" className={`${styles.precisionBtn} ${mode === "list" ? styles.precisionBtnActive : ""}`} onClick={() => setMode("list")}>
          Liste
        </button>
      </div>

      {mode === "pie" ? (
        <>
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
            {data.map((entry, index) => {
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
        </>
      ) : (
        <div className={styles.tableShell}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thRank}>#</th>
                <th>Salon</th>
                <th className={styles.thValue}>Valeur</th>
              </tr>
            </thead>
          </table>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <tbody>
                {data.map((entry, index) => (
                  <tr key={entry.name} className={styles.tr}>
                    <td className={styles.tdRank}>{index + 1}</td>
                    <td className={styles.tdChannel}>
                      <span className={styles.channelSwatch} style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <span className={styles.channelName}>{entry.name}</span>
                    </td>
                    <td className={styles.tdValue}>{formatValue(entry.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
      fetchMessagesOverview(selectedGuildID, start, end),
      fetchMessagesByChannel(selectedGuildID, start, end),
      fetchMessagesByUser(selectedGuildID, start, end),
      fetchVoiceOverview(selectedGuildID, start, end),
      fetchVoiceByChannel(selectedGuildID, start, end),
      fetchVoiceByUser(selectedGuildID, start, end),
    ])
      .then(([msgOverview, mChan, mUser, voiceOverview, vChan, vUser]) => {
        if (statsRequestRef.current !== requestId) return;
        setStats({
          msgOverview,
          msgByChannel: mChan,
          msgByUser: mUser,
          voiceOverview,
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

  const msgPieData = useMemo(() => groupChannelData(
    stats.msgByChannel.map((c) => ({ ...c, channelName: c.channelName ?? channelNames.get(c.channelID) ?? c.channelID }))
  ), [stats.msgByChannel, channelNames]);
  const voicePieData = useMemo(() => groupChannelData(
    stats.voiceByChannel.map((c) => ({ ...c, channelName: c.channelName ?? channelNames.get(c.channelID) ?? c.channelID }))
  ), [stats.voiceByChannel, channelNames]);
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
              <span className={styles.cardTitle}>Évolution détaillée</span>
              <PrecisionToggle value={msgPrecision} onChange={setMsgPrecision} disableHourTimeline={presetIdx === 2} />
            </div>
            <ActivityChart overview={stats.msgOverview} precision={msgPrecision} totalLabel="Total messages" />
          </Card>
        </div>
        <div className={styles.row}>
          <Card>
            <div className={styles.cardHeader}><span className={styles.cardTitle}>Salons les plus actifs</span></div>
            <ChannelPie data={msgPieData} formatValue={(v) => `${v}`} />
          </Card>
          <Card><p className={styles.cardTitle}>Classement des membres</p><UserTable rows={stats.msgByUser} formatValue={(v) => `${v}`} /></Card>
        </div>

        <SectionTitle>Vocal</SectionTitle>
        <div className={styles.row}>
          <Card wide>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Évolution détaillée</span>
              <PrecisionToggle value={voicePrecision} onChange={setVoicePrecision} disableHourTimeline={presetIdx === 2} />
            </div>
            <ActivityChart overview={stats.voiceOverview} precision={voicePrecision} totalLabel="Temps vocal" totalFormatter={fmtSecs} />
          </Card>
        </div>
        <div className={styles.row}>
          <Card>
            <div className={styles.cardHeader}><span className={styles.cardTitle}>Salons vocaux les plus utilisés</span></div>
            <ChannelPie data={voicePieData} formatValue={fmtSecs} />
          </Card>
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
