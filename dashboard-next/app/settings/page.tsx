"use client";

import type { ChannelEntry } from "@/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import styles from "./Settings.module.css";

// ── Types ───────────────────────────────────────────────────────────────────

type GuildSettingsDTO = {
  guildID: string;
  statsBlacklistChannelIDs: string[];
  statsCountDeafTime: boolean;
  statsAutoFrequency: "disabled" | "daily" | "weekly" | "monthly";
  statsRankingPreference: "voice" | "messages";
  statsReportChannelID: string;
  inviteLogChannelID: string;
  sanctionDurationMs: number | null;
};

type SpamFilterMode = "whitelist" | "blacklist";

type SpamRuleDTO = {
  id: string;
  guildID: string;
  name: string;
  description: string;
  mode: SpamFilterMode;
  channelIDs: string[];
  messageLimit: number;
  intervalInSec: number;
  punishmentDurationInSec: number;
  enabled: boolean;
};

type Section = "stats" | "spam" | "invite-log";

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchSettings(guildID: string): Promise<GuildSettingsDTO> {
  const res = await fetch(`/api/guilds/${guildID}/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

async function patchSettings(guildID: string, patch: Partial<GuildSettingsDTO>): Promise<GuildSettingsDTO> {
  const res = await fetch(`/api/guilds/${guildID}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

async function fetchSpamRules(guildID: string): Promise<SpamRuleDTO[]> {
  const res = await fetch(`/api/guilds/${guildID}/spam-rules`);
  if (!res.ok) throw new Error("Failed to fetch spam rules");
  return res.json();
}

async function patchSpamRule(guildID: string, id: string, patch: Partial<SpamRuleDTO>): Promise<SpamRuleDTO> {
  const res = await fetch(`/api/guilds/${guildID}/spam-rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update spam rule");
  return res.json();
}

async function deleteSpamRule(guildID: string, id: string): Promise<void> {
  await fetch(`/api/guilds/${guildID}/spam-rules/${id}`, { method: "DELETE" });
}

async function createSpamRule(guildID: string): Promise<SpamRuleDTO> {
  const res = await fetch(`/api/guilds/${guildID}/spam-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guildID,
      name: "Nouveau filtre",
      description: "",
      mode: "blacklist",
      channelIDs: [],
      messageLimit: 5,
      intervalInSec: 5,
      punishmentDurationInSec: 300,
      enabled: true,
    }),
  });
  if (!res.ok) throw new Error("Failed to create spam rule");
  return res.json();
}

// ── Shared controls ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.toggleTrack} />
      <span className={styles.toggleThumb} />
    </label>
  );
}

