"use client";

import styles from "@/app/stats/Stats.module.css";
import type { MemberOverview, StatsOverview, UserValue } from "@/lib/api-stats";
import { useState } from "react";
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
import {
  CHART_COLORS,
  MEMBER_SERIES_COLORS,
  SERIES_COLORS,
  fmtCompactCount,
  fmtDate,
  fmtDatetime,
  fmtHour,
} from "./stats.utils";
import type {
  ActivitySeriesKey,
  ActivityTooltipEntry,
  ChartDatum,
  MemberSeriesKey,
  Precision,
} from "./types";

type ActivityPoint = {
  label: string;
  total: number;
  uniqueUsers: number;
  uniqueChannels: number;
};

type MemberPoint = {
  label: string;
  total: number;
  joined: number;
  left: number;
};

function Empty() {
  return <div className={styles.empty}>Aucune donnée sur cette période</div>;
}

export function SectionTitle({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

export function Card({
  children,
  wide,
  className,
}: Readonly<{ children: React.ReactNode; wide?: boolean; className?: string }>) {
  return (
    <div className={`${styles.card} ${wide ? styles.cardWide : ""} ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className={styles.content}>
      <SectionTitle>Messages</SectionTitle>
      <div className={styles.row}>
        <Card wide>
          <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} />
        </Card>
      </div>
      <div className={styles.row}>
        <Card>
          <div className={`${styles.skeletonBlock} ${styles.skeletonPie}`} />
        </Card>
        <Card>
          <div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} />
        </Card>
      </div>
      <SectionTitle>Vocal</SectionTitle>
      <div className={styles.row}>
        <Card wide>
          <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} />
        </Card>
      </div>
      <div className={styles.row}>
        <Card>
          <div className={`${styles.skeletonBlock} ${styles.skeletonPie}`} />
        </Card>
        <Card>
          <div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} />
        </Card>
      </div>
      <SectionTitle>Membres</SectionTitle>
      <div className={styles.row}>
        <Card wide>
          <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} />
        </Card>
      </div>
    </div>
  );
}

export function PrecisionToggle({
  value,
  onChange,
  disableHourTimeline,
}: Readonly<{
  value: Precision;
  onChange: (value: Precision) => void;
  disableHourTimeline?: boolean;
}>) {
  return (
    <div className={styles.precisionToggle}>
      {[
        { value: "day", label: "Jour" },
        {
          value: "hour-timeline",
          label: "Heure (timeline)",
          disabled: disableHourTimeline,
          title: disableHourTimeline
            ? "Disponible sur 7 et 30 jours uniquement"
            : undefined,
        },
        { value: "hour", label: "Heure (somme)" },
      ].map((option) => (
        <button
          key={option.value}
          className={`${styles.precisionBtn} ${value === option.value ? styles.precisionBtnActive : ""} ${option.disabled ? styles.precisionBtnDisabled : ""}`}
          onClick={() =>
            !option.disabled && onChange(option.value as Precision)
          }
          disabled={option.disabled}
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  hidden,
  onClick,
}: Readonly<{
  label: string;
  value: string;
  color: string;
  hidden?: boolean;
  onClick?: () => void;
}>) {
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
      if (key === "total")
        return {
          label: totalLabel,
          value: totalFormatter(entry.value ?? 0),
          color: entry.color ?? SERIES_COLORS.total,
        };
      if (key === "uniqueUsers")
        return {
          label: "Membres uniques",
          value: fmtCompactCount(entry.value ?? 0),
          color: entry.color ?? SERIES_COLORS.users,
        };
      if (key === "uniqueChannels")
        return {
          label: "Salons uniques",
          value: fmtCompactCount(entry.value ?? 0),
          color: entry.color ?? SERIES_COLORS.channels,
        };
      return null;
    })
    .filter(
      (entry): entry is { label: string; value: string; color: string } =>
        entry !== null,
    );

  if (rows.length === 0) return null;

  return (
    <div className={styles.activityTooltip}>
      <div className={styles.activityTooltipLabel}>{label}</div>
      <div className={styles.activityTooltipRows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.activityTooltipRow}>
            <div className={styles.activityTooltipSeries}>
              <span
                className={styles.activityTooltipDot}
                style={{ backgroundColor: row.color }}
              />
              <span>{row.label}</span>
            </div>
            <strong className={styles.activityTooltipValue}>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityChart({
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
  const [hiddenSeries, setHiddenSeries] = useState<Set<ActivitySeriesKey>>(
    new Set(),
  );
  const data: ActivityPoint[] =
    precision === "day"
      ? overview.byDay.map((item) => ({
          label: fmtDate(item.date),
          total: item.total,
          uniqueUsers: item.uniqueUsers,
          uniqueChannels: item.uniqueChannels,
        }))
      : precision === "hour-timeline"
        ? overview.byHourTimeline.map((item) => ({
            label: fmtDatetime(item.datetime),
            total: item.total,
            uniqueUsers: item.uniqueUsers,
            uniqueChannels: item.uniqueChannels,
          }))
        : overview.byHour.map((item) => ({
            label: fmtHour(item.hour),
            total: item.total,
            uniqueUsers: item.uniqueUsers,
            uniqueChannels: item.uniqueChannels,
          }));

  const hasActivity = data.some(
    (item) => item.total > 0 || item.uniqueUsers > 0 || item.uniqueChannels > 0,
  );
  if (!hasActivity) return <Empty />;

  const showTotal = !hiddenSeries.has("total");
  const showUsers = !hiddenSeries.has("uniqueUsers");
  const showChannels = !hiddenSeries.has("uniqueChannels");
  const showCountAxis = showUsers || showChannels;

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
        <MetricCard
          label={totalLabel}
          value={totalFormatter(overview.summary.total)}
          color={SERIES_COLORS.total}
          hidden={!showTotal}
          onClick={() => toggleSeries("total")}
        />
        <MetricCard
          label="Membres uniques"
          value={fmtCompactCount(overview.summary.uniqueUsers)}
          color={SERIES_COLORS.users}
          hidden={!showUsers}
          onClick={() => toggleSeries("uniqueUsers")}
        />
        <MetricCard
          label="Salons uniques"
          value={fmtCompactCount(overview.summary.uniqueChannels)}
          color={SERIES_COLORS.channels}
          hidden={!showChannels}
          onClick={() => toggleSeries("uniqueChannels")}
        />
      </div>
      {precision === "hour" ? (
        <div className={styles.chartViewport}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 0, left: -12, bottom: 0 }}
            barGap={6}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#80848e", fontSize: 10 }}
              interval={1}
            />
            {showTotal ? (
              <YAxis
                yAxisId="total"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={totalFormatter}
                width={38}
              />
            ) : null}
            {showCountAxis ? (
              <YAxis
                yAxisId="counts"
                orientation="right"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={30}
              />
            ) : null}
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={(props) => (
                <ActivityTooltip
                  active={props.active}
                  label={
                    typeof props.label === "string" ? props.label : undefined
                  }
                  payload={
                    props.payload as readonly ActivityTooltipEntry[] | undefined
                  }
                  totalLabel={totalLabel}
                  totalFormatter={totalFormatter}
                />
              )}
            />
            {showTotal ? (
              <Bar
                yAxisId="total"
                dataKey="total"
                fill={SERIES_COLORS.total}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            ) : null}
            {showUsers ? (
              <Bar
                yAxisId="counts"
                dataKey="uniqueUsers"
                fill={SERIES_COLORS.users}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            ) : null}
            {showChannels ? (
              <Bar
                yAxisId="counts"
                dataKey="uniqueChannels"
                fill={SERIES_COLORS.channels}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className={styles.chartViewport}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 0, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: "#80848e",
                fontSize: precision === "hour-timeline" ? 10 : 11,
              }}
              interval={precision === "hour-timeline" ? "preserveStartEnd" : 0}
              minTickGap={20}
            />
            {showTotal ? (
              <YAxis
                yAxisId="total"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={totalFormatter}
                width={38}
              />
            ) : null}
            {showCountAxis ? (
              <YAxis
                yAxisId="counts"
                orientation="right"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={30}
              />
            ) : null}
            <Tooltip
              content={(props) => (
                <ActivityTooltip
                  active={props.active}
                  label={
                    typeof props.label === "string" ? props.label : undefined
                  }
                  payload={
                    props.payload as readonly ActivityTooltipEntry[] | undefined
                  }
                  totalLabel={totalLabel}
                  totalFormatter={totalFormatter}
                />
              )}
            />
            {showTotal ? (
              <Line
                yAxisId="total"
                type="monotone"
                dataKey="total"
                stroke={SERIES_COLORS.total}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            ) : null}
            {showUsers ? (
              <Line
                yAxisId="counts"
                type="monotone"
                dataKey="uniqueUsers"
                stroke={SERIES_COLORS.users}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            ) : null}
            {showChannels ? (
              <Line
                yAxisId="counts"
                type="monotone"
                dataKey="uniqueChannels"
                stroke={SERIES_COLORS.channels}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MemberTooltip({
  active,
  label,
  payload,
  hideTotal,
}: Readonly<{
  active?: boolean;
  label?: string;
  payload?: readonly ActivityTooltipEntry[];
  hideTotal?: boolean;
}>) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((entry) => {
      const key = String(entry.dataKey ?? "");
      if (key === "total" && hideTotal) return null;
      const labels: Record<string, string> = {
        total: "Total membres",
        joined: "Arrivées",
        left: "Départs",
      };
      const colors: Record<string, string> = MEMBER_SERIES_COLORS;
      if (!(key in labels)) return null;
      return {
        label: labels[key],
        value: fmtCompactCount(entry.value ?? 0),
        color: colors[key],
      };
    })
    .filter(
      (entry): entry is { label: string; value: string; color: string } =>
        entry !== null,
    );

  if (rows.length === 0) return null;

  return (
    <div className={styles.activityTooltip}>
      <div className={styles.activityTooltipLabel}>{label}</div>
      <div className={styles.activityTooltipRows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.activityTooltipRow}>
            <div className={styles.activityTooltipSeries}>
              <span
                className={styles.activityTooltipDot}
                style={{ backgroundColor: row.color }}
              />
              <span>{row.label}</span>
            </div>
            <strong className={styles.activityTooltipValue}>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemberChart({
  overview,
  precision,
}: Readonly<{ overview: MemberOverview; precision: Precision }>) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<MemberSeriesKey>>(
    new Set(),
  );
  const data: MemberPoint[] =
    precision === "day"
      ? overview.byDay.map((item) => ({
          label: fmtDate(item.date),
          total: item.total,
          joined: item.joined,
          left: item.left,
        }))
      : precision === "hour-timeline"
        ? overview.byHourTimeline.map((item) => ({
            label: fmtDatetime(item.datetime),
            total: item.total,
            joined: item.joined,
            left: item.left,
          }))
        : overview.byHour.map((item) => ({
            label: fmtHour(item.hour),
            total: 0,
            joined: item.joined,
            left: item.left,
          }));

  const hasActivity = data.some((item) => item.joined > 0 || item.left > 0);
  if (!hasActivity) return <Empty />;

  const showTotal = !hiddenSeries.has("total");
  const showJoined = !hiddenSeries.has("joined");
  const showLeft = !hiddenSeries.has("left");

  function toggleSeries(key: MemberSeriesKey) {
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
        <MetricCard
          label="Total membres"
          value={fmtCompactCount(overview.summary.total)}
          color={MEMBER_SERIES_COLORS.total}
          hidden={!showTotal}
          onClick={() => toggleSeries("total")}
        />
        <MetricCard
          label="Arrivées"
          value={fmtCompactCount(overview.summary.joined)}
          color={MEMBER_SERIES_COLORS.joined}
          hidden={!showJoined}
          onClick={() => toggleSeries("joined")}
        />
        <MetricCard
          label="Départs"
          value={fmtCompactCount(overview.summary.left)}
          color={MEMBER_SERIES_COLORS.left}
          hidden={!showLeft}
          onClick={() => toggleSeries("left")}
        />
      </div>
      {precision === "hour" ? (
        <div className={styles.chartViewport}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 0, left: -12, bottom: 0 }}
            barGap={6}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#80848e", fontSize: 10 }}
              interval={1}
            />
            {showTotal ? (
              <YAxis
                yAxisId="total"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={38}
              />
            ) : null}
            {showJoined || showLeft ? (
              <YAxis
                yAxisId="counts"
                orientation="right"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={30}
              />
            ) : null}
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={(props) => (
                <MemberTooltip
                  active={props.active}
                  label={
                    typeof props.label === "string" ? props.label : undefined
                  }
                  payload={
                    props.payload as readonly ActivityTooltipEntry[] | undefined
                  }
                  hideTotal
                />
              )}
            />
            {showTotal ? (
              <Bar
                yAxisId="total"
                dataKey="total"
                fill={MEMBER_SERIES_COLORS.total}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            ) : null}
            {showJoined ? (
              <Bar
                yAxisId="counts"
                dataKey="joined"
                fill={MEMBER_SERIES_COLORS.joined}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            ) : null}
            {showLeft ? (
              <Bar
                yAxisId="counts"
                dataKey="left"
                fill={MEMBER_SERIES_COLORS.left}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className={styles.chartViewport}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 0, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: "#80848e",
                fontSize: precision === "hour-timeline" ? 10 : 11,
              }}
              interval={precision === "hour-timeline" ? "preserveStartEnd" : 0}
              minTickGap={20}
            />
            {showTotal ? (
              <YAxis
                yAxisId="total"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={38}
              />
            ) : null}
            {showJoined || showLeft ? (
              <YAxis
                yAxisId="counts"
                orientation="right"
                tick={{ fill: "#80848e", fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={fmtCompactCount}
                width={30}
              />
            ) : null}
            <Tooltip
              content={(props) => (
                <MemberTooltip
                  active={props.active}
                  label={
                    typeof props.label === "string" ? props.label : undefined
                  }
                  payload={
                    props.payload as readonly ActivityTooltipEntry[] | undefined
                  }
                />
              )}
            />
            {showTotal ? (
              <Line
                yAxisId="total"
                type="monotone"
                dataKey="total"
                stroke={MEMBER_SERIES_COLORS.total}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            ) : null}
            {showJoined ? (
              <Line
                yAxisId="counts"
                type="monotone"
                dataKey="joined"
                stroke={MEMBER_SERIES_COLORS.joined}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            ) : null}
            {showLeft ? (
              <Line
                yAxisId="counts"
                type="monotone"
                dataKey="left"
                stroke={MEMBER_SERIES_COLORS.left}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function UserTable({
  rows,
  formatValue,
}: Readonly<{ rows: UserValue[]; formatValue: (value: number) => string }>) {
  const [tooltip, setTooltip] = useState<{
    userID: string;
    x: number;
    y: number;
  } | null>(null);
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
            {rows.map((row, index) => {
              const name = row.displayName || row.username || row.userID;
              return (
                <tr key={row.userID} className={styles.tr}>
                  <td className={styles.tdRank}>{index + 1}</td>
                  <td className={styles.tdUser}>
                    <div className={styles.userCell}>
                      {row.avatarURL ? (
                        <img
                          src={row.avatarURL}
                          alt=""
                          className={styles.userAvatar}
                        />
                      ) : (
                        <span className={styles.userAvatarFallback}>
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span
                        className={styles.userName}
                        onMouseEnter={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setTooltip({
                            userID: row.userID,
                            x: rect.left,
                            y: rect.bottom + 6,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span className={styles.userNameText}>{name}</span>
                      </span>
                    </div>
                  </td>
                  <td className={styles.tdValue}>{formatValue(row.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tooltip ? (
        <span
          className={`${styles.userIDTooltip} ${styles.userIDTooltipFloating}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.userID}
        </span>
      ) : null}
    </div>
  );
}

