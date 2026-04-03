"use client";

import { useDashboardNavigation } from "@/features/navigation";
import Link from "next/link";
import styles from "./Navbar.module.css";

export function Navbar() {
  const { hidden, guilds, selectedGuild, session, onGuildChange, items } = useDashboardNavigation();
  const mainItems = items.filter((item) => item.group !== "bottom");
  const bottomItems = items.filter((item) => item.group === "bottom");

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
        {mainItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${item.active ? styles.active : ""}`}
            title={item.title}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.bottomItems}>
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${item.active ? styles.active : ""}`}
            title={item.title}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        ))}
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
            <Link href="/api/auth/logout" className={styles.logoutBtn} title="Se déconnecter">
              <svg className={styles.logoutIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
