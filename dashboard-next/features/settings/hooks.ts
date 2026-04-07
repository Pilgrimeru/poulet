"use client";

import type { ChannelEntry } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSpamRule, deleteChannelRule, deleteSpamRule, fetchAllChannels, fetchChannelRules, fetchSettings, fetchSpamRules, patchSettings, patchSpamRule, upsertChannelRule } from "./api";
import type { ChannelRuleDTO, GuildSettingsDTO, SpamRuleDTO } from "./types";

export function useGuildSettings(guildID: string) {
  const [settings, setSettings] = useState<GuildSettingsDTO | null>(null);
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!guildID) return;
    setSettings(null);
    Promise.all([fetchSettings(guildID), fetchAllChannels(guildID)])
      .then(([nextSettings, nextChannels]) => {
        setSettings(nextSettings);
        setChannels(nextChannels);
      })
      .catch(() => {
        setSettings(null);
        setChannels([]);
      });
  }, [guildID]);

  const patch = useCallback((nextPatch: Partial<GuildSettingsDTO>) => {
    setSettings((current) => (current ? { ...current, ...nextPatch } : current));
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await patchSettings(guildID, nextPatch);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
      }
    }, 600);
  }, [guildID]);

  return { settings, channels, status, patch };
}

export function useSpamRules(guildID: string) {
  const [rules, setRules] = useState<SpamRuleDTO[] | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!guildID) return;
    fetchSpamRules(guildID).then(setRules).catch(() => setRules([]));
  }, [guildID]);

  function scheduleSave(rule: SpamRuleDTO) {
    clearTimeout(timers.current[rule.id]);
    timers.current[rule.id] = setTimeout(async () => {
      setSaving((current) => ({ ...current, [rule.id]: true }));
      try {
        const updated = await patchSpamRule(guildID, rule.id, rule);
        setRules((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? null);
      } finally {
        setSaving((current) => ({ ...current, [rule.id]: false }));
      }
    }, 600);
  }

  function updateRule(id: string, patch: Partial<SpamRuleDTO>) {
    setRules((current) => {
      if (!current) return current;
      const next = current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule);
      const updated = next.find((rule) => rule.id === id);
      if (updated) scheduleSave(updated);
      return next;
    });
  }

  async function removeRule(id: string) {
    await deleteSpamRule(guildID, id);
    setRules((current) => current?.filter((rule) => rule.id !== id) ?? null);
  }

  async function addRule() {
    const rule = await createSpamRule(guildID);
    setRules((current) => [...(current ?? []), rule]);
  }

  return { rules, saving, updateRule, removeRule, addRule };
}

export function useChannelRules(guildID: string) {
  const [rules, setRules] = useState<ChannelRuleDTO[] | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!guildID) return;
    fetchChannelRules(guildID).then(setRules).catch(() => setRules([]));
  }, [guildID]);

  function scheduleSave(channelID: string, patch: Partial<Omit<ChannelRuleDTO, "id" | "guildID" | "channelID">>) {
    clearTimeout(timers.current[channelID]);
    timers.current[channelID] = setTimeout(async () => {
      setSaving((current) => ({ ...current, [channelID]: true }));
      try {
        const updated = await upsertChannelRule(guildID, channelID, patch);
        setRules((current) => current?.map((r) => r.channelID === channelID ? updated : r) ?? null);
      } finally {
        setSaving((current) => ({ ...current, [channelID]: false }));
      }
    }, 600);
  }

  function updateRule(channelID: string, patch: Partial<Omit<ChannelRuleDTO, "id" | "guildID" | "channelID">>) {
    setRules((current) => {
      if (!current) return current;
      const exists = current.find((r) => r.channelID === channelID);
      if (exists) return current.map((r) => r.channelID === channelID ? { ...r, ...patch } : r);
      return [...current, { id: "", guildID, channelID, reactEmojis: [], reactFilter: ["all" as const], autoThread: false, oneMessageLimit: false, ...patch }];
    });
    scheduleSave(channelID, patch);
  }

  async function removeRule(channelID: string) {
    await deleteChannelRule(guildID, channelID);
    setRules((current) => current?.filter((r) => r.channelID !== channelID) ?? null);
  }

  return { rules, saving, updateRule, removeRule };
}
