import { useMemo, useState } from "react";
import type { ChannelEntry, GuildEntry } from "../../types";
import styles from "./Sidebar.module.css";

interface Props {
  guilds: GuildEntry[];
  channels: ChannelEntry[];
  selectedGuildID: string | null;
  selectedChannelID: string | null;
  onSelectGuild: (id: string) => void;
  onSelectChannel: (id: string) => void;
}

export function Sidebar({ guilds, channels, selectedGuildID, selectedChannelID, onSelectGuild, onSelectChannel }: Readonly<Props>) {
  const [channelSearch, setChannelSearch] = useState("");

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) =>
      c.channelID.includes(q) || c.channelName.toLowerCase().includes(q)
    );
  }, [channels, channelSearch]);

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
              {filteredChannels.length === 0 ? (
                <p className={styles.searchEmpty}>Aucun salon trouvé</p>
              ) : (
                filteredChannels.map((c) => (
                  <button
                    key={c.channelID}
                    className={`${styles.item} ${selectedChannelID === c.channelID ? styles.itemActive : ""}`}
                    onClick={() => onSelectChannel(c.channelID)}
                  >
                    <span className={styles.channelPrefix}>#</span>
                    <span className={styles.itemLabel}>{c.channelName || c.channelID}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
