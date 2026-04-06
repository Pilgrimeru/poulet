import { computeSanction } from "@/ai";
import { flaggedMessageApiService, guildSettingsService, moderationReportApiService, sanctionApiService } from "@/api";
import type { SanctionNature, SanctionSeverity } from "@/api/sanctionApiService";
import { config } from "@/app";
import { MODERATION_MESSAGES } from "@/discord/components/moderation/moderationMessages";
import { getAlreadySanctionedMessageIDs } from "@/discord/components/moderation/reportService";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  Message,
  TextChannel,
  User,
} from "discord.js";

function resolveDefaultPublishChannel(guild: Guild): TextChannel | null {
  if (guild.systemChannel?.isTextBased() && guild.systemChannel.type === 0) {
    return guild.systemChannel as TextChannel;
  }

  const candidate = guild.channels.cache.find((channel) => channel.type === 0) as TextChannel | undefined;
  return candidate ?? null;
}

function resolvePublishChannel(guild: Guild, originChannelID?: string | null): TextChannel | null {
  if (originChannelID) {
    const channel = guild.channels.cache.get(originChannelID);
    if (channel?.isTextBased() && channel.type === 0) return channel as TextChannel;
  }
  return resolveDefaultPublishChannel(guild);
}

export function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) return `${Math.ceil(durationMs / 1000)}s`;
  if (durationMs < 3_600_000) return `${Math.ceil(durationMs / 60_000)}min`;
  if (durationMs < 86_400_000) return `${Math.ceil(durationMs / 3_600_000)}h`;
  return `${Math.ceil(durationMs / 86_400_000)}j`;
}

function formatSeverityLabel(severity: SanctionSeverity): string {
  return SEVERITY_EMBED_CONFIG[severity].label;
}

function formatNatureLabel(nature: SanctionNature): string {
  const map: Record<SanctionNature, string> = {
    Extremism: "Extrémisme",
    Violence: "Violence",
    Hate: "Haine",
    Harassment: "Harcèlement",
    Spam: "Spam",
    Manipulation: "Manipulation",
    Recidivism: "Récidive",
    Other: "Autre",
  };
  return map[nature];
}

function formatSanctionDecision(type: string, severity: SanctionSeverity, durationMs?: number | null): string {
  if (type.startsWith("WARN")) return `Warn formel (${formatSeverityLabel(severity)})`;
  if (type === "MUTE") return `Exclusion${durationMs ? ` (${formatDuration(durationMs)})` : ""}`;
  return `En attente de bannissement${durationMs ? ` (${formatDuration(durationMs)})` : ""}`;
}

export const SEVERITY_EMBED_CONFIG: Record<SanctionSeverity, { color: number; label: string; emoji: string }> = {
  NONE: { color: 0x6b7280, label: "Aucune", emoji: "⚪" },
  LOW: { color: 0xf0c040, label: "Faible", emoji: "🟡" },
  MEDIUM: { color: 0xe07820, label: "Moyen", emoji: "🟠" },
  HIGH: { color: 0xe03030, label: "Élevé", emoji: "🔴" },
  UNFORGIVABLE: { color: 0x800000, label: "Impardonnable", emoji: "⛔" },
};

