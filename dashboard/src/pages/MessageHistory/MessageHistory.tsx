import { useState } from "react";
import { FilterBar } from "../../components/FilterBar/FilterBar";
import { HistoryModal } from "../../components/HistoryModal/HistoryModal";
import { MessageList } from "../../components/MessageList/MessageList";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { useChannels } from "../../hooks/useChannels";
import { useGuilds } from "../../hooks/useGuilds";
import type { MessageFilters } from "../../hooks/useMessages";
import { DEFAULT_FILTERS, useMessages } from "../../hooks/useMessages";
import styles from "./MessageHistory.module.css";

export function MessageHistory() {
  const [selectedGuildID, setSelectedGuildID] = useState<string | null>(null);
  const [selectedChannelID, setSelectedChannelID] = useState<string | null>(null);
  const [historyMessageID, setHistoryMessageID] = useState<string | null>(null);
  const [filters, setFilters] = useState<MessageFilters>(DEFAULT_FILTERS);

  const { guilds } = useGuilds();
  const { channels, refresh: refreshChannels } = useChannels(selectedGuildID);
  const { messages, hasMore, loading, loadMore, refresh: refreshMessages, loadedChannelID } = useMessages(selectedGuildID, selectedChannelID, filters);

  function handleSelectGuild(id: string) {
    setSelectedGuildID(id);
    setSelectedChannelID(null);
    setFilters(DEFAULT_FILTERS);
  }

  function handleSelectChannel(id: string) {
    setSelectedChannelID(id);
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        guilds={guilds}
        channels={channels}
        selectedGuildID={selectedGuildID}
        selectedChannelID={selectedChannelID}
        onSelectGuild={handleSelectGuild}
        onSelectChannel={handleSelectChannel}
      />

      <main className={styles.main}>
        {selectedChannelID && (() => {
          const guild = guilds.find((g) => g.guildID === selectedGuildID);
          const channel = channels.find((c) => c.channelID === selectedChannelID);
          return (
            <div className={styles.channelHeader}>
              {guild && (
                <span className={styles.guildInfo}>
                  {guild.iconURL ? (
                    <img src={guild.iconURL} alt="" className={styles.guildHeaderIcon} />
                  ) : (
                    <span className={styles.guildHeaderFallback}>
                      {(guild.name || guild.guildID).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.guildName}>{guild.name || guild.guildID}</span>
                  <span className={styles.headerSep}>/</span>
                </span>
              )}
              <span className={styles.channelIcon}>#</span>
              <span>{channel?.channelName || selectedChannelID}</span>
              <div className={styles.headerActions}>
                <button
                  className={styles.refreshBtn}
                  onClick={() => { refreshChannels(); refreshMessages(); }}
                  disabled={loading}
                  title="Rafraîchir les salons et les messages"
                >
                  <svg className={`${styles.refreshIcon} ${loading ? styles.spinning : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Rafraîchir
                </button>
              </div>
            </div>
          );
        })()}
        {selectedChannelID && (
          <FilterBar filters={filters} onChange={setFilters} />
        )}
        <MessageList
          messages={messages}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
          onShowHistory={setHistoryMessageID}
          channelID={selectedChannelID}
          loadedChannelID={loadedChannelID}
        />
      </main>

      {historyMessageID && (
        <HistoryModal messageID={historyMessageID} onClose={() => setHistoryMessageID(null)} />
      )}
    </div>
  );
}