"use client";

import { EmptyState, LoadingState, NumberField, SelectField, StatusBadge, ToggleField } from "@/components/ui";
import type { ChannelEntry } from "@/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import styles from "@/app/settings/Settings.module.css";
import { useAutoResponses, useChannelRules, useGuildSettings, useSpamRules } from "./hooks";
import { fetchRoles } from "./api";
import type { RoleEntry } from "@/services/discordMetaService";
import type { AutoResponseDTO, GuildSettingsDTO, SettingsSection, SpamRuleDTO, TriggerGroup } from "./types";

function ChannelSelect({
  channels,
  value,
  onChange,
  placeholder = "Non défini",
  allowEmpty = true,
}: Readonly<{
  channels: ChannelEntry[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}>) {
  const textChannels = channels.filter((channel) => channel.channelType === 0 || channel.channelType === 5);
  return (
    <SelectField className={styles.channelSelect} value={value} onChange={onChange}>
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {textChannels.map((channel) => (
        <option key={channel.channelID} value={channel.channelID}>
          {channel.parentName ? `${channel.parentName} › ` : ""}#{channel.channelName}
        </option>
      ))}
    </SelectField>
  );
}

function formatSanctionDurationLabel(value: number | null): string {
  if (value === null) return "Jamais";
  const days = Math.round(value / 86_400_000);
  if (days <= 0) return "Jamais";
  return days === 1 ? "1 jour" : `${days} jours`;
}

function SettingsGroup({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className={styles.group}>
      <div className={styles.groupTitle}>{title}</div>
      {children}
    </section>
  );
}

function SettingRow({
  name,
  hint,
  compactControl = false,
  children,
}: Readonly<{
  name: string;
  hint?: string;
  compactControl?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div className={`${styles.row} ${compactControl ? styles.rowCompactControl : ""}`}>
      <div className={styles.rowLabel}>
        <div className={styles.rowName}>{name}</div>
        {hint ? <div className={styles.rowHint}>{hint}</div> : null}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionDesc}>{description}</div>
    </div>
  );
}

