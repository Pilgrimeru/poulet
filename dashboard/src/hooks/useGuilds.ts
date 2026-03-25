import { useEffect, useState } from "react";
import { fetchGuilds } from "../api/client";
import type { GuildEntry } from "../types";

export function useGuilds() {
  const [guilds, setGuilds] = useState<GuildEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuilds()
      .then(setGuilds)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { guilds, loading, error };
}