export function buildSanctionEmbed(opts: {
  target: User;
  severity: SanctionSeverity;
  type: string;
  reason: string;
  moderator: User;
  durationMs?: number | null;
  originalMessage?: Message;
}): EmbedBuilder {
  const sev = SEVERITY_EMBED_CONFIG[opts.severity];
  const sanctionLabel = opts.type.startsWith("WARN")
    ? `Warn formel (${sev.label})`
    : opts.type === "MUTE"
      ? `Exclusion${opts.durationMs ? ` (${formatDuration(opts.durationMs)})` : ""}`
      : `En attente de bannissement${opts.durationMs ? ` (${formatDuration(opts.durationMs)})` : ""}`;

  const embed = new EmbedBuilder()
    .setColor(sev.color)
    .setAuthor({
      name: `${sev.emoji} Gravité : ${sev.label}`,
      iconURL: opts.target.displayAvatarURL(),
    })
    .setTitle(MODERATION_MESSAGES.sanctionEmbedTitle(opts.target.username))
    .setDescription(MODERATION_MESSAGES.sanctionEmbedDescription(opts.reason))
    .addFields(
      { name: MODERATION_MESSAGES.sanctionEmbedFields.user, value: `${opts.target}`, inline: true },
      { name: MODERATION_MESSAGES.sanctionEmbedFields.moderator, value: `${opts.moderator}`, inline: true },
      { name: MODERATION_MESSAGES.sanctionEmbedFields.decision, value: sanctionLabel, inline: false },
    )
    .setThumbnail(opts.target.displayAvatarURL())
    .setTimestamp();

  if (opts.originalMessage) {
    const url = opts.originalMessage.url;
    const preview = opts.originalMessage.content.length > 100
      ? `${opts.originalMessage.content.slice(0, 100)}…`
      : opts.originalMessage.content || "*[Pas de texte]*";
    embed.addFields({ name: MODERATION_MESSAGES.sanctionEmbedFields.originalMessage, value: `[Voir le message](${url})\n> ${preview}` });
  }

  return embed;
}

export async function getSimilarityInputs(guildID: string, userID: string, referenceTimestamp?: number): Promise<{
  multiplier: number;
  sanctions: Awaited<ReturnType<typeof sanctionApiService.list>>;
}> {
  const settings = await guildSettingsService.getByGuildID(guildID).catch(() => null);
  const sanctionDurationMs = (settings as unknown as { sanctionDurationMs?: number | null })?.sanctionDurationMs ?? null;

  const [multiplier, allSanctions] = await Promise.all([
    sanctionApiService.getActiveMultiplier(guildID, userID, sanctionDurationMs, referenceTimestamp),
    sanctionApiService.list(guildID, { userID }),
  ]);
  const sanctions = referenceTimestamp === undefined
    ? allSanctions
    : allSanctions.filter((sanction) => sanction.createdAt <= referenceTimestamp);
  return { multiplier, sanctions };
}

export async function sendAppealDM(args: {
  target: User;
  guildID: string;
  sanctionID: string;
  reason: string;
  severity: SanctionSeverity;
  nature: SanctionNature;
  sanctionType: string;
  durationMs?: number | null;
  summary?: string | null;
}): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`appeal:sanction:${args.guildID}:${args.sanctionID}`)
      .setLabel(MODERATION_MESSAGES.appealButton)
      .setStyle(ButtonStyle.Secondary),
  );

  const lines = [
    "Une sanction automatique a été prise à ton encontre.",
    "",
    `Décision : **${formatSanctionDecision(args.sanctionType, args.severity, args.durationMs)}**`,
    `Gravité retenue : **${formatSeverityLabel(args.severity)}**`,
    `Catégorie retenue : **${formatNatureLabel(args.nature)}**`,
    `Motif de la sanction : ${args.reason.trim() || "*[Non communiqué]*"}`,
  ];

  if (args.summary?.trim()) {
    lines.push("", `Synthèse IA : ${args.summary.trim()}`);
  }

  lines.push("", MODERATION_MESSAGES.sanctionDmHumanReviewNotice);

  await args.target.send({
    embeds: [
      new EmbedBuilder()
        .setColor(config.COLORS.MAIN)
        .setTitle(MODERATION_MESSAGES.sanctionDmTitle)
        .setDescription(lines.join("\n")),
    ],
    components: [row],
  }).catch(() => undefined);
}

