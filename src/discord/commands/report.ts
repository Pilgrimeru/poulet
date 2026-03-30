import { config } from "@/app";
import { appealApiService, flaggedMessageApiService, guildSettingsService, moderationReportApiService, sanctionApiService } from "@/api";
import type { ContextMessage } from "@/api";
import { analyzeFlag, askReportQuestions, summarizeReport, computeSanction } from "@/ai";
import type { SummaryResult } from "@/ai/prompts";
import type { SanctionNature, SanctionSeverity } from "@/api/sanctionApiService";
import { componentRouter } from "@/discord/interactions";
import { Command, ContextMenuCommand } from "@/discord/types";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  Message,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  User,
  UserContextMenuCommandInteraction,
} from "discord.js";

const CATEGORY_NAME = "𝕊𝕚𝕘𝕟𝕒𝕝𝕖𝕞𝕖𝕟𝕥𝕤";
const TICKET_TOPIC_PREFIX = "report-meta:";
const APPEAL_MODAL_PREFIX = "appeal:modal:";

type TicketMeta = {
  reporterID: string;
  targetUserID: string;
};

type StoredReportAnalysis = SummaryResult;

function encodeTicketMeta(meta: TicketMeta): string {
  return `${TICKET_TOPIC_PREFIX}${JSON.stringify(meta)}`;
}

function decodeTicketMeta(topic: string | null): TicketMeta | null {
  if (!topic?.startsWith(TICKET_TOPIC_PREFIX)) return null;
  try {
    return JSON.parse(topic.slice(TICKET_TOPIC_PREFIX.length)) as TicketMeta;
  } catch {
    return null;
  }
}

function safeParseJSON<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLowerCase();
}

function logFlagTargetingDebug(args: {
  guildID: string;
  channelID: string;
  messageID: string;
  reporterID: string;
  reporterUsername: string;
  reporterDisplayName: string;
  targetUserID: string;
  messageContent: string;
  messageMentions: Array<{ id: string; username?: string | null; displayName?: string | null }>;
  analysis: {
    isViolation: boolean;
    severity: string;
    nature: string;
    reason: string;
    targetID: string | null;
    needsMoreContext: boolean;
    searchQuery: string | null;
  };
  resolvedTargetID: string | null;
}): void {
  console.info("[report][target-debug]", {
    guildID: args.guildID,
    channelID: args.channelID,
    messageID: args.messageID,
    reporterID: args.reporterID,
    reporterUsername: args.reporterUsername,
    reporterDisplayName: args.reporterDisplayName,
    targetUserID: args.targetUserID,
    messageContent: args.messageContent,
    messageMentions: args.messageMentions,
    aiAnalysis: args.analysis,
    wouldRequireCertification: Boolean(args.resolvedTargetID && args.resolvedTargetID !== args.reporterID),
  });
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) return `${Math.ceil(durationMs / 1000)}s`;
  if (durationMs < 3_600_000) return `${Math.ceil(durationMs / 60_000)}min`;
  if (durationMs < 86_400_000) return `${Math.ceil(durationMs / 3_600_000)}h`;
  return `${Math.ceil(durationMs / 86_400_000)}j`;
}

function similarPriorLevelForType(type: string): 1 | 2 | 3 {
  if (type === "WARN_LOW") return 1;
  if (type === "WARN_MEDIUM") return 2;
  return 3;
}

const SEVERITY_EMBED_CONFIG: Record<SanctionSeverity, { color: number; label: string; emoji: string }> = {
  LOW: { color: 0xf0c040, label: "Faible", emoji: "🟡" },
  MEDIUM: { color: 0xe07820, label: "Moyen", emoji: "🟠" },
  HIGH: { color: 0xe03030, label: "Élevé", emoji: "🔴" },
  UNFORGIVABLE: { color: 0x800000, label: "Impardonnable", emoji: "⛔" },
};

