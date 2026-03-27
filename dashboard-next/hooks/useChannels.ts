"use client";
import { useEffect, useState } from "react";
import { fetchChannels } from "../lib/api-client";
import type { ChannelEntry } from "../types";

export function useChannels(guildID: string | null) {
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!guildID) { setChannels([]); return; }
    setLoading(true);
    fetchChannels(guildID)
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [guildID, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { channels, loading, refresh };
}
