import { useState } from "react";
import { FilterBar } from "./components/FilterBar/FilterBar";
import { HistoryModal } from "./components/HistoryModal/HistoryModal";
import { MessageList } from "./components/MessageList/MessageList";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useChannels } from "./hooks/useChannels";
import { useGuilds } from "./hooks/useGuilds";
import { DEFAULT_FILTERS, useMessages } from "./hooks/useMessages";
import type { MessageFilters } from "./hooks/useMessages";
import styles from "./App.module.css";

export function App() {
  const [selectedGuildID, setSelectedGuildID] = useState<string | null>(null);
  const [selectedChannelID, setSelectedChannelID] = useState<string | null>(null);
  const [historyMessageID, setHistoryMessageID] = useState<string | null>(null);
  const [filters, setFilters] = useState<MessageFilters>(DEFAULT_FILTERS);

  const { guilds } = useGuilds();
  const { channels } = useChannels(selectedGuildID);
  const { messages, hasMore, loading, loadMore } = useMessages(selectedGuildID, selectedChannelID, filters);

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
        />
      </main>

      {historyMessageID && (
        <HistoryModal messageID={historyMessageID} onClose={() => setHistoryMessageID(null)} />
      )}
    </div>
  );
}
