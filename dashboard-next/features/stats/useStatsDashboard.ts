"use client";

import { fetchChannels, fetchGuilds } from "@/lib/api-client";
import { fetchStatsAll } from "@/lib/api-stats";
import type { ChannelEntry } from "@/types";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Precision, StatsData } from "./types";
import { EMPTY_STATS, PRESETS, groupChannelData } from "./stats.utils";

export function useStatsDashboard() {
  const searchParams = useSearchParams();
  const guildFromQuery = searchParams.get("guild");
  const [selectedGuildID, setSelectedGuildID] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [presetIdx, setPresetIdx] = useState(0);
  const [msgPrecision, setMsgPrecision] = useState<Precision>("day");
  const [voicePrecision, setVoicePrecision] = useState<Precision>("day");
  const [memberPrecision, setMemberPrecision] = useState<Precision>("day");
  const [stats, setStats] = useState<StatsData>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const statsRequestRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const range = useMemo(() => {
    const days = PRESETS[presetIdx].days;
    const end = Date.now();
    return { start: end - days * 86400000, end };
  }, [presetIdx]);

  const channelNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const channel of channels) {
      map.set(channel.channelID, channel.channelName);
    }
    return map;
  }, [channels]);

  useEffect(() => {
    fetchGuilds().then((guilds) => {
      if (guildFromQuery && guilds.some((guild) => guild.guildID === guildFromQuery)) {
        setSelectedGuildID(guildFromQuery);
      } else if (guilds.length > 0) {
        setSelectedGuildID(guilds[0].guildID);
      } else {
        setLoading(false);
      }
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
    if (presetIdx !== 2) return;

    if (msgPrecision === "hour-timeline") {
      setMsgPrecision("day");
    }
    if (voicePrecision === "hour-timeline") {
      setVoicePrecision("day");
    }
    if (memberPrecision === "hour-timeline") {
      setMemberPrecision("day");
    }
  }, [presetIdx, msgPrecision, voicePrecision, memberPrecision]);

  useEffect(() => {
    if (!selectedGuildID) return;

    const requestId = statsRequestRef.current + 1;
    statsRequestRef.current = requestId;
    setError(null);

    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    fetchStatsAll(selectedGuildID, range.start, range.end)
      .then((data) => {
        if (statsRequestRef.current !== requestId) return;
        setStats({
          msgOverview: data.msgOverview,
          msgByChannel: data.msgByChannel,
          msgByUser: data.msgByUser,
          voiceOverview: data.voiceOverview,
          voiceByChannel: data.voiceByChannel,
          voiceByUser: data.voiceByUser,
          memberOverview: data.memberOverview,
        });
        hasLoadedRef.current = true;
      })
      .catch(() => {
        if (statsRequestRef.current !== requestId) return;
        setError("Impossible de charger les statistiques.");
      })
      .finally(() => {
        if (statsRequestRef.current !== requestId) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [selectedGuildID, range.start, range.end, refreshKey]);

  const msgPieData = useMemo(
    () =>
      groupChannelData(
        stats.msgByChannel.map((channel) => ({
          ...channel,
          channelName: channel.channelName ?? channelNames.get(channel.channelID) ?? channel.channelID,
        })),
      ),
    [stats.msgByChannel, channelNames],
  );

  const voicePieData = useMemo(
    () =>
      groupChannelData(
        stats.voiceByChannel.map((channel) => ({
          ...channel,
          channelName: channel.channelName ?? channelNames.get(channel.channelID) ?? channel.channelID,
        })),
      ),
    [stats.voiceByChannel, channelNames],
  );

  return {
    presetIdx,
    setPresetIdx,
    msgPrecision,
    setMsgPrecision,
    voicePrecision,
    setVoicePrecision,
    memberPrecision,
    setMemberPrecision,
    stats,
    error,
    loading,
    refreshing,
    showInitialSkeleton: loading && !hasLoadedRef.current,
    disableHourTimeline: presetIdx === 2,
    refreshDisabled: loading || refreshing,
    refresh: () => setRefreshKey((value) => value + 1),
    msgPieData,
    voicePieData,
  };
}