function buildSanctionEmbed(opts: {
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
      : "En attente de bannissement";

  const embed = new EmbedBuilder()
    .setColor(sev.color)
    .setAuthor({
      name: `${sev.emoji} Gravité : ${sev.label}`,
      iconURL: opts.target.displayAvatarURL(),
    })
    .setTitle(`Sanction : ${opts.target.username}`)
    .setDescription(`Motif : ${opts.reason.trim() || "*[Non communiqué]*"}`)
    .addFields(
      { name: "👤 Utilisateur", value: `${opts.target}`, inline: true },
      { name: "🛡️ Modérateur", value: `${opts.moderator}`, inline: true },
      { name: "⚖️ Décision", value: sanctionLabel, inline: false },
    )
    .setThumbnail(opts.target.displayAvatarURL())
    .setTimestamp();

  if (opts.originalMessage) {
    const url = opts.originalMessage.url;
    const preview = opts.originalMessage.content.length > 100
      ? `${opts.originalMessage.content.slice(0, 100)}…`
      : opts.originalMessage.content || "*[Pas de texte]*";
    embed.addFields({ name: "💬 Message d'origine", value: `[Voir le message](${url})\n> ${preview}` });
  }

  return embed;
}

async function getOrCreateCategory(guild: Guild): Promise<CategoryChannel> {
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === CATEGORY_NAME,
  ) as CategoryChannel | undefined;
  if (existing) return existing;

  return guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    position: 999,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
    ],
  });
}

async function getNextTicketNumber(guild: Guild, targetName: string): Promise<number> {
  const base = targetName.toLowerCase().replaceAll(/\s+/g, "-");
  let count = 1;
  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    const name = channel.name.toLowerCase();
    if (name === base || name.startsWith(`${base}-`)) count += 1;
  }
  return count;
}

async function openTicket(guild: Guild, reporter: User, target: User): Promise<TextChannel> {
  const category = await getOrCreateCategory(guild);
  const botId = guild.client.user.id;
  const baseName = target.username.toLowerCase().replaceAll(/[^a-z0-9]/g, "-").replaceAll(/-+/g, "-").replaceAll(/^-|-$/g, "");
  const suffix = await getNextTicketNumber(guild, baseName);
  const channelName = suffix === 1 ? baseName : `${baseName}-${suffix}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: encodeTicketMeta({ reporterID: reporter.id, targetUserID: target.id }),
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
      {
        id: reporter.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        type: OverwriteType.Member,
      },
      {
        id: botId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory],
        type: OverwriteType.Member,
      },
    ],
  });

  await sendWelcomeEmbed(channel, reporter, target);
  return channel;
}

async function sendWelcomeEmbed(channel: TextChannel, reporter: User, target: User): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle("📋 Signalement")
    .setDescription(
      [
        `Bonjour ${reporter}, ton signalement concernant **${target.username}** va etre analyse automatiquement.`,
        "",
        "Explique clairement les faits reproches, avec des preuves ou des liens quand c'est possible.",
        "Quand tout est prêt, clique sur **Déposer le signalement**.",
      ].join("\n"),
    )
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: `Signalement a l'encontre de ${target.username} (${target.id})` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report:submit:${channel.id}`)
      .setLabel("Déposer le signalement")
      .setStyle(ButtonStyle.Success)
      .setEmoji("📨"),
    new ButtonBuilder()
      .setCustomId(`report:cancel:${channel.id}`)
      .setLabel("Annuler")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️"),
  );

  const welcome = await channel.send({ embeds: [embed], components: [row] });
  await welcome.pin().catch(() => undefined);
}

async function collectContextMessages(targetMessage: Message): Promise<ContextMessage[]> {
  const fetched = await targetMessage.channel.messages.fetch({ limit: 60, around: targetMessage.id }).catch(() => null);
  if (!fetched) {
    return [
      {
        id: targetMessage.id,
        authorID: targetMessage.author.id,
        authorUsername: targetMessage.author.username,
        authorAvatarURL: targetMessage.author.displayAvatarURL(),
        content: targetMessage.content,
        createdAt: targetMessage.createdTimestamp,
        referencedMessageID: targetMessage.reference?.messageId ?? null,
      },
    ];
  }

  return [...fetched.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => ({
      id: message.id,
      authorID: message.author.id,
      authorUsername: message.member?.displayName ?? message.author.username,
      authorAvatarURL: message.author.displayAvatarURL(),
      content: message.content,
      createdAt: message.createdTimestamp,
      referencedMessageID: message.reference?.messageId ?? null,
    }));
}

