"use client";

import { useEffect, useState } from "react";
import styles from "@/app/moderation/Moderation.module.css";
import type { UserMeta } from "../types";

const userMetaCache = new Map<string, UserMeta>();

export function useUserMeta(guildID: string, userID: string | null | undefined): UserMeta | null {
  const [meta, setMeta] = useState<UserMeta | null>(() => {
    if (!guildID || !userID) return null;
    return userMetaCache.get(`${guildID}:${userID}`) ?? null;
  });

  useEffect(() => {
    if (!guildID || !userID) return;
    const key = `${guildID}:${userID}`;
    if (userMetaCache.has(key)) {
      setMeta(userMetaCache.get(key) ?? null);
      return;
    }

    fetch(`/api/guilds/${guildID}/users/${userID}`)
      .then((response) => response.json() as Promise<UserMeta>)
      .then((data) => {
        userMetaCache.set(key, data);
        setMeta(data);
      })
      .catch(() => null);
  }, [guildID, userID]);

  return meta;
}

export function usePreloadUserMetas(guildID: string, userIDs: string[]) {
  const joined = userIDs.join(",");

  useEffect(() => {
    if (!guildID) return;
    for (const userID of userIDs) {
      const key = `${guildID}:${userID}`;
      if (userMetaCache.has(key)) continue;
      fetch(`/api/guilds/${guildID}/users/${userID}`)
        .then((response) => response.json() as Promise<UserMeta>)
        .then((data) => {
          userMetaCache.set(key, data);
        })
        .catch(() => null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildID, joined]);
}

export function Avatar({ src, name, size = 32 }: Readonly<{ src: string; name: string; size?: number }>) {
  const [err, setErr] = useState(false);

  if (!src || err) {
    return (
      <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
        {name ? name.slice(0, 2).toUpperCase() : "?"}
      </div>
    );
  }

  return <img src={src} alt={name} className={styles.avatarImg} style={{ width: size, height: size }} onError={() => setErr(true)} />;
}

export function UserCard({ guildID, userID, label }: Readonly<{ guildID: string; userID: string; label: string }>) {
  const meta = useUserMeta(guildID, userID);
  const name = meta?.displayName || meta?.username || userID;
  const sub = meta?.username && meta.username !== meta.displayName ? `@${meta.username}` : null;
  const [showID, setShowID] = useState(false);

  return (
    <div className={styles.userCard}>
      <div className={styles.label}>{label}</div>
      <div className={styles.userCardBody}>
        <Avatar src={meta?.avatarURL ?? ""} name={name} size={38} />
        <div className={styles.userCardInfo}>
          <span className={styles.userCardName}>{name}</span>
          {sub && <span className={styles.userCardSub}>{sub}</span>}
          <button className={styles.userCardIdBtn} onClick={() => setShowID((value) => !value)}>
            {showID ? <span className={styles.userCardIdValue}>{userID}</span> : "Voir ID"}
          </button>
        </div>
      </div>
    </div>
  );
}