export function ChannelPie({
  data,
  formatValue = (value) => `${value}`,
}: Readonly<{
  data: ChartDatum[];
  formatValue?: (value: number) => string;
}>) {
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"pie" | "list">("pie");
  if (data.length === 0) return <Empty />;

  const visible = data
    .filter((entry) => !hiddenNames.has(entry.name))
    .map((entry) => ({
      ...entry,
      fill: CHART_COLORS[
        data.findIndex((candidate) => candidate.name === entry.name) %
          CHART_COLORS.length
      ],
    }));
  const total = visible.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className={styles.pieCard}>
      <div className={styles.pieViewToggle}>
        <div className={styles.precisionToggle}>
          {[
            { value: "pie", label: "Donut" },
            { value: "list", label: "Liste" },
          ].map((option) => (
            <button
              key={option.value}
              className={`${styles.precisionBtn} ${mode === option.value ? styles.precisionBtnActive : ""}`}
              onClick={() => setMode(option.value as "pie" | "list")}
            >
              {option.label}
            </button>
          ))}
        </div>
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
                  const item = payload[0]?.payload as
                    | { name: string; value: number }
                    | undefined;
                  if (!item) return null;
                  const percentage = total > 0 ? (item.value / total) * 100 : 0;
                  return (
                    <div className={styles.activityTooltip}>
                      <div className={styles.activityTooltipLabel}>
                        {item.name}
                      </div>
                      <div className={styles.activityTooltipRows}>
                        <div className={styles.activityTooltipRow}>
                          <span>{formatValue(item.value)}</span>
                        </div>
                        <div className={styles.activityTooltipRow}>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
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
                  onClick={() => {
                    setHiddenNames((prev) => {
                      const next = new Set(prev);
                      if (next.has(entry.name)) next.delete(entry.name);
                      else next.add(entry.name);
                      return next;
                    });
                  }}
                  title={
                    hidden ? `Afficher ${entry.name}` : `Masquer ${entry.name}`
                  }
                >
                  <span
                    className={styles.pieLegendSwatch}
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
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
                      <span
                        className={styles.channelSwatch}
                        style={{
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span className={styles.channelName}>{entry.name}</span>
                    </td>
                    <td className={styles.tdValue}>
                      {formatValue(entry.value)}
                    </td>
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