async function collectTicketMessages(channel: TextChannel): Promise<ContextMessage[]> {
  const messages = await channel.messages.fetch({ limit: 100 });
  return [...messages.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .filter((message) => !message.author.bot)
    .map((message) => ({
      id: message.id,
      authorID: message.author.id,
      authorUsername: message.author.username,
      authorAvatarURL: message.author.displayAvatarURL(),
      content: message.content,
      createdAt: message.createdTimestamp,
      referencedMessageID: message.reference?.messageId ?? null,
    }));
}

function ticketMessagesToTranscript(messages: ContextMessage[]): string {
  return messages
    .map((msg) => `[${new Date(msg.createdAt).toISOString()}] ${msg.authorUsername}: ${msg.content}`)
    .join("\n");
}

async function getSimilarityInputs(guildID: string, userID: string, nature: string): Promise<{
  multiplier: number;
  similarPriorLevel: 0 | 1 | 2 | 3;
}> {
  const settings = await guildSettingsService.getByGuildID(guildID).catch(() => null);
  const sanctionDurationMs = (settings as unknown as { sanctionDurationMs?: number | null })?.sanctionDurationMs ?? null;

  const [multiplier, sanctions] = await Promise.all([
    sanctionApiService.getActiveMultiplier(guildID, userID, sanctionDurationMs),
    sanctionApiService.list(guildID, { userID }),
  ]);

  const needle = normalizeText(nature);
  let similarPriorLevel: 0 | 1 | 2 | 3 = 0;

  for (const sanction of sanctions) {
    if (normalizeText(sanction.nature).includes(needle) || normalizeText(sanction.reason).includes(needle)) {
      similarPriorLevel = Math.max(similarPriorLevel, similarPriorLevelForType(sanction.type)) as 0 | 1 | 2 | 3;
    }
  }

  return { multiplier, similarPriorLevel };
}

async function sendAppealDM(target: User, guildID: string, sanctionID: string, reason: string): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`appeal:sanction:${guildID}:${sanctionID}`)
      .setLabel("Faire appel")
      .setStyle(ButtonStyle.Secondary),
  );

  await target.send({
    embeds: [
      new EmbedBuilder()
        .setColor(config.COLORS.MAIN)
        .setTitle("Moderation")
        .setDescription(`Une sanction automatique a été prise à ton encontre.\nMotif : ${reason}`),
    ],
    components: [row],
  }).catch(() => undefined);
}

async function applyAutomaticSanction(args: {
  guild: Guild;
  target: User;
  moderator: User;
  reason: string;
  severity: SanctionSeverity;
  nature: SanctionNature;
  source: { kind: "flag"; id: string; message?: Message } | { kind: "report"; id: string; channel: TextChannel };
}) {
  const { multiplier, similarPriorLevel } = await getSimilarityInputs(args.guild.id, args.target.id, args.nature);
  const computed = computeSanction(args.severity, multiplier, similarPriorLevel);
  const member = await args.guild.members.fetch(args.target.id).catch(() => null);

  const sanction = await sanctionApiService.create({
    guildID: args.guild.id,
    userID: args.target.id,
    moderatorID: args.moderator.id,
    reason: args.reason,
    type: computed.sanctionType,
    severity: computed.severity,
    nature: args.nature,
    state: "created",
    durationMs: computed.sanctionType === "MUTE" ? computed.durationMs : null,
  });

  if (computed.requiresBanConfirmation) {
    await sanctionApiService.create({
      guildID: args.guild.id,
      userID: args.target.id,
      moderatorID: args.moderator.id,
      reason: args.reason,
      type: "BAN_PENDING",
      severity: computed.severity,
      nature: args.nature,
      state: "created",
      durationMs: null,
    });
  }

  if (member && computed.sanctionType === "MUTE") {
    await member.timeout(computed.durationMs, args.reason).catch(() => undefined);
  }

  const embed = buildSanctionEmbed({
    target: args.target,
    severity: computed.severity,
    type: computed.sanctionType,
    reason: args.reason,
    moderator: args.moderator,
    durationMs: computed.sanctionType === "MUTE" ? computed.durationMs : null,
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
    await sendAppealDM(args.target, args.guild.id, sanction.id, args.reason);
  } else {
    const reportChannel = args.source.channel;
    await reportChannel.send({ content: `${args.target}`, embeds: [embed] });
    await moderationReportApiService.update(args.guild.id, args.source.id, {
      status: "sanctioned",
      sanctionID: sanction.id,
    });
    await sendAppealDM(args.target, args.guild.id, sanction.id, args.reason);
    const meta = decodeTicketMeta(reportChannel.topic);
    if (meta) {
      await reportChannel.permissionOverwrites.edit(meta.reporterID, { SendMessages: false }).catch(() => undefined);
    }
  }

  if (computed.requiresBanConfirmation) {
    const channel = args.source.kind === "flag" ? args.source.message?.channel : args.source.channel;
    if (channel && "send" in channel) {
      await (channel as TextChannel).send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe03030)
            .setTitle("Confirmation de bannissement requise")
            .setDescription(`L'utilisateur ${args.target} a été marqué pour un bannissement potentiel.\nMotif : ${args.reason}`),
        ],
      }).catch(() => undefined);
    }
  }

  return { sanction };
}