export async function applyAutomaticSanction(args: {
  guild: Guild;
  target: User;
  moderator: User;
  reason: string;
  severity: SanctionSeverity;
  sanctionKind: "WARN" | "MUTE" | "BAN_PENDING";
  nature: SanctionNature;
  aiSummary?: string | null;
  source:
    | { kind: "flag"; id: string; message?: Message }
    | { kind: "report"; id: string; channel: TextChannel; reporterID?: string | null; originChannelID?: string | null };
}) {
  if (args.severity === "NONE") {
    throw new Error("Cannot apply a sanction with NONE severity");
  }

  const referenceTimestamp = args.source.kind === "flag" ? args.source.message?.createdTimestamp : undefined;
  const { multiplier } = await getSimilarityInputs(args.guild.id, args.target.id, referenceTimestamp);
  const computed = computeSanction(args.severity, args.sanctionKind, multiplier);
  const member = await args.guild.members.fetch(args.target.id).catch(() => null);

  if (args.source.kind === "flag" && args.source.message) {
    const alreadySanctionedMessageIDs = await getAlreadySanctionedMessageIDs(args.guild.id, args.target.id);
    if (alreadySanctionedMessageIDs.has(args.source.message.id)) {
      await flaggedMessageApiService.update(args.guild.id, args.source.id, {
        status: "dismissed",
      }).catch(() => undefined);
      return { sanction: null, skippedDuplicate: true as const };
    }
  }

  const sanction = await sanctionApiService.create({
    guildID: args.guild.id,
    userID: args.target.id,
    moderatorID: args.moderator.id,
    reason: args.reason,
    type: computed.sanctionType,
    severity: computed.severity,
    nature: args.nature,
    state: "created",
    durationMs: computed.sanctionType.startsWith("WARN") ? null : computed.durationMs,
  });

  if (member && (computed.sanctionType === "MUTE" || computed.sanctionType === "BAN_PENDING")) {
    await member.timeout(computed.durationMs, args.reason).catch(() => undefined);
  }

  const embed = buildSanctionEmbed({
    target: args.target,
    severity: computed.severity,
    type: computed.sanctionType,
    reason: args.reason,
    moderator: args.moderator,
    durationMs: computed.sanctionType === "MUTE" || computed.sanctionType === "BAN_PENDING" ? computed.durationMs : null,
    originalMessage: args.source.kind === "flag" ? args.source.message : undefined,
  });

  if (args.source.kind === "flag") {
    const flaggedMessage = args.source.message;
    if (flaggedMessage) {
      await flaggedMessage.reply({ embeds: [embed] }).catch(async () => {
        await (flaggedMessage.channel as TextChannel).send({ content: `${args.target}`, embeds: [embed] }).catch(() => undefined);
      });
    }
    await flaggedMessageApiService.update(args.guild.id, args.source.id, {
      status: "sanctioned",
      sanctionID: sanction.id,
    });
  } else {
    const reportChannel = args.source.channel;
    const publishChannel = resolvePublishChannel(args.guild, args.source.originChannelID);
    if (publishChannel) {
      await publishChannel.send({ content: `${args.target}`, embeds: [embed] }).catch(() => undefined);
    } else {
      await reportChannel.send({ content: `${args.target}`, embeds: [embed] }).catch(() => undefined);
    }
    await moderationReportApiService.update(args.guild.id, args.source.id, {
      status: "sanctioned",
      sanctionID: sanction.id,
    });
    if (args.source.reporterID) {
      await reportChannel.permissionOverwrites.edit(args.source.reporterID, { SendMessages: false }).catch(() => undefined);
    }
  }

  await sendAppealDM({
    target: args.target,
    guildID: args.guild.id,
    sanctionID: sanction.id,
    reason: args.reason,
    severity: computed.severity,
    nature: args.nature,
    sanctionType: computed.sanctionType,
    durationMs: computed.sanctionType === "MUTE" || computed.sanctionType === "BAN_PENDING" ? computed.durationMs : null,
    summary: args.aiSummary ?? null,
  });

  if (computed.sanctionType === "BAN_PENDING") {
    const channel = args.source.kind === "flag" ? args.source.message?.channel : args.source.channel;
    if (channel && "send" in channel) {
      await (channel as TextChannel).send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe03030)
            .setTitle(MODERATION_MESSAGES.banPendingTitle)
            .setDescription(MODERATION_MESSAGES.banPendingDescription(args.target, args.reason)),
        ],
      }).catch(() => undefined);
    }
  }

  return { sanction, skippedDuplicate: false as const };
}
