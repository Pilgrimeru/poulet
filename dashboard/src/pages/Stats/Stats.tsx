import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchChannels, fetchGuilds } from "../../api/client";
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
} from "../../api/stats";
import type { ChannelEntry, GuildEntry } from "../../types";
import styles from "./Stats.module.css";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const CHART_COLORS = [
  "#5865f2", "#ed4245", "#faa61a", "#23a55a", "#00a8fc",
  "#eb459e", "#57f287", "#fee75c", "#9b59b6", "#1abc9c",
];

// ─── Preset ranges ────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

function Card({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`${styles.card} ${wide ? styles.cardWide : ""}`}>{children}</div>;
}

function Empty() {
  return <div className={styles.empty}>Aucune donnée sur cette période</div>;
}

function Loading() {
  return <div className={styles.empty}>Chargement…</div>;
}

type Precision = "day" | "hour-timeline" | "hour";

interface PrecisionToggleProps {
  value: Precision;
  onChange: (v: Precision) => void;
  disableHourTimeline?: boolean;
}

function PrecisionToggle({ value, onChange, disableHourTimeline }: PrecisionToggleProps) {
  return (
    <div className={styles.precisionToggle}>
      <button
        className={`${styles.precisionBtn} ${value === "day" ? styles.precisionBtnActive : ""}`}
        onClick={() => onChange("day")}
      >
        Jour
      </button>
      <button
        className={`${styles.precisionBtn} ${value === "hour-timeline" ? styles.precisionBtnActive : ""} ${disableHourTimeline ? styles.precisionBtnDisabled : ""}`}
        onClick={() => !disableHourTimeline && onChange("hour-timeline")}
        title={disableHourTimeline ? "Disponible sur 7 et 30 jours uniquement" : undefined}
      >
        Heure (timeline)
      </button>
      <button
        className={`${styles.precisionBtn} ${value === "hour" ? styles.precisionBtnActive : ""}`}
        onClick={() => onChange("hour")}
      >
        Heure (somme)
      </button>
    </div>
  );
}

function fmtDatetime(dt: string): string {
  // "YYYY-MM-DD HH" → "DD/MM HHh"
  const [datePart, hourPart] = dt.split(" ");
  const [, m, d] = datePart.split("-");
  return `${d}/${m} ${hourPart}h`;
}

interface EvolutionChartProps {
  byDay: DailyValue[];
  byHour: HourlyValue[];
  byHourTimeline: HourlyTimelineValue[];
  precision: Precision;
  color: string;
  gradientId: string;
  label: string;
  formatValue?: (v: number) => string;
}

