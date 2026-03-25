import { useEffect, useState } from "react";
import { fetchChannels } from "../api/client";
import type { ChannelEntry } from "../types";

export function useChannels(guildID: string | null) {
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!guildID) { setChannels([]); return; }
    setLoading(true);
    fetchChannels(guildID)
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [guildID]);

  return { channels, loading };
}
