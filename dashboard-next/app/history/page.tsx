"use client";

import { FilterBar } from "@/components/FilterBar/FilterBar";
import { HistoryModal } from "@/components/HistoryModal/HistoryModal";
import { MessageList } from "@/components/MessageList/MessageList";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { EmptyState } from "@/components/ui";
import { useChannels } from "@/hooks/useChannels";
import { useGuilds } from "@/hooks/useGuilds";
import type { MessageFilters } from "@/hooks/useMessages";
import { DEFAULT_FILTERS, useMessages } from "@/hooks/useMessages";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import styles from "./MessageHistory.module.css";

const MOBILE_BREAKPOINT = 900;

function HistoryPageContent() {
  const searchParams = useSearchParams();
  const [selectedGuildID, setSelectedGuildID] = useState<string | null>(null);
  const [selectedChannelID, setSelectedChannelID] = useState<string | null>(null);
  const [historyMessageID, setHistoryMessageID] = useState<string | null>(null);
  const [filters, setFilters] = useState<MessageFilters>(DEFAULT_FILTERS);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "messages">("list");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mobileScrollSeed, setMobileScrollSeed] = useState(0);

  const { guilds } = useGuilds();
  const { channels, refresh: refreshChannels } = useChannels(selectedGuildID);
  const { messages, hasMore, loading, loadMore, refresh: refreshMessages, loadedChannelID, updateMode } = useMessages(selectedGuildID, selectedChannelID, filters);
  const guildFromQuery = searchParams.get("guild");
  const channelFromQuery = searchParams.get("channel");
  const messageFromQuery = searchParams.get("message");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => setIsMobile(media.matches);
    sync();

    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileView("messages");
      return;
    }
    setMobileView(selectedChannelID ? "messages" : "list");
  }, [isMobile, selectedChannelID]);

  useEffect(() => {
    if (guildFromQuery && selectedGuildID !== guildFromQuery) {
      setSelectedGuildID(guildFromQuery);
      setSelectedChannelID(null);
      setFilters(DEFAULT_FILTERS);
      return;
    }
    if (!guildFromQuery && !selectedGuildID && guilds[0]?.guildID) {
      setSelectedGuildID(guilds[0].guildID);
    }
  }, [guildFromQuery, guilds, selectedGuildID]);

  useEffect(() => {
    if (!channelFromQuery) return;
    if (selectedChannelID === channelFromQuery) return;
    setSelectedChannelID(channelFromQuery);
    if (isMobile) setMobileView("messages");
  }, [channelFromQuery, isMobile, selectedChannelID]);

  useEffect(() => {
    if (!messageFromQuery) return;
    setHistoryMessageID(messageFromQuery);
  }, [messageFromQuery]);

  function handleSelectChannel(id: string) {
    setSelectedChannelID(id);
    setFilters(DEFAULT_FILTERS);
    setShowMobileFilters(false);
    setMobileScrollSeed((value) => value + 1);
    if (isMobile) setMobileView("messages");
  }

  const selectedGuild = guilds.find((g) => g.guildID === selectedGuildID);
  const selectedChannel = channels.find((c) => c.channelID === selectedChannelID);
  const showMobileList = !isMobile || mobileView === "list";
  const showMobileMessages = !isMobile || mobileView === "messages";

  return (
    <div className={`${styles.layout} ${isMobile ? styles.layoutMobile : ""}`}>
      {showMobileList && (
        <Sidebar
          channels={channels}
          selectedChannelID={selectedChannelID}
          onSelectChannel={handleSelectChannel}
        />
      )}

      {showMobileMessages && (
        <main className={`${styles.main} ${isMobile ? styles.mainMobile : ""}`}>
          {isMobile && selectedChannelID ? (
            <div className={styles.mobileBackBar}>
              <button className={styles.mobileBackBtn} onClick={() => setMobileView("list")}>
                ← Retour aux salons
              </button>
            </div>
          ) : null}

          {selectedChannelID && (
            <div className={styles.channelHeader}>
              {selectedGuild && (
                <span className={styles.guildInfo}>
                  {selectedGuild.iconURL ? (
                    <img src={selectedGuild.iconURL} alt="" className={styles.guildHeaderIcon} />
                  ) : (
                    <span className={styles.guildHeaderFallback}>
                      {(selectedGuild.name || selectedGuild.guildID).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.guildName}>{selectedGuild.name || selectedGuild.guildID}</span>
                  <span className={styles.headerSep}>/</span>
                </span>
              )}
              <span className={styles.channelIcon}>#</span>
              <span>{selectedChannel?.channelName || selectedChannelID}</span>
              <div className={styles.headerActions}>
                {isMobile ? (
                  <button
                    className={`${styles.iconBtn} ${showMobileFilters ? styles.iconBtnActive : ""}`}
                    onClick={() => setShowMobileFilters((value) => !value)}
                    title="Afficher les filtres"
                    aria-label="Afficher les filtres"
                    aria-pressed={showMobileFilters}
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M2 3.5h12M4.5 8h7M6.5 12.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
                <button
                  className={isMobile ? styles.iconBtn : styles.refreshBtn}
                  onClick={() => { refreshChannels(); refreshMessages(); }}
                  disabled={loading}
                  title="Rafraîchir les salons et les messages"
                  aria-label="Rafraîchir les salons et les messages"
                >
                  <svg className={`${styles.refreshIcon} ${loading ? styles.spinning : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {!isMobile ? "Rafraîchir" : null}
                </button>
              </div>
            </div>
          )}
          {!selectedChannelID ? <EmptyState title="Sélectionnez un salon" description="Choisissez un salon pour parcourir son historique." /> : null}
          {selectedChannelID && (!isMobile || showMobileFilters) && (
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
            updateMode={updateMode}
            scrollToMessageID={historyMessageID}
            forceScrollToBottomToken={mobileScrollSeed}
          />
        </main>
      )}

      {historyMessageID && (
        <HistoryModal messageID={historyMessageID} onClose={() => setHistoryMessageID(null)} />
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent />
    </Suspense>
  );
}