function EvolutionChart({ byDay, byHour, byHourTimeline, precision, color, gradientId, label, formatValue }: EvolutionChartProps) {
  const tooltipStyle = { background: "#2b2d31", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#dcdee1" };
  const tooltipFmt = formatValue ? (v: unknown) => [formatValue(v as number), label] as [string, string] : undefined;

  if (precision === "day") {
    if (byDay.length === 0) return <Empty />;
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={byDay.map((d) => ({ ...d, date: fmtDate(d.date) }))}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fill: "#80848e", fontSize: 11 }} />
          <YAxis tick={{ fill: "#80848e", fontSize: 11 }} allowDecimals={false} tickFormatter={formatValue} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#b5bac1" }} formatter={tooltipFmt} />
          <Area type="monotone" dataKey="value" name={label} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (precision === "hour-timeline") {
    if (byHourTimeline.length === 0) return <Empty />;
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={byHourTimeline.map((d) => ({ ...d, datetime: fmtDatetime(d.datetime) }))}>
          <defs>
            <linearGradient id={`${gradientId}Ht`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="datetime" tick={{ fill: "#80848e", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#80848e", fontSize: 11 }} allowDecimals={false} tickFormatter={formatValue} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#b5bac1" }} formatter={tooltipFmt} />
          <Area type="monotone" dataKey="value" name={label} stroke={color} fill={`url(#${gradientId}Ht)`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // hour (somme)
  const hasData = byHour.some((h) => h.value > 0);
  if (!hasData) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={byHour.map((h) => ({ ...h, hour: fmtHour(h.hour) }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="hour" tick={{ fill: "#80848e", fontSize: 10 }} interval={1} />
        <YAxis tick={{ fill: "#80848e", fontSize: 11 }} allowDecimals={false} tickFormatter={formatValue} />
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipFmt} />
        <Bar dataKey="value" name={label} fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface UserTableProps {
  rows: UserValue[];
  formatValue: (v: number) => string;
}

function UserTable({ rows, formatValue }: UserTableProps) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.thRank}>#</th>
          <th className={styles.thUser}>Utilisateur</th>
          <th className={styles.thValue}>Valeur</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const name = r.displayName || r.username || r.userID;
          return (
            <tr key={r.userID} className={styles.tr}>
              <td className={styles.tdRank}>{i + 1}</td>
              <td className={styles.tdUser}>
                <div className={styles.userCell}>
                  {r.avatarURL ? (
                    <img src={r.avatarURL} alt="" className={styles.userAvatar} />
                  ) : (
                    <span className={styles.userAvatarFallback}>
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.userName} title={r.userID}>{name}</span>
                </div>
              </td>
              <td className={styles.tdValue}>{formatValue(r.value)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface PieData {
  name: string;
  value: number;
}

function ChannelPie({ data }: { data: PieData[] }) {
  if (data.length === 0) return <Empty />;
  const top = data.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={top}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {top.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number, name: string) => [v, name]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Stats() {
  const [guilds, setGuilds] = useState<GuildEntry[]>([]);
  const [selectedGuildID, setSelectedGuildID] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [presetIdx, setPresetIdx] = useState(0);
  const [msgPrecision, setMsgPrecision] = useState<Precision>("day");
  const [voicePrecision, setVoicePrecision] = useState<Precision>("day");

  // Data state
  const [msgByDay, setMsgByDay] = useState<DailyValue[]>([]);
  const [msgByHour, setMsgByHour] = useState<HourlyValue[]>([]);
  const [msgByHourTimeline, setMsgByHourTimeline] = useState<HourlyTimelineValue[]>([]);
  const [msgByChannel, setMsgByChannel] = useState<ChannelValue[]>([]);
  const [msgByUser, setMsgByUser] = useState<UserValue[]>([]);
  const [voiceByDay, setVoiceByDay] = useState<DailyValue[]>([]);
  const [voiceByHour, setVoiceByHour] = useState<HourlyValue[]>([]);
  const [voiceByHourTimeline, setVoiceByHourTimeline] = useState<HourlyTimelineValue[]>([]);
  const [voiceByChannel, setVoiceByChannel] = useState<ChannelValue[]>([]);
  const [voiceByUser, setVoiceByUser] = useState<UserValue[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Date range
  const { start, end } = useMemo(() => {
    const days = PRESETS[presetIdx].days;
    const end = Date.now();
    const start = end - days * 86400000;
    return { start, end };
  }, [presetIdx]);

  // Channel name map
  const channelNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of channels) m.set(c.channelID, c.channelName);
    return m;
  }, [channels]);

  useEffect(() => {
    fetchGuilds().then((gs) => {
      setGuilds(gs);
      if (gs.length > 0) setSelectedGuildID(gs[0].guildID);
    });
  }, []);

  useEffect(() => {
    if (!selectedGuildID) return;
    fetchChannels(selectedGuildID).then(setChannels);
  }, [selectedGuildID]);

  useEffect(() => {
    if (!selectedGuildID) return;
    setLoadingStats(true);
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
        setMsgByDay(mDay);
        setMsgByHour(mHour);
        setMsgByHourTimeline(mHourTl);
        setMsgByChannel(mChan);
        setMsgByUser(mUser);
        setVoiceByDay(vDay);
        setVoiceByHour(vHour);
        setVoiceByHourTimeline(vHourTl);
        setVoiceByChannel(vChan);
        setVoiceByUser(vUser);
      })
      .finally(() => setLoadingStats(false));
  }, [selectedGuildID, start, end, refreshKey]);

  const msgPieData: PieData[] = msgByChannel.map((c) => ({
    name: channelNames.get(c.channelID) ?? c.channelID,
    value: c.value,
  }));

  const voicePieData: PieData[] = voiceByChannel.map((c) => ({
    name: channelNames.get(c.channelID) ?? c.channelID,
    value: c.value,
  }));

  const selectedGuild = guilds.find((g) => g.guildID === selectedGuildID);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Statistiques</h1>
          {selectedGuild && (
            <span className={styles.guildBadge}>
              {selectedGuild.iconURL && (
                <img src={selectedGuild.iconURL} alt="" className={styles.guildBadgeIcon} />
              )}
              {selectedGuild.name}
            </span>
          )}
        </div>
        <div className={styles.controls}>
          {guilds.length > 1 && (
            <select
              className={styles.select}
              value={selectedGuildID ?? ""}
              onChange={(e) => setSelectedGuildID(e.target.value)}
            >
              {guilds.map((g) => (
                <option key={g.guildID} value={g.guildID}>{g.name || g.guildID}</option>
              ))}
            </select>
          )}
          <div className={styles.presetButtons}>
            {PRESETS.map((p, i) => (
              <button
                key={i}
                className={`${styles.presetBtn} ${presetIdx === i ? styles.presetBtnActive : ""}`}
                onClick={() => setPresetIdx(i)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            className={styles.refreshBtn}
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loadingStats}
            title="Rafraîchir les statistiques"
          >
            <svg className={`${styles.refreshIcon} ${loadingStats ? styles.spinning : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Rafraîchir
          </button>
        </div>
      </div>

      {loadingStats ? (
        <div className={styles.fullLoading}><Loading /></div>
      ) : (
        <div className={styles.content}>

          {/* ── MESSAGES ── */}
          <SectionTitle>Messages</SectionTitle>
          <div className={styles.row}>
            <Card wide>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Évolution</span>
                <PrecisionToggle value={msgPrecision} onChange={setMsgPrecision} disableHourTimeline={presetIdx === 2} />
              </div>
              <EvolutionChart
                byDay={msgByDay}
                byHour={msgByHour}
                byHourTimeline={msgByHourTimeline}
                precision={msgPrecision}
                color="#5865f2"
                gradientId="msgGrad"
                label="Messages"
              />
            </Card>
          </div>

          <div className={styles.row}>
            <Card>
              <p className={styles.cardTitle}>Salons les plus actifs</p>
              <ChannelPie data={msgPieData} />
            </Card>
            <Card>
              <p className={styles.cardTitle}>Classement des membres</p>
              <UserTable rows={msgByUser} formatValue={(v) => `${v}`} />
            </Card>
          </div>

          {/* ── VOCAL ── */}
          <SectionTitle>Vocal</SectionTitle>
          <div className={styles.row}>
            <Card wide>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Évolution</span>
                <PrecisionToggle value={voicePrecision} onChange={setVoicePrecision} disableHourTimeline={presetIdx === 2} />
              </div>
              <EvolutionChart
                byDay={voiceByDay}
                byHour={voiceByHour}
                byHourTimeline={voiceByHourTimeline}
                precision={voicePrecision}
                color="#23a55a"
                gradientId="voiceGrad"
                label="Temps vocal"
                formatValue={fmtSecs}
              />
            </Card>
          </div>

          <div className={styles.row}>
            <Card>
              <p className={styles.cardTitle}>Salons vocaux les plus utilisés</p>
              <ChannelPie data={voicePieData} />
            </Card>
            <Card>
              <p className={styles.cardTitle}>Classement des membres (vocal)</p>
              <UserTable rows={voiceByUser} formatValue={fmtSecs} />
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
