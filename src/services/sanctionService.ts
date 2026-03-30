import { EmbedBuilder } from "discord.js";
import type { SanctionNature, SanctionSeverity, SanctionType } from "@/api/sanctionApiService";

const SEVERITY_CONFIG: Record<
  SanctionSeverity,
  { color: number; label: string; emoji: string }
> = {
  LOW: { color: 0xf0c040, label: "Faible", emoji: "🟡" },
  MEDIUM: { color: 0xe07820, label: "Modérée", emoji: "🟠" },
  HIGH: { color: 0xe03030, label: "Grave", emoji: "🔴" },
  UNFORGIVABLE: { color: 0x8b0000, label: "Impardonnable", emoji: "⛔" },
};

const TYPE_LABELS: Record<SanctionType, string> = {
  WARN_LOW: "Avertissement faible",
  WARN_MEDIUM: "Avertissement moyen",
  WARN_HIGH: "Avertissement élevé",
  MUTE: "Exclusion temporaire",
  BAN_PENDING: "Bannissement en attente",
};

const NATURE_LABELS: Record<SanctionNature, string> = {
  Extremism: "Extrémisme",
  Violence: "Violence",
  Hate: "Haine",
  Harassment: "Harcèlement",
  Spam: "Spam",
  Manipulation: "Manipulation",
  Recidivism: "Récidive",
  Other: "Autre",
};

export interface SanctionEmbedOptions {
  targetTag: string;
  targetAvatarURL: string;
  moderatorTag: string;
  type: SanctionType;
  severity: SanctionSeverity;
  nature: SanctionNature;
  reason: string;
  durationMs?: number | null;
}

export function buildSanctionEmbed(opts: SanctionEmbedOptions): EmbedBuilder {
  const sev = SEVERITY_CONFIG[opts.severity];

  const embed = new EmbedBuilder()
    .setColor(sev.color)
    .setAuthor({
      name: `${sev.emoji} ${TYPE_LABELS[opts.type]} — ${sev.label}`,
      iconURL: opts.targetAvatarURL,
    })
    .setTitle(`Sanction : ${opts.targetTag}`)
    .setDescription(`Motif : ${opts.reason.trim() || "*[Non communiqué]*"}`)
    .addFields(
      { name: "Catégorie", value: NATURE_LABELS[opts.nature], inline: true },
      { name: "Sévérité", value: sev.label, inline: true },
      { name: "Modérateur", value: opts.moderatorTag, inline: true },
    )
    .setThumbnail(opts.targetAvatarURL)
    .setTimestamp();

  if (opts.durationMs) {
    const minutes = Math.ceil(opts.durationMs / 60_000);
    const label =
      minutes < 60 ? `${minutes} min` :
      minutes < 1440 ? `${Math.ceil(minutes / 60)} h` :
      `${Math.ceil(minutes / 1440)} j`;
    embed.addFields({ name: "Durée", value: label, inline: true });
  }

  return embed;
}
