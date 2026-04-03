"use client";

import { fetchGuilds } from "@/lib/api-client";
import type { GuildEntry } from "@/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NAVIGATION_ITEMS } from "./navigation.config";
import type { SessionPayload } from "./types";

export function useDashboardNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hidden = pathname === "/login";
  const [guilds, setGuilds] = useState<GuildEntry[]>([]);
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    if (hidden) return;
    fetchGuilds().then(setGuilds).catch(() => setGuilds([]));
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unauthorized");
        return response.json() as Promise<SessionPayload>;
      })
      .then(setSession)
      .catch(() => setSession(null));
  }, [hidden]);

  const selectedGuildID = searchParams.get("guild") ?? guilds[0]?.guildID ?? "";
  const selectedGuild = useMemo(
    () => guilds.find((guild) => guild.guildID === selectedGuildID) ?? guilds[0] ?? null,
    [guilds, selectedGuildID],
  );

  function withGuild(path: string) {
    return selectedGuildID ? `${path}?guild=${encodeURIComponent(selectedGuildID)}` : path;
  }

  function onGuildChange(guildID: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("guild", guildID);
    router.push(`${pathname}?${params.toString()}`);
  }

  const items = useMemo(
    () => NAVIGATION_ITEMS.map((item) => ({ ...item, href: withGuild(item.href), active: pathname === item.href })),
    [pathname, selectedGuildID],
  );

  return {
    hidden,
    guilds,
    selectedGuild,
    selectedGuildID,
    session,
    onGuildChange,
    items,
  };
}
