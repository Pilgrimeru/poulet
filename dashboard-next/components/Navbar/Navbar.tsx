"use client";

import { fetchGuilds } from "@/lib/api-client";
import type { GuildEntry } from "@/types";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./Navbar.module.css";

type SessionPayload = {
  user: {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string;
  };
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [guilds, setGuilds] = useState<GuildEntry[]>([]);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const hidden = pathname === "/login";

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

  function onGuildChange(guildID: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("guild", guildID);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (hidden) {
    return null;
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <div className={styles.guildPicker}>
          {selectedGuild?.iconURL ? (
            <img src={selectedGuild.iconURL} alt="" className={styles.guildPickerIcon} />
          ) : (
            <span className={styles.guildPickerFallback}>
              {(selectedGuild?.name || "P").slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className={styles.guildPickerBody}>
            <span className={styles.guildPickerLabel}>Serveur</span>
            <span className={styles.guildPickerName}>{selectedGuild?.name || "Aucun serveur"}</span>
          </div>
          <svg className={styles.guildPickerChevron} viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select
            className={styles.guildPickerSelect}
            value={selectedGuild?.guildID ?? ""}
            onChange={(e) => onGuildChange(e.target.value)}
            aria-label="Sélectionner un serveur"
          >
            {guilds.map((guild) => (
              <option key={guild.guildID} value={guild.guildID}>
                {guild.name || guild.guildID}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.navItems}>
        <Link
          href="/"
          className={`${styles.navItem} ${pathname === "/" ? styles.active : ""}`}
          title="Accueil"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className={styles.navLabel}>Accueil</span>
        </Link>

        <Link
          href="/history"
          className={`${styles.navItem} ${pathname === "/history" ? styles.active : ""}`}
          title="Historique des messages"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span className={styles.navLabel}>Chat</span>
        </Link>

        <Link
          href="/stats"
          className={`${styles.navItem} ${pathname === "/stats" ? styles.active : ""}`}
          title="Statistiques de serveur"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span className={styles.navLabel}>Stats</span>
        </Link>
      </div>

      <div className={styles.bottomItems}>
        <Link
          href="/settings"
          className={`${styles.navItem} ${pathname === "/settings" ? styles.active : ""}`}
          title="Paramètres du bot"
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span className={styles.navLabel}>Réglages</span>
        </Link>
        {session && (
          <div className={styles.profileCard}>
            {session.user.avatar ? (
              <img src={session.user.avatar} alt="" className={styles.profileAvatar} />
            ) : (
              <span className={styles.profileFallback}>
                {(session.user.globalName || session.user.username).slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className={styles.profileBody}>
              <span className={styles.profileName}>{session.user.globalName || session.user.username}</span>
              <span className={styles.profileHandle}>@{session.user.username}</span>
            </div>
            <Link href="/api/auth/logout" className={styles.logoutBtn}>
              Quitter
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