async function processTicketSubmission(guild: Guild, channel: TextChannel) {
  const meta = decodeTicketMeta(channel.topic);
  if (!meta) throw new Error("Métadonnées du ticket introuvables.");

  const ticketMessages = await collectTicketMessages(channel);
  const transcript = ticketMessagesToTranscript(ticketMessages);

  const existingReport = await moderationReportApiService.getByChannel(guild.id, channel.id);
  const report = existingReport
    ? await moderationReportApiService.update(guild.id, existingReport.id, {
        reporterSummary: transcript,
        status: "awaiting_ai",
        context: { messages: ticketMessages, aiSummary: existingReport.context?.aiSummary },
      })
    : await moderationReportApiService.create({
        guildID: guild.id,
        reporterID: meta.reporterID,
        targetUserID: meta.targetUserID,
        ticketChannelID: channel.id,
        status: "awaiting_ai",
        reporterSummary: transcript,
        context: { messages: ticketMessages },
      });

  const questions = await askReportQuestions({
    reporterID: meta.reporterID,
    targetUserID: meta.targetUserID,
    transcript,
  });

  if (questions.needsFollowUp) {
    const followUpRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`report:followup:${report!.id}`)
        .setLabel("J'ai répondu")
        .setStyle(ButtonStyle.Secondary),
    );

    await moderationReportApiService.update(guild.id, report!.id, {
      status: "awaiting_reporter",
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(config.COLORS.MAIN)
          .setTitle("Questions complementaires")
          .setDescription(questions.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")),
      ],
      components: [followUpRow],
    });
    return { kind: "follow_up" as const };
  }

  const summary = await summarizeReport({
    reporterID: meta.reporterID,
    targetUserID: meta.targetUserID,
    transcript,
  });

  await moderationReportApiService.update(guild.id, report!.id, {
    status: "awaiting_confirmation",
    context: { messages: ticketMessages, aiSummary: summary },
  });

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`report:confirm:${report!.id}`).setLabel("Confirmer").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`report:modify:${report!.id}`).setLabel("Modifier").setStyle(ButtonStyle.Secondary),
  );

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(config.COLORS.MAIN)
        .setTitle("Synthese IA du dossier")
        .setDescription(
          [
            `Gravite: **${summary.severity}**`,
            `Nature: **${summary.nature}**`,
            `Motif: ${summary.reason}`,
            "",
            summary.summary,
          ].join("\n"),
        ),
    ],
    components: [confirmRow],
  });
  return { kind: "ready" as const };
}