function ChannelSelect({
  channels,
  value,
  onChange,
  placeholder = "Non défini",
  allowEmpty = true,
}: {
  channels: ChannelEntry[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const textChannels = channels.filter(
    (c) => c.channelType === 0 || c.channelType === 5,
  );
  return (
    <select className={styles.channelSelect} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {textChannels.map((c) => (
        <option key={c.channelID} value={c.channelID}>
          {c.parentName ? `${c.parentName} › ` : ""}#{c.channelName}
        </option>
      ))}
    </select>
  );
}

function SettingRow({
  name,
  hint,
  children,
}: {
  name: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <div className={styles.rowName}>{name}</div>
        {hint && <div className={styles.rowHint}>{hint}</div>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

function formatSanctionDurationLabel(value: number | null): string {
  if (value === null) return "Jamais";
  const days = Math.round(value / 86_400_000);
  if (days <= 0) return "Jamais";
  if (days === 1) return "1 jour";
  return `${days} jours`;
}

// ── Stats section ────────────────────────────────────────────────────────────

function StatsSection({
  settings,
  channels,
  onPatch,
}: {
  settings: GuildSettingsDTO;
  channels: ChannelEntry[];
  onPatch: (patch: Partial<GuildSettingsDTO>) => void;
}) {
  const textChannels = channels.filter((c) => c.channelType === 0 || c.channelType === 5);

  return (
    <>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Statistiques</div>
        <div className={styles.sectionDesc}>Configurez ce qui est inclus dans les stats et les rapports automatiques.</div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Vocal</div>
        <SettingRow name="Inclure le temps casque coupé" hint="Compte le temps passé en vocal avec le micro désactivé">
          <Toggle
            checked={settings.statsCountDeafTime}
            onChange={(v) => onPatch({ statsCountDeafTime: v })}
          />
        </SettingRow>
        <SettingRow name="Classement préféré" hint="Critère principal pour le classement des membres">
          <select
            className={styles.select}
            value={settings.statsRankingPreference}
            onChange={(e) => onPatch({ statsRankingPreference: e.target.value as "voice" | "messages" })}
          >
            <option value="messages">Nombre de messages</option>
            <option value="voice">Temps vocal</option>
          </select>
        </SettingRow>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Rapport automatique</div>
        <SettingRow name="Fréquence d'envoi" hint="À quelle fréquence le rapport de stats est envoyé automatiquement">
          <select
            className={styles.select}
            value={settings.statsAutoFrequency}
            onChange={(e) => onPatch({ statsAutoFrequency: e.target.value as GuildSettingsDTO["statsAutoFrequency"] })}
          >
            <option value="disabled">Désactivé</option>
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire (lundi)</option>
            <option value="monthly">Mensuel (1er du mois)</option>
          </select>
        </SettingRow>
        <SettingRow name="Salon du rapport" hint="Le salon où le résumé automatique est envoyé">
          <ChannelSelect
            channels={channels}
            value={settings.statsReportChannelID}
            onChange={(v) => onPatch({ statsReportChannelID: v })}
            placeholder="Aucun salon"
          />
        </SettingRow>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Modération</div>
        <SettingRow
          name="Durée de validité des sanctions"
          hint="Durée pendant laquelle une sanction reste prise en compte pour la récidive. Laissez vide pour ne jamais expirer."
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className={styles.numberInput}
              type="number"
              min={0}
              step={1}
              value={settings.sanctionDurationMs === null ? "" : Math.round(settings.sanctionDurationMs / 86_400_000)}
              placeholder="∞"
              onChange={(e) => {
                const raw = e.target.value.trim();
                onPatch({
                  sanctionDurationMs: raw === "" || Number(raw) <= 0 ? null : Math.round(Number(raw)) * 86_400_000,
                });
              }}
            />
            <span className={`${styles.badge} ${styles.badgeEnabled}`}>
              {formatSanctionDurationLabel(settings.sanctionDurationMs)}
            </span>
          </div>
        </SettingRow>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Exclusions</div>
        <SettingRow
          name="Salons exclus"
          hint={`${settings.statsBlacklistChannelIDs.length} salon(s) exclu(s) des statistiques`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            {textChannels
              .filter((c) => settings.statsBlacklistChannelIDs.includes(c.channelID))
              .map((c) => (
                <div key={c.channelID} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    #{c.channelName}
                  </span>
                  <button
                    className={styles.btnDanger}
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() =>
                      onPatch({
                        statsBlacklistChannelIDs: settings.statsBlacklistChannelIDs.filter(
                          (id) => id !== c.channelID,
                        ),
                      })
                    }
                  >
                    Retirer
                  </button>
                </div>
              ))}
            <select
              className={styles.channelSelect}
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                if (settings.statsBlacklistChannelIDs.includes(e.target.value)) return;
                onPatch({ statsBlacklistChannelIDs: [...settings.statsBlacklistChannelIDs, e.target.value] });
              }}
            >
              <option value="">+ Ajouter un salon à exclure</option>
              {textChannels
                .filter((c) => !settings.statsBlacklistChannelIDs.includes(c.channelID))
                .map((c) => (
                  <option key={c.channelID} value={c.channelID}>
                    {c.parentName ? `${c.parentName} › ` : ""}#{c.channelName}
                  </option>
                ))}
            </select>
          </div>
        </SettingRow>
      </div>
    </>
  );
}

// ── Spam rule card ────────────────────────────────────────────────────────────

function SpamRuleCard({
  rule,
  channels,
  onUpdate,
  onDelete,
}: {
  rule: SpamRuleDTO;
  channels: ChannelEntry[];
  onUpdate: (patch: Partial<SpamRuleDTO>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const textChannels = channels.filter((c) => c.channelType === 0 || c.channelType === 5);

  return (
    <div className={styles.ruleCard}>
      <div className={styles.ruleHeader} onClick={() => setOpen((v) => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.ruleHeaderName}>{rule.name}</div>
          {rule.description && <div className={styles.ruleHeaderDesc}>{rule.description}</div>}
        </div>
        <span className={`${styles.badge} ${rule.enabled ? styles.badgeEnabled : styles.badgeDisabled}`}>
          {rule.enabled ? "Actif" : "Inactif"}
        </span>
        <svg
          className={`${styles.ruleChevron} ${open ? styles.open : ""}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className={`${styles.ruleBodyWrapper} ${open ? styles.ruleBodyWrapperOpen : ""}`}>
        <div className={styles.ruleBodyInner}>
          <div className={styles.ruleBody}>
            <SettingRow name="Activé">
              <Toggle checked={rule.enabled} onChange={(v) => onUpdate({ enabled: v })} />
            </SettingRow>

            <SettingRow name="Nom du filtre">
              <input
                className={styles.numberInput}
                style={{ width: 180, textAlign: "left" }}
                value={rule.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
            </SettingRow>

            <SettingRow name="Description">
              <input
                className={styles.numberInput}
                style={{ width: 220, textAlign: "left" }}
                value={rule.description}
                placeholder="Optionnel"
                onChange={(e) => onUpdate({ description: e.target.value })}
              />
            </SettingRow>

            <SettingRow
              name="Mode"
              hint={
                rule.mode === "blacklist"
                  ? "Les salons listés sont concernés par ce filtre"
                  : "Seuls les salons listés sont exemptés de ce filtre"
              }
            >
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeToggleBtn} ${rule.mode === "blacklist" ? styles.selected : ""}`}
                  onClick={() => onUpdate({ mode: "blacklist" })}
                >
                  Blacklist
                </button>
                <button
                  className={`${styles.modeToggleBtn} ${rule.mode === "whitelist" ? styles.selected : ""}`}
                  onClick={() => onUpdate({ mode: "whitelist" })}
                >
                  Whitelist
                </button>
              </div>
            </SettingRow>

            <SettingRow name="Limite de messages" hint="Nombre de messages max dans l'intervalle">
              <input
                type="number"
                min={1}
                className={styles.numberInput}
                value={rule.messageLimit}
                onChange={(e) => onUpdate({ messageLimit: Number(e.target.value) })}
              />
            </SettingRow>

            <SettingRow name="Intervalle (secondes)" hint="Fenêtre de temps pour comptabiliser les messages">
              <input
                type="number"
                min={1}
                className={styles.numberInput}
                value={rule.intervalInSec}
                onChange={(e) => onUpdate({ intervalInSec: Number(e.target.value) })}
              />
            </SettingRow>

            <SettingRow name="Durée du timeout (secondes)" hint="Durée du mute appliqué en cas d'infraction">
              <input
                type="number"
                min={1}
                className={styles.numberInput}
                value={rule.punishmentDurationInSec}
                onChange={(e) => onUpdate({ punishmentDurationInSec: Number(e.target.value) })}
              />
            </SettingRow>

            <SettingRow
              name="Salons concernés"
              hint={`${rule.channelIDs.length} salon(s) · mode ${rule.mode === "blacklist" ? "blacklist" : "whitelist"}`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                {textChannels
                  .filter((c) => rule.channelIDs.includes(c.channelID))
                  .map((c) => (
                    <div key={c.channelID} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        #{c.channelName}
                      </span>
                      <button
                        className={styles.btnDanger}
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => onUpdate({ channelIDs: rule.channelIDs.filter((id) => id !== c.channelID) })}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                <select
                  className={styles.channelSelect}
                  value=""
                  onChange={(e) => {
                    if (!e.target.value || rule.channelIDs.includes(e.target.value)) return;
                    onUpdate({ channelIDs: [...rule.channelIDs, e.target.value] });
                  }}
                >
                  <option value="">+ Ajouter un salon</option>
                  {textChannels
                    .filter((c) => !rule.channelIDs.includes(c.channelID))
                    .map((c) => (
                      <option key={c.channelID} value={c.channelID}>
                        {c.parentName ? `${c.parentName} › ` : ""}#{c.channelName}
                      </option>
                    ))}
                </select>
              </div>
            </SettingRow>
          </div>

          <div className={styles.ruleActions}>
            <button className={styles.btnDanger} onClick={onDelete}>
              Supprimer ce filtre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spam section ─────────────────────────────────────────────────────────────

function SpamSection({
  guildID,
  channels,
}: {
  guildID: string;
  channels: ChannelEntry[];
}) {
  const [rules, setRules] = useState<SpamRuleDTO[] | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetchSpamRules(guildID).then(setRules).catch(() => setRules([]));
  }, [guildID]);

  function scheduleRuleSave(rule: SpamRuleDTO) {
    clearTimeout(saveTimers.current[rule.id]);
    saveTimers.current[rule.id] = setTimeout(async () => {
      setSaving((s) => ({ ...s, [rule.id]: true }));
      try {
        const updated = await patchSpamRule(guildID, rule.id, rule);
        setRules((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
      } finally {
        setSaving((s) => ({ ...s, [rule.id]: false }));
      }
    }, 600);
  }

  function handleUpdate(id: string, patch: Partial<SpamRuleDTO>) {
    setRules((prev) => {
      if (!prev) return prev;
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const updated = next.find((r) => r.id === id);
      if (updated) scheduleRuleSave(updated);
      return next;
    });
  }

  async function handleDelete(id: string) {
    await deleteSpamRule(guildID, id);
    setRules((prev) => prev?.filter((r) => r.id !== id) ?? null);
  }

  async function handleCreate() {
    const rule = await createSpamRule(guildID);
    setRules((prev) => [...(prev ?? []), rule]);
  }

  if (rules === null) return <div className={styles.loading}>Chargement…</div>;

  return (
    <>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Anti-Spam</div>
        <div className={styles.sectionDesc}>
          Créez et configurez des filtres anti-spam. Chaque filtre peut cibler des salons spécifiques.
        </div>
      </div>

      {rules.length === 0 && (
        <div className={styles.empty}>Aucun filtre anti-spam configuré.</div>
      )}

      <div className={styles.ruleList}>
        {rules.map((rule) => (
          <SpamRuleCard
            key={rule.id}
            rule={rule}
            channels={channels}
            onUpdate={(patch) => handleUpdate(rule.id, patch)}
            onDelete={() => handleDelete(rule.id)}
          />
        ))}
      </div>

      <button className={styles.btnPrimary} onClick={handleCreate}>
        + Nouveau filtre
      </button>

      {Object.values(saving).some(Boolean) && (
        <div className={styles.saveBar}>
          <span className={styles.saveBarText}>Sauvegarde en cours…</span>
        </div>
      )}
    </>
  );
}

// ── Invite Log section ───────────────────────────────────────────────────────

function InviteLogSection({
  settings,
  channels,
  onPatch,
}: {
  settings: GuildSettingsDTO;
  channels: ChannelEntry[];
  onPatch: (patch: Partial<GuildSettingsDTO>) => void;
}) {
  return (
    <>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Invite Log</div>
        <div className={styles.sectionDesc}>
          Quand un membre rejoint ou quitte le serveur, un message est envoyé dans le salon configuré,
          indiquant qui l'a invité.
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>Configuration</div>
        <SettingRow
          name="Salon de log"
          hint="Le salon où les arrivées et départs sont enregistrés"
        >
          <ChannelSelect
            channels={channels}
            value={settings.inviteLogChannelID}
            onChange={(v) => onPatch({ inviteLogChannelID: v })}
            placeholder="Désactivé"
          />
        </SettingRow>
      </div>

      {settings.inviteLogChannelID && (
        <div className={styles.group}>
          <div className={styles.groupTitle}>Statut</div>
          <SettingRow name="Actif">
            <span className={`${styles.badge} ${styles.badgeEnabled}`}>Activé</span>
          </SettingRow>
        </div>
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function SettingsInner() {
  const searchParams = useSearchParams();
  const guildID = searchParams.get("guild") ?? "";

  const [section, setSection] = useState<Section>("stats");
  const [settings, setSettings] = useState<GuildSettingsDTO | null>(null);
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!guildID) return;
    setSettings(null);
    Promise.all([
      fetchSettings(guildID),
      fetch(`/api/guilds/${guildID}/all-channels`).then((r) => r.json() as Promise<ChannelEntry[]>),
    ]).then(([s, c]) => {
      setSettings(s);
      setChannels(c);
    });
  }, [guildID]);

  const handlePatch = useCallback(
    (patch: Partial<GuildSettingsDTO>) => {
      if (!settings) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      setSaveStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await patchSettings(guildID, patch);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }, 600);
    },
    [settings, guildID],
  );

  if (!guildID) {
    return <div className={styles.loading}>Sélectionnez un serveur dans la barre de navigation.</div>;
  }

  if (!settings) {
    return <div className={styles.loading}>Chargement des paramètres…</div>;
  }

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    {
      id: "stats",
      label: "Statistiques",
      icon: (
        <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      id: "spam",
      label: "Anti-Spam",
      icon: (
        <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      ),
    },
    {
      id: "invite-log",
      label: "Invite Log",
      icon: (
        <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>Paramètres</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.sidebarItem} ${section === item.id ? styles.active : ""}`}
            onClick={() => setSection(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </aside>

      <main className={styles.content} key={section}>
        {section === "stats" && (
          <StatsSection settings={settings} channels={channels} onPatch={handlePatch} />
        )}
        {section === "spam" && (
          <SpamSection guildID={guildID} channels={channels} />
        )}
        {section === "invite-log" && (
          <InviteLogSection settings={settings} channels={channels} onPatch={handlePatch} />
        )}
      </main>

      {saveStatus !== "idle" && (
        <div className={styles.saveBar}>
          <span className={styles.saveBarText}>
            {saveStatus === "saving" ? "Sauvegarde en cours…" : "✓ Paramètres sauvegardés"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "var(--text-muted)" }}>Chargement…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
