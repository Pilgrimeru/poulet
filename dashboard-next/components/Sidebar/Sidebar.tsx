"use client";
import { useMemo, useState } from "react";
import { ChannelType, type ChannelEntry, type GuildEntry } from "../../types";
import styles from "./Sidebar.module.css";

interface Props {
  guilds: GuildEntry[];
  channels: ChannelEntry[];
  selectedGuildID: string | null;
  selectedChannelID: string | null;
  onSelectGuild: (id: string) => void;
  onSelectChannel: (id: string) => void;
}

function isThread(c: ChannelEntry): boolean {
  return c.channelType === ChannelType.PublicThread || c.channelType === ChannelType.PrivateThread;
}

function isCategory(c: ChannelEntry): boolean {
  return c.channelType === ChannelType.GuildCategory;
}

function isForum(c: ChannelEntry): boolean {
  return c.channelType === ChannelType.GuildForum || c.channelType === ChannelType.GuildMedia;
}

export function Sidebar({ guilds, channels, selectedGuildID, selectedChannelID, onSelectGuild, onSelectChannel }: Readonly<Props>) {
  const [channelSearch, setChannelSearch] = useState("");
  // For forums: tracks expanded state (toggle open/close)
  // For text channels with threads: "closed" | "open-threads"
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    // Exclude categories always
    const visible = channels.filter((c) => !isCategory(c));
    if (!q) return visible;

    // Find all matching channels
    const matched = visible.filter((c) =>
      c.channelID.includes(q) ||
      c.channelName.toLowerCase().includes(q) ||
      (c.parentName?.toLowerCase().includes(q) ?? false)
    );

    // If a thread matches, also include its parent so it can be rendered
    const parentIDsToInclude = new Set(
      matched.filter((c) => isThread(c) && c.parentID).map((c) => c.parentID!)
    );
    const parents = visible.filter((c) => parentIDsToInclude.has(c.channelID) && !matched.includes(c));

    return [...parents, ...matched];
  }, [channels, channelSearch]);

  // Build structure: standalone channels + grouped threads under their parent
  const { items, threadsByParent } = useMemo(() => {
    const threadsByParent = new Map<string, ChannelEntry[]>();
    const standaloneIDs = new Set<string>();

    for (const c of filteredChannels) {
      if (isThread(c) && c.parentID) {
        if (!threadsByParent.has(c.parentID)) threadsByParent.set(c.parentID, []);
        threadsByParent.get(c.parentID)!.push(c);
      } else {
        standaloneIDs.add(c.channelID);
      }
    }

    // Items = non-thread channels, ordered as they come
    const items = filteredChannels.filter((c) => standaloneIDs.has(c.channelID));

    return { items, threadsByParent };
  }, [filteredChannels]);

  const isSearching = channelSearch.trim().length > 0;

  const isExpanded = (channelID: string) => isSearching || expandedGroups.has(channelID);

  const toggleGroup = (channelID: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(channelID)) next.delete(channelID);
      else next.add(channelID);
      return next;
    });
  };

  const handleTextChannelClick = (c: ChannelEntry) => {
    const threads = threadsByParent.get(c.channelID);
    if (!threads || threads.length === 0) {
      // No threads — just select
      onSelectChannel(c.channelID);
      return;
    }
    if (selectedChannelID === c.channelID) {
      // Already selected: toggle threads open/close
      toggleGroup(c.channelID);
    } else {
      // First click: select the channel, close threads
      onSelectChannel(c.channelID);
      setExpandedGroups((prev) => { const n = new Set(prev); n.delete(c.channelID); return n; });
    }
  };

  const renderThread = (c: ChannelEntry) => (
    <button
      key={c.channelID}
      className={`${styles.item} ${styles.itemIndented} ${selectedChannelID === c.channelID ? styles.itemActive : ""}`}
      onClick={() => onSelectChannel(c.channelID)}
    >
      <span className={styles.channelPrefix}>#</span>
      <span className={styles.itemLabel}>{c.channelName || c.channelID}</span>
    </button>
  );

  const renderChannel = (c: ChannelEntry) => {
    const threads = threadsByParent.get(c.channelID) ?? [];
    const hasThreads = threads.length > 0;
    const expanded = isExpanded(c.channelID);
    const isSelected = selectedChannelID === c.channelID;

    if (isForum(c)) {
      // Forum: header only, click to expand posts
      return (
        <div key={c.channelID}>
          <button
            className={styles.groupHeader}
            onClick={() => toggleGroup(c.channelID)}
          >
            <svg
              className={`${styles.groupChevron} ${expanded ? styles.groupChevronOpen : ""}`}
              viewBox="0 0 12 12" fill="none" aria-hidden="true"
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={styles.groupLabel}>{c.channelName || c.channelID}</span>
            {hasThreads && <span className={styles.groupCount}>{threads.length}</span>}
          </button>
          {expanded && threads.map(renderThread)}
        </div>
      );
    }

    // Text channel (with or without threads)
    return (
      <div key={c.channelID}>
        <button
          className={`${styles.item} ${isSelected ? styles.itemActive : ""}`}
          onClick={() => handleTextChannelClick(c)}
        >
          {hasThreads ? (
            <svg
              className={`${styles.threadChevron} ${expanded ? styles.groupChevronOpen : ""}`}
              viewBox="0 0 12 12" fill="none" aria-hidden="true"
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className={styles.channelPrefix}>#</span>
          )}
          <span className={styles.itemLabel}>{c.channelName || c.channelID}</span>
        </button>
        {expanded && threads.map(renderThread)}
      </div>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section} style={{ maxHeight: "40%" }}>
        <p className={styles.sectionTitle}>Serveurs</p>
        <div className={styles.list}>
          {guilds.map((g) => (
            <button
              key={g.guildID}
              className={`${styles.item} ${selectedGuildID === g.guildID ? styles.itemActive : ""}`}
              onClick={() => onSelectGuild(g.guildID)}
            >
              {g.iconURL ? (
                <img src={g.iconURL} alt="" className={styles.guildIcon} />
              ) : (
                <span className={styles.guildIconFallback}>
                  {(g.name || g.guildID).slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className={styles.itemLabel}>{g.name || g.guildID}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedGuildID && (
        <>
          <div className={styles.divider} />
          <div className={styles.section} style={{ flex: 1 }}>
            <p className={styles.sectionTitle}>Salons</p>
            <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Rechercher un salon…"
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                aria-label="Rechercher un salon"
              />
              {channelSearch && (
                <button className={styles.searchClear} onClick={() => setChannelSearch("")} aria-label="Effacer">
                  ×
                </button>
              )}
            </div>
            <div className={styles.list}>
              {items.length === 0 && threadsByParent.size === 0 ? (
                <p className={styles.searchEmpty}>Aucun salon trouvé</p>
              ) : (
                items.map(renderChannel)
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