async function handleTicketSubmit(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.slice("report:submit:".length);
  if (!interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const meta = decodeTicketMeta(channel.topic);
  if (!meta) {
    await interaction.reply({ content: "Métadonnées du ticket introuvables.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut finaliser ce ticket.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await processTicketSubmission(interaction.guild, channel);
  await interaction.editReply({
      content: result.kind === "follow_up"
      ? "Des informations supplémentaires sont nécessaires. Réponds dans le ticket puis clique sur `J'ai répondu`."
      : "La synthèse IA est prête. Confirme ou demande une unique modification dans le ticket.",
  });
}

async function handleTicketCancel(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.slice("report:cancel:".length);
  if (!interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const meta = decodeTicketMeta(channel.topic);
  if (!meta || interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut annuler ce ticket.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.update({ components: [] });
  await channel.send({ content: "Ticket annulé. Ce salon sera supprimé dans 5 secondes." });
  setTimeout(() => void channel.delete().catch(() => undefined), 5000);
}

async function handleReportConfirm(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:confirm:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: "Signalement introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const analysis = safeParseJSON<StoredReportAnalysis>(report.context?.aiSummary);
  if (!analysis) {
    await interaction.reply({ content: "Analyse IA introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Salon du ticket introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut confirmer ce dossier.", flags: MessageFlags.Ephemeral });
    return;
  }

  const target = await interaction.client.users.fetch(report.targetUserID);
  await applyAutomaticSanction({
    guild: interaction.guild,
    target,
    moderator: interaction.client.user,
    reason: analysis.reason,
    severity: analysis.severity,
    nature: analysis.nature,
    source: { kind: "report", id: report.id, channel },
  });

  await interaction.reply({ content: "Signalement confirmé et sanction appliquée.", flags: MessageFlags.Ephemeral });
}

async function handleReportModify(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:modify:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: "Signalement introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Salon du ticket introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut demander une modification.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (report.confirmationCount >= 1) {
    await interaction.reply({ content: "Une seule modification est autorisee pour ce ticket.", flags: MessageFlags.Ephemeral });
    return;
  }

  await moderationReportApiService.update(interaction.guild.id, reportId, {
    status: "awaiting_reporter",
    confirmationCount: report.confirmationCount + 1,
  });
  await channel.send("Ajoute les corrections souhaitées dans le ticket puis clique de nouveau sur **Déposer le signalement**.");
  await interaction.reply({ content: "Ticket repassé en mode édition.", flags: MessageFlags.Ephemeral });
}

async function handleReportFollowUp(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:followup:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: "Signalement introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Salon du ticket introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut relancer l'analyse.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await processTicketSubmission(interaction.guild, channel);
  await interaction.editReply({
    content: result.kind === "follow_up"
      ? "De nouvelles informations sont encore nécessaires."
      : "La synthèse IA a été régénérée.",
  });
}

async function handleAppeal(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  // Format v2: appeal:sanction:<guildID>:<sanctionID>
  if (parts[1] !== "sanction" || parts.length < 4) {
    await interaction.reply({ content: "Cette sanction n'est plus accessible. Contactez un modérateur.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guildID = parts[2];
  const sanctionID = parts[3];

  const sanctionList = await sanctionApiService.list(guildID, {}).catch(() => []);
  const sanction = sanctionList.find((s) => s.id === sanctionID);
  if (!sanction) {
    await interaction.reply({ content: "Sanction introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.user.id !== sanction.userID) {
    await interaction.reply({ content: "Seul l'utilisateur sanctionné peut faire appel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${APPEAL_MODAL_PREFIX}${guildID}:${sanctionID}`)
    .setTitle("Faire appel");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("appeal_text")
        .setLabel("Pourquoi revoir cette sanction ?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
  );

  await interaction.showModal(modal);
  const submitted = await interaction.awaitModalSubmit({
    time: 120_000,
    filter: (modalInteraction) =>
      modalInteraction.customId === `${APPEAL_MODAL_PREFIX}${guildID}:${sanctionID}` &&
      modalInteraction.user.id === interaction.user.id,
  }).catch(() => null);

  if (!submitted) return;

  const appealText = submitted.fields.getTextInputValue("appeal_text").trim();
  await appealApiService.create(guildID, sanctionID, appealText);
  await submitted.reply({ content: "Appel enregistré.", flags: MessageFlags.Ephemeral });
}

function registerModerationRouters() {
  const globalState = globalThis as unknown as { __pouletModerationHandlersRegistered?: boolean };
  if (globalState.__pouletModerationHandlersRegistered) return;
  globalState.__pouletModerationHandlersRegistered = true;

  componentRouter.registerPrefix("report:submit:", async (interaction) => {
    if (interaction.isButton()) await handleTicketSubmit(interaction);
  });
  componentRouter.registerPrefix("report:cancel:", async (interaction) => {
    if (interaction.isButton()) await handleTicketCancel(interaction);
  });
  componentRouter.registerPrefix("report:confirm:", async (interaction) => {
    if (interaction.isButton()) await handleReportConfirm(interaction);
  });
  componentRouter.registerPrefix("report:followup:", async (interaction) => {
    if (interaction.isButton()) await handleReportFollowUp(interaction);
  });
  componentRouter.registerPrefix("report:modify:", async (interaction) => {
    if (interaction.isButton()) await handleReportModify(interaction);
  });
  componentRouter.registerPrefix("appeal:", async (interaction) => {
    if (interaction.isButton()) await handleAppeal(interaction);
  });
}

registerModerationRouters();

export default class ReportCommand extends Command {
  constructor() {
    super({
      name: "report",
      description: "Signaler un utilisateur à la modération",
      options: [
        {
          name: "utilisateur",
          description: "L'utilisateur à signaler",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.options.getUser("utilisateur", true);
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "Tu ne peux pas te signaler toi-meme.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "Tu ne peux pas signaler un bot.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await openTicket(interaction.guild, interaction.user, target);
    await interaction.editReply({ content: `Ton ticket a été créé : ${channel}` });
  }
}

export class ReportContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Report");
  }

  async execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.targetUser;
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "Tu ne peux pas te signaler toi-meme.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "Tu ne peux pas signaler un bot.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await openTicket(interaction.guild, interaction.user, target);
    await interaction.editReply({ content: `Ton ticket a été créé : ${channel}` });
  }
}

export class ReportMessageContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Signaler", ApplicationCommandType.Message);
  }

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const targetMessage = interaction.targetMessage;
    const target = targetMessage.author;

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "Tu ne peux pas te signaler toi-meme.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "Tu ne peux pas signaler un bot.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const contextMessages = await collectContextMessages(targetMessage);
    const reporterMember = interaction.member;
    const reporterDisplayName =
      reporterMember && typeof reporterMember === "object" && "displayName" in reporterMember
        ? reporterMember.displayName
        : interaction.user.globalName ?? interaction.user.username;
    const messageMentions = [...targetMessage.mentions.users.values()].map((user) => ({
      id: user.id,
      username: user.username,
      displayName: interaction.guild?.members.cache.get(user.id)?.displayName ?? user.globalName ?? user.username,
    }));

    const flagged = await flaggedMessageApiService.create({
      guildID: interaction.guild.id,
      channelID: targetMessage.channelId,
      messageID: targetMessage.id,
      reporterID: interaction.user.id,
      targetUserID: target.id,
      status: "pending",
      context: contextMessages,
    });

    const analysis = await analyzeFlag({
      reporterID: interaction.user.id,
      reporterUsername: interaction.user.username,
      reporterDisplayName,
      targetUserID: target.id,
      targetUsername: target.username,
      targetDisplayName: interaction.guild.members.cache.get(target.id)?.displayName ?? target.globalName ?? target.username,
      messageMentions,
      messageContent: targetMessage.content,
      contextMessages,
    });

    const resolvedTargetID = analysis.targetID;

    logFlagTargetingDebug({
      guildID: interaction.guild.id,
      channelID: targetMessage.channelId,
      messageID: targetMessage.id,
      reporterID: interaction.user.id,
      reporterUsername: interaction.user.username,
      reporterDisplayName,
      targetUserID: target.id,
      messageContent: targetMessage.content,
      messageMentions,
      analysis,
      resolvedTargetID,
    });

    await flaggedMessageApiService.update(interaction.guild.id, flagged.id, {
      aiAnalysis: { ...analysis, targetID: resolvedTargetID },
      status: "analyzed",
    });

    if (!analysis.isViolation) {
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "dismissed" });
      await interaction.editReply({ content: "Aucune violation suffisamment claire n'a été détectée pour une sanction automatique." });
      return;
    }

    if (resolvedTargetID && resolvedTargetID !== interaction.user.id) {
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "needs_certification" });
      await interaction.editReply({ content: "Cette insulte ciblée ne peut être signalée que par la personne visée. Utilise le flux de ticket si tu es la victime." });
      return;
    }

    if (analysis.needsMoreContext) {
      const channel = await openTicket(interaction.guild, interaction.user, target);
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "escalated" });
      await interaction.editReply({ content: `Le message demande plus de contexte. Un ticket a été créé : ${channel}` });
      return;
    }

    await applyAutomaticSanction({
      guild: interaction.guild,
      target,
      moderator: interaction.client.user,
      reason: analysis.reason,
      severity: analysis.severity,
      nature: analysis.nature,
      source: { kind: "flag", id: flagged.id, message: targetMessage },
    });

    await interaction.editReply({ content: "Signalement traite automatiquement." });
  }
}

export const contextMenus = [ReportContextMenuCommand, ReportMessageContextMenuCommand];
