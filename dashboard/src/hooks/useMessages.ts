import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages } from "../api/client";
import type { MessageSnapshotDTO } from "../types";

const PAGE_SIZE = 50;

export interface MessageFilters {
  search: string;
  dateFrom: string; // ISO date string "YYYY-MM-DD"
  dateTo: string;
  onlyDeleted: boolean;
}

export const DEFAULT_FILTERS: MessageFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  onlyDeleted: false,
};

function filtersToFetchParams(filters: MessageFilters, before?: number) {
  return {
    before,
    after:       filters.dateFrom ? new Date(filters.dateFrom).getTime() : undefined,
    before2:     filters.dateTo   ? new Date(filters.dateTo + "T23:59:59").getTime() : undefined,
    search:      filters.search   || undefined,
    onlyDeleted: filters.onlyDeleted,
  };
}

export function useMessages(guildID: string | null, channelID: string | null, filters: MessageFilters = DEFAULT_FILTERS) {
  const [messages, setMessages] = useState<MessageSnapshotDTO[]>([]);
  const [loadedChannelID, setLoadedChannelID] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const beforeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    beforeRef.current = undefined;
    if (!guildID || !channelID) return;

    setLoading(true);
    const p = filtersToFetchParams(filters);
    fetchMessages(guildID, channelID, PAGE_SIZE, {
      before:      p.before2, // upper date bound as "before" cursor
      after:       p.after,
      search:      p.search,
      onlyDeleted: p.onlyDeleted,
    })
      .then((page) => {
        setMessages(page);
        setLoadedChannelID(channelID);
        setHasMore(page.length === PAGE_SIZE);
        if (page.length > 0) {
          beforeRef.current = Math.min(...page.map((m) => m.createdAt));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildID, channelID, filters.search, filters.dateFrom, filters.dateTo, filters.onlyDeleted, refreshKey]);

  const loadMore = useCallback(() => {
    if (!guildID || !channelID || loading || !hasMore) return;
    setLoading(true);
    const p = filtersToFetchParams(filters, beforeRef.current);
    fetchMessages(guildID, channelID, PAGE_SIZE, {
      before:      p.before,
      after:       p.after,
      search:      p.search,
      onlyDeleted: p.onlyDeleted,
    })
      .then((page) => {
        setMessages((prev) => [...prev, ...page]);
        setHasMore(page.length === PAGE_SIZE);
        if (page.length > 0) {
          beforeRef.current = Math.min(...page.map((m) => m.createdAt));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildID, channelID, loading, hasMore, filters]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { messages, loadMore, hasMore, loading, refresh, loadedChannelID };
}