function ChannelTokenList({
  channelIDs,
  channels,
  onRemove,
  onAdd,
  addLabel,
}: Readonly<{
  channelIDs: string[];
  channels: ChannelEntry[];
  onRemove: (channelID: string) => void;
  onAdd: (channelID: string) => void;
  addLabel: string;
}>) {
  const textChannels = channels.filter((channel) => channel.channelType === 0 || channel.channelType === 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      {textChannels.filter((channel) => channelIDs.includes(channel.channelID)).map((channel) => (
        <div key={channel.channelID} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>#{channel.channelName}</span>
          <button className={styles.btnDanger} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => onRemove(channel.channelID)}>
            Retirer
          </button>
        </div>
      ))}
      <SelectField className={styles.channelSelect} value="" onChange={(value) => value && !channelIDs.includes(value) && onAdd(value)}>
        <option value="">{addLabel}</option>
        {textChannels.filter((channel) => !channelIDs.includes(channel.channelID)).map((channel) => (
          <option key={channel.channelID} value={channel.channelID}>
            {channel.parentName ? `${channel.parentName} › ` : ""}#{channel.channelName}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function StatsSection({
  settings,
  channels,
  onPatch,
}: Readonly<{
  settings: GuildSettingsDTO;
  channels: ChannelEntry[];
  onPatch: (patch: Partial<GuildSettingsDTO>) => void;
}>) {
  return (
    <>
      <SectionHeader title="Statistiques" description="Configurez ce qui est inclus dans les stats et les rapports automatiques." />
      <SettingsGroup title="Vocal">
        <SettingRow compactControl name="Inclure le temps casque coupé" hint="Compte le temps passé en vocal avec le micro désactivé">
          <ToggleField checked={settings.statsCountDeafTime} onChange={(value) => onPatch({ statsCountDeafTime: value })} />
        </SettingRow>
        <SettingRow name="Classement préféré" hint="Critère principal pour le classement des membres">
          <SelectField className={styles.channelSelect} value={settings.statsRankingPreference} onChange={(value) => onPatch({ statsRankingPreference: value as "voice" | "messages" })}>
            <option value="messages">Nombre de messages</option>
            <option value="voice">Temps vocal</option>
          </SelectField>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Rapport automatique">
        <SettingRow name="Fréquence d'envoi" hint="À quelle fréquence le rapport de stats est envoyé automatiquement">
          <SelectField className={styles.channelSelect} value={settings.statsAutoFrequency} onChange={(value) => onPatch({ statsAutoFrequency: value as GuildSettingsDTO["statsAutoFrequency"] })}>
            <option value="disabled">Désactivé</option>
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire (lundi)</option>
            <option value="monthly">Mensuel (1er du mois)</option>
          </SelectField>
        </SettingRow>
        <SettingRow name="Salon du rapport" hint="Le salon où le résumé automatique est envoyé">
          <ChannelSelect channels={channels} value={settings.statsReportChannelID} onChange={(value) => onPatch({ statsReportChannelID: value })} placeholder="Aucun salon" />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Exclusions">
        <SettingRow name="Salons exclus" hint={`${settings.statsBlacklistChannelIDs.length} salon(s) exclu(s) des statistiques`}>
          <ChannelTokenList
            channelIDs={settings.statsBlacklistChannelIDs}
            channels={channels}
            onRemove={(channelID) => onPatch({ statsBlacklistChannelIDs: settings.statsBlacklistChannelIDs.filter((id) => id !== channelID) })}
            onAdd={(channelID) => onPatch({ statsBlacklistChannelIDs: [...settings.statsBlacklistChannelIDs, channelID] })}
            addLabel="+ Ajouter un salon à exclure"
          />
        </SettingRow>
      </SettingsGroup>
    </>
  );
}

function SpamRuleCard({
  rule,
  channels,
  onUpdate,
  onDelete,
}: Readonly<{
  rule: SpamRuleDTO;
  channels: ChannelEntry[];
  onUpdate: (patch: Partial<SpamRuleDTO>) => void;
  onDelete: () => void;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.ruleCard}>
      <div className={styles.ruleHeader} onClick={() => setOpen((value) => !value)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.ruleHeaderName}>{rule.name}</div>
          {rule.description ? <div className={styles.ruleHeaderDesc}>{rule.description}</div> : null}
        </div>
        <StatusBadge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Actif" : "Inactif"}</StatusBadge>
        <svg className={`${styles.ruleChevron} ${open ? styles.open : ""}`} viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={`${styles.ruleBodyWrapper} ${open ? styles.ruleBodyWrapperOpen : ""}`}>
        <div className={styles.ruleBodyInner}>
          <div className={styles.ruleBody}>
            <SettingRow compactControl name="Activé"><ToggleField checked={rule.enabled} onChange={(value) => onUpdate({ enabled: value })} /></SettingRow>
            <SettingRow name="Nom du filtre"><input className={styles.numberInput} style={{ width: 180, textAlign: "left" }} value={rule.name} onChange={(event) => onUpdate({ name: event.target.value })} /></SettingRow>
            <SettingRow name="Description"><input className={styles.numberInput} style={{ width: 220, textAlign: "left" }} value={rule.description} placeholder="Optionnel" onChange={(event) => onUpdate({ description: event.target.value })} /></SettingRow>
            <SettingRow name="Mode" hint={rule.mode === "blacklist" ? "Les salons listés sont concernés par ce filtre" : "Seuls les salons listés sont exemptés de ce filtre"}>
              <div className={styles.modeToggle}>
                <button className={`${styles.modeToggleBtn} ${rule.mode === "blacklist" ? styles.selected : ""}`} onClick={() => onUpdate({ mode: "blacklist" })}>Blacklist</button>
                <button className={`${styles.modeToggleBtn} ${rule.mode === "whitelist" ? styles.selected : ""}`} onClick={() => onUpdate({ mode: "whitelist" })}>Whitelist</button>
              </div>
            </SettingRow>
            <SettingRow name="Limite de messages" hint="Nombre de messages max dans l'intervalle"><NumberField value={rule.messageLimit} min={1} onChange={(value) => onUpdate({ messageLimit: Number(value) })} /></SettingRow>
            <SettingRow name="Intervalle (secondes)" hint="Fenêtre de temps pour comptabiliser les messages"><NumberField value={rule.intervalInSec} min={1} onChange={(value) => onUpdate({ intervalInSec: Number(value) })} /></SettingRow>
            <SettingRow name="Durée du timeout (secondes)" hint="Durée du mute appliqué en cas d'infraction"><NumberField value={rule.punishmentDurationInSec} min={1} onChange={(value) => onUpdate({ punishmentDurationInSec: Number(value) })} /></SettingRow>
            <SettingRow name="Salons concernés" hint={`${rule.channelIDs.length} salon(s) · mode ${rule.mode}`}>
              <ChannelTokenList
                channelIDs={rule.channelIDs}
                channels={channels}
                onRemove={(channelID) => onUpdate({ channelIDs: rule.channelIDs.filter((id) => id !== channelID) })}
                onAdd={(channelID) => onUpdate({ channelIDs: [...rule.channelIDs, channelID] })}
                addLabel="+ Ajouter un salon"
              />
            </SettingRow>
          </div>
          <div className={styles.ruleActions}>
            <button className={styles.btnDanger} onClick={onDelete}>Supprimer ce filtre</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpamSection({ guildID, channels }: Readonly<{ guildID: string; channels: ChannelEntry[] }>) {
  const spam = useSpamRules(guildID);
  if (spam.rules === null) return <LoadingState label="Chargement des filtres anti-spam…" />;

  return (
    <>
      <SectionHeader title="Anti-Spam" description="Créez et configurez des filtres anti-spam. Chaque filtre peut cibler des salons spécifiques." />
      {spam.rules.length === 0 ? <EmptyState title="Aucun filtre anti-spam configuré." /> : null}
      <div className={styles.ruleList}>
        {spam.rules.map((rule) => (
          <SpamRuleCard key={rule.id} rule={rule} channels={channels} onUpdate={(patch) => spam.updateRule(rule.id, patch)} onDelete={() => spam.removeRule(rule.id)} />
        ))}
      </div>
      <button className={styles.btnPrimary} onClick={spam.addRule}>+ Nouveau filtre</button>
      {Object.values(spam.saving).some(Boolean) ? <div className={styles.saveBar}><span className={styles.saveBarText}>Sauvegarde en cours…</span></div> : null}
    </>
  );
}

function RoleSelect({
  roles,
  value,
  onChange,
  placeholder = "Non défini",
}: Readonly<{
  roles: RoleEntry[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>) {
  return (
    <SelectField className={styles.channelSelect} value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {roles.map((role) => (
        <option key={role.roleID} value={role.roleID}>
          @{role.roleName}
        </option>
      ))}
    </SelectField>
  );
}

function ModerationSection({
  settings,
  channels,
  onPatch,
}: Readonly<{
  settings: GuildSettingsDTO;
  channels: ChannelEntry[];
  onPatch: (patch: Partial<GuildSettingsDTO>) => void;
}>) {
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const guildID = settings.guildID;

  useEffect(() => {
    if (!guildID) return;
    fetchRoles(guildID).then(setRoles).catch(() => setRoles([]));
  }, [guildID]);

  return (
    <>
      <SectionHeader
        title="Modération"
        description="Configurez le salon de notifications et le rôle à mentionner pour les opérations nécessitant une intervention humaine (appels, contestations)."
      />
      <SettingsGroup title="Sanctions">
        <SettingRow name="Durée de validité des sanctions" hint="Durée pendant laquelle une sanction reste prise en compte pour la récidive. Laissez vide pour ne jamais expirer.">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NumberField
              value={settings.sanctionDurationMs === null ? "" : Math.round(settings.sanctionDurationMs / 86_400_000)}
              min={0}
              placeholder="∞"
              onChange={(value) => {
                const raw = value.trim();
                onPatch({ sanctionDurationMs: raw === "" || Number(raw) <= 0 ? null : Math.round(Number(raw)) * 86_400_000 });
              }}
            />
            <StatusBadge tone="success">{formatSanctionDurationLabel(settings.sanctionDurationMs)}</StatusBadge>
          </div>
        </SettingRow>
        <SettingRow
          name="Limite de signalements par jour"
          hint="Nombre maximal de signalements qu'un utilisateur peut déposer par jour avant blocage"
        >
          <NumberField
            value={settings.reportDailyLimit}
            min={1}
            onChange={(value) => onPatch({ reportDailyLimit: Math.max(1, Number(value) || 1) })}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Notifications">
        <SettingRow
          name="Salon de notifications"
          hint="Les alertes d'appels et de contestations sont envoyées dans ce salon"
        >
          <ChannelSelect
            channels={channels}
            value={settings.moderationNotifChannelID}
            onChange={(value) => onPatch({ moderationNotifChannelID: value })}
            placeholder="Désactivé"
          />
        </SettingRow>
        <SettingRow
          name="Rôle à mentionner"
          hint="Ce rôle sera mentionné dans les notifications pour alerter les modérateurs"
        >
          <RoleSelect
            roles={roles}
            value={settings.moderationModRoleID}
            onChange={(value) => onPatch({ moderationModRoleID: value })}
            placeholder="Aucune mention"
          />
        </SettingRow>
      </SettingsGroup>
      {settings.moderationNotifChannelID ? (
        <SettingsGroup title="Statut">
          <SettingRow name="Notifications actives"><StatusBadge tone="success">Activé</StatusBadge></SettingRow>
        </SettingsGroup>
      ) : null}
    </>
  );
}

function InviteLogSection({
  settings,
  channels,
  onPatch,
}: Readonly<{
  settings: GuildSettingsDTO;
  channels: ChannelEntry[];
  onPatch: (patch: Partial<GuildSettingsDTO>) => void;
}>) {
  return (
    <>
      <SectionHeader title="Invite Log" description="Quand un membre rejoint ou quitte le serveur, un message est envoyé dans le salon configuré, indiquant qui l'a invité." />
      <SettingsGroup title="Configuration">
        <SettingRow name="Salon de log" hint="Le salon où les arrivées et départs sont enregistrés">
          <ChannelSelect channels={channels} value={settings.inviteLogChannelID} onChange={(value) => onPatch({ inviteLogChannelID: value })} placeholder="Désactivé" />
        </SettingRow>
      </SettingsGroup>
      {settings.inviteLogChannelID ? (
        <SettingsGroup title="Statut">
          <SettingRow name="Actif"><StatusBadge tone="success">Activé</StatusBadge></SettingRow>
        </SettingsGroup>
      ) : null}
    </>
  );
}

function StarboardSection({
  settings,
  channels,
  onPatch,
}: Readonly<{
  settings: GuildSettingsDTO;
  channels: ChannelEntry[];
  onPatch: (patch: Partial<GuildSettingsDTO>) => void;
}>) {
  const active = !!(settings.starboardChannelID && settings.starboardEmoji);
  return (
    <>
      <SectionHeader
        title="Starboard"
        description="Quand un message reçoit suffisamment de réactions avec l'emoji configuré, il est automatiquement transféré dans le salon starboard."
      />
      <SettingsGroup title="Configuration">
        <SettingRow name="Salon starboard" hint="Le salon où les messages populaires sont transférés">
          <ChannelSelect
            channels={channels}
            value={settings.starboardChannelID}
            onChange={(value) => onPatch({ starboardChannelID: value })}
            placeholder="Désactivé"
          />
        </SettingRow>
        <SettingRow name="Emoji" hint="L'emoji à surveiller (ex: ⭐ ou un emoji personnalisé)">
          <input
            className={styles.numberInput}
            style={{ width: 120, textAlign: "left" }}
            value={settings.starboardEmoji}
            placeholder="⭐"
            onChange={(e) => onPatch({ starboardEmoji: e.target.value })}
          />
        </SettingRow>
        <SettingRow name="Seuil de réactions" hint="Nombre de réactions requis pour transférer le message">
          <NumberField
            value={settings.starboardThreshold}
            min={1}
            onChange={(value) => onPatch({ starboardThreshold: Number(value) })}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Statut">
        <SettingRow name="État">
          <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Actif" : "Inactif"}</StatusBadge>
        </SettingRow>
      </SettingsGroup>
    </>
  );
}

function ChannelRuleCard({
  rule,
  channels,
  onUpdate,
  onDelete,
}: Readonly<{
  rule: { channelID: string; autoThread: boolean; oneMessageLimit: boolean };
  channels: ChannelEntry[];
  onUpdate: (patch: { autoThread?: boolean; oneMessageLimit?: boolean }) => void;
  onDelete: () => void;
}>) {
  const channel = channels.find((c) => c.channelID === rule.channelID);
  const channelLabel = channel ? `${channel.parentName ? `${channel.parentName} › ` : ""}#${channel.channelName}` : `#${rule.channelID}`;
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.ruleCard}>
      <div className={styles.ruleHeader} onClick={() => setOpen((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.ruleHeaderName}>{channelLabel}</div>
        </div>
        <svg className={`${styles.ruleChevron} ${open ? styles.open : ""}`} viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={`${styles.ruleBodyWrapper} ${open ? styles.ruleBodyWrapperOpen : ""}`}>
        <div className={styles.ruleBodyInner}>
          <div className={styles.ruleBody}>
            <SettingRow compactControl name="Message unique" hint="Supprime les messages précédents quand un membre envoie un nouveau message dans ce salon">
              <ToggleField checked={rule.oneMessageLimit} onChange={(value) => onUpdate({ oneMessageLimit: value })} />
            </SettingRow>
            <SettingRow compactControl name="Créer un fil automatiquement" hint="Crée un fil de discussion pour chaque nouveau message">
              <ToggleField checked={rule.autoThread} onChange={(value) => onUpdate({ autoThread: value })} />
            </SettingRow>
          </div>
          <div className={styles.ruleActions}>
            <button className={styles.btnDanger} onClick={onDelete}>Retirer ce salon</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-réponses
// ---------------------------------------------------------------------------

function TriggerGroupEditor({
  group,
  index,
  onChange,
  onRemove,
}: Readonly<{
  group: TriggerGroup;
  index: number;
  onChange: (g: TriggerGroup) => void;
  onRemove: () => void;
}>) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".04em" }}>
          {index === 0 ? "Si…" : "OU si…"}
        </span>
        <button className={styles.btnDanger} style={{ padding: "3px 10px", fontSize: 12 }} onClick={onRemove}>Supprimer</button>
      </div>

      <SettingRow compactControl name="Mots-clés" hint="Séparés par des virgules (ex: bonjour, salut)">
        <input
          className={styles.numberInput}
          style={{ width: 200, textAlign: "left" }}
          value={group.keywords.join(", ")}
          placeholder="mot1, mot2…"
          onChange={(e) => onChange({ ...group, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </SettingRow>

      {group.keywords.length > 1 && (
        <SettingRow compactControl name="Logique mots-clés" hint="Comment combiner les mots-clés entre eux (ET / OU)">
          <div className={styles.modeToggle}>
            <button className={`${styles.modeToggleBtn} ${group.keywordMode === "any" ? styles.selected : ""}`} onClick={() => onChange({ ...group, keywordMode: "any" })}>OU</button>
            <button className={`${styles.modeToggleBtn} ${group.keywordMode === "all" ? styles.selected : ""}`} onClick={() => onChange({ ...group, keywordMode: "all" })}>ET</button>
          </div>
        </SettingRow>
      )}

      <SettingRow compactControl name="Expression régulière" hint="Regex testée sur le contenu du message (ex: ^bonjour)">
        <input
          className={styles.numberInput}
          style={{ width: 200, textAlign: "left" }}
          value={group.regex ?? ""}
          placeholder="^bonjour.*"
          onChange={(e) => onChange({ ...group, regex: e.target.value.trim() || null })}
        />
      </SettingRow>

      <SettingRow compactControl name="Pièce jointe" hint="Filtrer selon la présence d'une pièce jointe">
        <SelectField
          className={styles.channelSelect}
          value={group.hasAttachment === null ? "any" : group.hasAttachment ? "yes" : "no"}
          onChange={(v) => onChange({ ...group, hasAttachment: v === "any" ? null : v === "yes" })}
        >
          <option value="any">Peu importe</option>
          <option value="yes">Avec pièce jointe</option>
          <option value="no">Sans pièce jointe</option>
        </SelectField>
      </SettingRow>
    </div>
  );
}

function AutoResponseCard({
  rule,
  channels,
  onUpdate,
  onDelete,
}: Readonly<{
  rule: AutoResponseDTO;
  channels: ChannelEntry[];
  onUpdate: (patch: Partial<AutoResponseDTO>) => void;
  onDelete: () => void;
}>) {
  const [open, setOpen] = useState(false);

  function updateGroup(index: number, group: TriggerGroup) {
    const next = rule.triggerGroups.map((g, i) => i === index ? group : g);
    onUpdate({ triggerGroups: next });
  }

  function addGroup() {
    onUpdate({
      triggerGroups: [...rule.triggerGroups, { keywords: [], keywordMode: "any", regex: null, hasAttachment: null }],
    });
  }

  function removeGroup(index: number) {
    onUpdate({ triggerGroups: rule.triggerGroups.filter((_, i) => i !== index) });
  }

  return (
    <div className={styles.ruleCard}>
      <div className={styles.ruleHeader} onClick={() => setOpen((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.ruleHeaderName}>{rule.name}</div>
          <div className={styles.ruleHeaderDesc}>
            {rule.triggerGroups.length === 0 ? "Aucun déclencheur" : `${rule.triggerGroups.length} groupe(s) de déclencheur`}
            {rule.responseEmojis.length > 0 ? ` · ${rule.responseEmojis.join(" ")}` : ""}
            {rule.responseMessage ? " · message" : ""}
          </div>
        </div>
        <StatusBadge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Actif" : "Inactif"}</StatusBadge>
        <svg className={`${styles.ruleChevron} ${open ? styles.open : ""}`} viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className={`${styles.ruleBodyWrapper} ${open ? styles.ruleBodyWrapperOpen : ""}`}>
        <div className={styles.ruleBodyInner}>
          <div className={styles.ruleBody}>
            <SettingRow compactControl name="Activé"><ToggleField checked={rule.enabled} onChange={(v) => onUpdate({ enabled: v })} /></SettingRow>
            <SettingRow name="Nom"><input className={styles.numberInput} style={{ width: 200, textAlign: "left" }} value={rule.name} onChange={(e) => onUpdate({ name: e.target.value })} /></SettingRow>

            {/* Trigger groups */}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Déclencheurs</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Chaque groupe est combiné en OU. À l&apos;intérieur d&apos;un groupe, toutes les conditions sont en ET.
              </div>
              {rule.triggerGroups.map((group, i) => (
                <TriggerGroupEditor key={i} group={group} index={i} onChange={(g) => updateGroup(i, g)} onRemove={() => removeGroup(i)} />
              ))}
              <button className={styles.btnPrimary} style={{ alignSelf: "flex-start", fontSize: 12, padding: "4px 12px" }} onClick={addGroup}>
                + Ajouter un groupe de déclencheur
              </button>
            </div>

            {/* Channel scoping */}
            <SettingRow name="Salons ciblés" hint="Tous les salons, whitelist ou blacklist">
              <div className={styles.modeToggle}>
                <button className={`${styles.modeToggleBtn} ${rule.channelMode === "all" ? styles.selected : ""}`} onClick={() => onUpdate({ channelMode: "all" })}>Tous</button>
                <button className={`${styles.modeToggleBtn} ${rule.channelMode === "whitelist" ? styles.selected : ""}`} onClick={() => onUpdate({ channelMode: "whitelist" })}>Whitelist</button>
                <button className={`${styles.modeToggleBtn} ${rule.channelMode === "blacklist" ? styles.selected : ""}`} onClick={() => onUpdate({ channelMode: "blacklist" })}>Blacklist</button>
              </div>
            </SettingRow>

            {rule.channelMode !== "all" && (
              <SettingRow name={rule.channelMode === "whitelist" ? "Salons autorisés" : "Salons exclus"} hint={`${rule.channelIDs.length} salon(s) · mode ${rule.channelMode}`}>
                <ChannelTokenList
                  channelIDs={rule.channelIDs}
                  channels={channels}
                  onRemove={(id) => onUpdate({ channelIDs: rule.channelIDs.filter((c) => c !== id) })}
                  onAdd={(id) => onUpdate({ channelIDs: [...rule.channelIDs, id] })}
                  addLabel="+ Ajouter un salon"
                />
              </SettingRow>
            )}

            {/* Actions */}
            <SettingRow name="Emojis de réaction" hint="Emojis ajoutés en réaction au message (un par ligne)">
              <textarea
                className={styles.numberInput}
                style={{ width: 160, textAlign: "left", resize: "vertical", minHeight: 60 }}
                value={rule.responseEmojis.join("\n")}
                placeholder="⭐&#10;👍"
                onChange={(e) => onUpdate({ responseEmojis: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              />
            </SettingRow>

            <SettingRow name="Message de réponse" hint="Laissez vide pour ne pas envoyer de message">
              <textarea
                className={styles.numberInput}
                style={{ width: 220, textAlign: "left", resize: "vertical", minHeight: 60 }}
                value={rule.responseMessage ?? ""}
                placeholder="Votre message…"
                onChange={(e) => onUpdate({ responseMessage: e.target.value.trim() || null })}
              />
            </SettingRow>

            {rule.responseMessage && (
              <SettingRow compactControl name="Mode d'envoi" hint="Répondre au message ou envoyer dans le salon">
                <div className={styles.modeToggle}>
                  <button className={`${styles.modeToggleBtn} ${rule.responseReply ? styles.selected : ""}`} onClick={() => onUpdate({ responseReply: true })}>Reply</button>
                  <button className={`${styles.modeToggleBtn} ${!rule.responseReply ? styles.selected : ""}`} onClick={() => onUpdate({ responseReply: false })}>Standalone</button>
                </div>
              </SettingRow>
            )}
          </div>
          <div className={styles.ruleActions}>
            <button className={styles.btnDanger} onClick={onDelete}>Supprimer cette règle</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutoResponsesSection({ guildID, channels }: Readonly<{ guildID: string; channels: ChannelEntry[] }>) {
  const { rules, saving, updateRule, addRule, removeRule } = useAutoResponses(guildID);
  if (rules === null) return <LoadingState label="Chargement des règles…" />;

  return (
    <>
      <SectionHeader
        title="Auto-réponses"
        description="Définissez des règles qui déclenchent automatiquement une réaction ou un message selon des conditions complexes (mots-clés, regex, pièces jointes)."
      />
      {rules.length === 0 ? <EmptyState title="Aucune règle d'auto-réponse configurée." /> : null}
      <div className={styles.ruleList}>
        {rules.map((rule) => (
          <AutoResponseCard key={rule.id} rule={rule} channels={channels} onUpdate={(patch) => updateRule(rule.id, patch)} onDelete={() => removeRule(rule.id)} />
        ))}
      </div>
      <button className={styles.btnPrimary} onClick={addRule}>+ Nouvelle règle</button>
      {Object.values(saving).some(Boolean) ? <div className={styles.saveBar}><span className={styles.saveBarText}>Sauvegarde en cours…</span></div> : null}
    </>
  );
}

function ChannelsSection({ guildID, channels }: Readonly<{ guildID: string; channels: ChannelEntry[] }>) {
  const { rules, saving, updateRule, removeRule } = useChannelRules(guildID);
  const configuredChannelIDs = rules?.map((r) => r.channelID) ?? [];
  const textChannels = channels.filter((c) => c.channelType === 0 || c.channelType === 5);
  const availableChannels = textChannels.filter((c) => !configuredChannelIDs.includes(c.channelID));

  if (rules === null) return <LoadingState label="Chargement des règles de salon…" />;

  return (
    <>
      <SectionHeader title="Salons" description="Configurez des règles par salon : message unique, fils automatiques." />
      {rules.length === 0 ? <EmptyState title="Aucune règle de salon configurée." /> : null}
      <div className={styles.ruleList}>
        {rules.map((rule) => (
          <ChannelRuleCard
            key={rule.channelID}
            rule={rule}
            channels={channels}
            onUpdate={(patch) => updateRule(rule.channelID, patch)}
            onDelete={() => removeRule(rule.channelID)}
          />
        ))}
      </div>
      {availableChannels.length > 0 && (
        <SelectField className={styles.channelSelect} value="" onChange={(value) => value && updateRule(value, {})}>
          <option value="">+ Ajouter un salon</option>
          {availableChannels.map((c) => (
            <option key={c.channelID} value={c.channelID}>
              {c.parentName ? `${c.parentName} › ` : ""}#{c.channelName}
            </option>
          ))}
        </SelectField>
      )}
      {Object.values(saving).some(Boolean) ? <div className={styles.saveBar}><span className={styles.saveBarText}>Sauvegarde en cours…</span></div> : null}
    </>
  );
}

function getSaveBarText(status: "idle" | "saving" | "saved" | "error"): string {
  if (status === "saving") return "Sauvegarde en cours…";
  if (status === "saved") return "✓ Paramètres sauvegardés";
  return "Erreur de sauvegarde";
}

function SettingsInner() {
  const searchParams = useSearchParams();
  const guildID = searchParams.get("guild") ?? "";
  const [section, setSection] = useState<SettingsSection>("stats");
  const { settings, channels, status, patch } = useGuildSettings(guildID);

  if (!guildID) return <EmptyState title="Sélectionnez un serveur dans la barre de navigation." />;
  if (!settings) return <LoadingState label="Chargement des paramètres…" />;

  const navItems: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "stats", label: "Statistiques", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
    { id: "spam", label: "Anti-Spam", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg> },
    { id: "invite-log", label: "Invite Log", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg> },
    { id: "moderation", label: "Modération", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
    { id: "starboard", label: "Starboard", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
    { id: "channels", label: "Salons", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
    { id: "auto-responses", label: "Auto-réponses", icon: <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg> },
  ];

  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${styles.headerMobile}`}>
        <h1 className={styles.title}>Paramètres</h1>
        <div className={`${styles.tabs} ${styles.tabsMobile}`} role="tablist" aria-label="Sections des paramètres">
          {navItems.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={section === item.id}
              className={`${styles.tab} ${section === item.id ? styles.tabActive : ""}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>Paramètres</div>
        {navItems.map((item) => (
          <button key={item.id} className={`${styles.sidebarItem} ${section === item.id ? styles.active : ""}`} onClick={() => setSection(item.id)}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </aside>
      <main className={styles.content} key={section}>
        {section === "stats" ? <StatsSection settings={settings} channels={channels} onPatch={patch} /> : null}
        {section === "spam" ? <SpamSection guildID={guildID} channels={channels} /> : null}
        {section === "invite-log" ? <InviteLogSection settings={settings} channels={channels} onPatch={patch} /> : null}
        {section === "moderation" ? <ModerationSection settings={settings} channels={channels} onPatch={patch} /> : null}
        {section === "starboard" ? <StarboardSection settings={settings} channels={channels} onPatch={patch} /> : null}
        {section === "channels" ? <ChannelsSection guildID={guildID} channels={channels} /> : null}
        {section === "auto-responses" ? <AutoResponsesSection guildID={guildID} channels={channels} /> : null}
      </main>
      {status !== "idle" ? <div className={styles.saveBar}><span className={styles.saveBarText}>{getSaveBarText(status)}</span></div> : null}
    </div>
  );
}

export function SettingsScreen() {
  return (
    <Suspense fallback={<LoadingState label="Chargement…" />}>
      <SettingsInner />
    </Suspense>
  );
}
