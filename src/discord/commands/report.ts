import { config } from "@/app";
import { flaggedMessageApiService, moderationReportApiService, sanctionApiService, warnApiService } from "@/api";
import { analyzeFlag, analyzeReport, computeSanction } from "@/ai";
import { componentRouter } from "@/discord/interactions";
import { Command, ContextMenuCommand } from "@/discord/types";
import { buildWarnEmbed } from "@/services/warnService";
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

type StoredReportAnalysis = {
  needsFollowUp: boolean;
  followUpQuestions: string[];
  warnSuffices: boolean;
  qqoqccp: {
    qui: string;
    quoi: string;
    ou: string;
    quand: string;
    comment: string;
    combien: string;
    pourquoi: string;
  };
  severity: "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
  reasoning: string;
};

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

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) return `${Math.ceil(durationMs / 1000)}s`;
  if (durationMs < 3_600_000) return `${Math.ceil(durationMs / 60_000)}min`;
  if (durationMs < 86_400_000) return `${Math.ceil(durationMs / 3_600_000)}h`;
  return `${Math.ceil(durationMs / 86_400_000)}j`;
}

function severityWeightFromWarn(severity: "LOW" | "MEDIUM" | "HIGH"): number {
  return severity === "HIGH" ? 0.5 : 0.25;
}

function similarPriorLevelForSeverity(severity: "LOW" | "MEDIUM" | "HIGH"): 1 | 2 | 3 {
  if (severity === "LOW") return 1;
  if (severity === "MEDIUM") return 2;
  return 3;
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
        "Quand tout est pret, clique sur **Deposer le signalement**.",
      ].join("\n"),
    )
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: `Signalement a l'encontre de ${target.username} (${target.id})` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report:submit:${channel.id}`)
      .setLabel("Deposer le signalement")
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

async function collectContextMessages(targetMessage: Message): Promise<Array<{ authorID: string; authorName: string; content: string; createdAt: number }>> {
  const fetched = await targetMessage.channel.messages.fetch({ limit: 60, around: targetMessage.id }).catch(() => null);
  if (!fetched) {
    return [
      {
        authorID: targetMessage.author.id,
        authorName: targetMessage.author.username,
        content: targetMessage.content,
        createdAt: targetMessage.createdTimestamp,
      },
    ];
  }

  return [...fetched.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => ({
      authorID: message.author.id,
      authorName: message.member?.displayName ?? message.author.username,
      content: message.content,
      createdAt: message.createdTimestamp,
    }));
}

async function getSimilarityInputs(guildID: string, userID: string, category: string): Promise<{
  multiplier: number;
  similarPriorLevel: 0 | 1 | 2 | 3;
}> {
  const [warns, sanctions] = await Promise.all([
    warnApiService.list(guildID, userID),
    sanctionApiService.list(guildID, { userID, activeOnly: true }),
  ]);
  const needle = normalizeText(category);
  const now = Date.now();
  const activeWarns = warns.filter((warn) => warn.isActive && (warn.expiresAt === null || warn.expiresAt > now));
  const warnById = new Map(warns.map((warn) => [warn.id, warn] as const));

  let multiplier = activeWarns.reduce((sum, warn) => sum + severityWeightFromWarn(warn.severity), 0);
  let similarPriorLevel: 0 | 1 | 2 | 3 = 0;

  for (const sanction of sanctions) {
    const linkedWarn = sanction.warnID ? warnById.get(sanction.warnID) ?? null : null;
    if (linkedWarn) {
      multiplier += severityWeightFromWarn(linkedWarn.severity);
      if (normalizeText(sanction.reason).includes(needle) || normalizeText(linkedWarn.reason).includes(needle)) {
        similarPriorLevel = Math.max(similarPriorLevel, similarPriorLevelForSeverity(linkedWarn.severity)) as 0 | 1 | 2 | 3;
      }
    } else if (normalizeText(sanction.reason).includes(needle)) {
      similarPriorLevel = Math.max(similarPriorLevel, sanction.type === "BAN_PENDING" ? 3 : 2) as 0 | 1 | 2 | 3;
    }
  }

  for (const warn of activeWarns) {
    if (normalizeText(warn.reason).includes(needle)) {
      similarPriorLevel = Math.max(similarPriorLevel, similarPriorLevelForSeverity(warn.severity)) as 0 | 1 | 2 | 3;
    }
  }

  return { multiplier: Math.min(6, multiplier), similarPriorLevel };
}

async function sendAppealDM(target: User, customId: string, reason: string): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel("Faire appel")
      .setStyle(ButtonStyle.Secondary),
  );

  await target.send({
    embeds: [
      new EmbedBuilder()
        .setColor(config.COLORS.MAIN)
        .setTitle("Moderation")
        .setDescription(`Une sanction automatique a ete prise a ton encontre.\nMotif: ${reason}`),
    ],
    components: [row],
  }).catch(() => undefined);
}

async function resolveAppealGuildID(
  interaction: ButtonInteraction,
  sourceKind: string,
  sourceId: string,
  explicitGuildID?: string,
): Promise<string | null> {
  if (explicitGuildID) return explicitGuildID;
  if (interaction.guildId) return interaction.guildId;

  for (const guild of interaction.client.guilds.cache.values()) {
    const exists = sourceKind === "flag"
      ? await flaggedMessageApiService.list(guild.id).then((items) => items.some((item) => item.id === sourceId)).catch(() => false)
      : await moderationReportApiService.get(guild.id, sourceId).then((item) => item !== null).catch(() => false);

    if (exists) return guild.id;
  }

  return null;
}

async function applyAutomaticSanction(args: {
  guild: Guild;
  target: User;
  moderator: User;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "UNFORGIVABLE";
  category: string;
  warnSuffices: boolean;
  source: { kind: "flag"; id: string; message?: Message } | { kind: "report"; id: string; channel: TextChannel };
}) {
  const { multiplier, similarPriorLevel } = await getSimilarityInputs(args.guild.id, args.target.id, args.category);
  const computed = computeSanction(args.severity, multiplier, similarPriorLevel);

  const warn = await warnApiService.create({
    guildID: args.guild.id,
    userID: args.target.id,
    moderatorID: args.moderator.id,
    reason: args.reason,
    severity: computed.warnSeverity,
  });

  let sanction: Awaited<ReturnType<typeof sanctionApiService.create>> | null = null;
  const useWarnOnly = args.warnSuffices && args.severity !== "UNFORGIVABLE" && similarPriorLevel === 0;
  const member = await args.guild.members.fetch(args.target.id).catch(() => null);

  if (!useWarnOnly) {
    sanction = await sanctionApiService.create({
      guildID: args.guild.id,
      userID: args.target.id,
      moderatorID: args.moderator.id,
      reason: args.reason,
      type: computed.sanctionType,
      warnID: warn.id,
      durationMs: computed.sanctionType === "MUTE" ? computed.durationMs : null,
    });
    await warnApiService.revoke(args.guild.id, warn.id).catch(() => undefined);

    if (member && sanction.type === "MUTE") {
      await member.timeout(computed.durationMs, args.reason).catch(() => undefined);
    }
  }

  const embed = buildWarnEmbed({
    target: args.target,
    severity: warn.severity,
    message: useWarnOnly
      ? `${args.reason}\nDecision: warn formel`
      : `${args.reason}\nSanction: ${sanction!.type}${sanction!.durationMs ? ` (${formatDuration(sanction!.durationMs)})` : ""}`,
    moderator: args.moderator,
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
      warnID: warn.id,
      sanctionID: sanction?.id ?? null,
    });
    await sendAppealDM(args.target, `appeal:flag:${args.guild.id}:${args.source.id}`, args.reason);
  } else {
    const reportChannel = args.source.channel;
    await reportChannel.send({ content: `${args.target}`, embeds: [embed] });
    await moderationReportApiService.update(args.guild.id, args.source.id, {
      status: "sanctioned",
      warnID: warn.id,
      sanctionID: sanction?.id ?? null,
    });
    await sendAppealDM(args.target, `appeal:report:${args.guild.id}:${args.source.id}`, args.reason);
    const meta = decodeTicketMeta(reportChannel.topic);
    if (meta) {
      await reportChannel.permissionOverwrites.edit(meta.reporterID, {
        SendMessages: false,
      }).catch(() => undefined);
    }
  }

  if (sanction?.type === "BAN_PENDING") {
    const channel = args.source.kind === "flag" ? args.source.message?.channel : args.source.channel;
    if (channel && "send" in channel) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe03030)
            .setTitle("Confirmation de bannissement requise")
            .setDescription(`L'utilisateur ${args.target} a ete marque pour un bannissement potentiel.\nMotif: ${args.reason}`),
        ],
      }).catch(() => undefined);
    }
  }

  return { warn, sanction, useWarnOnly };
}

async function buildTicketTranscript(channel: TextChannel): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  return [...messages.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .filter((message) => !message.author.bot)
    .map((message) => `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.username}: ${message.content}`)
    .join("\n");
}

async function processTicketSubmission(guild: Guild, channel: TextChannel) {
  const meta = decodeTicketMeta(channel.topic);
  if (!meta) throw new Error("Metadonnees du ticket introuvables.");

  const transcript = await buildTicketTranscript(channel);
  const existingReport = await moderationReportApiService.getByChannel(guild.id, channel.id);
  const report = existingReport
    ? await moderationReportApiService.update(guild.id, existingReport.id, {
        reporterSummary: transcript,
        status: "awaiting_ai",
      })
    : await moderationReportApiService.create({
        guildID: guild.id,
        reporterID: meta.reporterID,
        targetUserID: meta.targetUserID,
        ticketChannelID: channel.id,
        status: "awaiting_ai",
        reporterSummary: transcript,
      });

  const analysis = await analyzeReport({
    reporterID: meta.reporterID,
    targetUserID: meta.targetUserID,
    transcript,
  });

  if (analysis.needsFollowUp) {
    const followUpRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`report:followup:${report.id}`)
        .setLabel("J'ai repondu")
        .setStyle(ButtonStyle.Secondary),
    );

    await moderationReportApiService.update(guild.id, report.id, {
      status: "awaiting_reporter",
      aiQuestions: analysis.followUpQuestions,
      aiQQOQCCP: null,
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(config.COLORS.MAIN)
          .setTitle("Questions complementaires")
          .setDescription(analysis.followUpQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")),
      ],
      components: [followUpRow],
    });
    return { kind: "follow_up" as const };
  }

  const stored = JSON.stringify(analysis satisfies StoredReportAnalysis);
  await moderationReportApiService.update(guild.id, report.id, {
    status: "awaiting_confirmation",
    aiQuestions: [],
    aiQQOQCCP: stored,
  });

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`report:confirm:${report.id}`).setLabel("Confirmer").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`report:modify:${report.id}`).setLabel("Modifier").setStyle(ButtonStyle.Secondary),
  );

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(config.COLORS.MAIN)
        .setTitle("Synthese IA du dossier")
        .setDescription(
          [
            `Gravite: **${analysis.severity}**`,
            `Raisonnement: ${analysis.reasoning}`,
            "",
            `Qui: ${analysis.qqoqccp.qui}`,
            `Quoi: ${analysis.qqoqccp.quoi}`,
            `Ou: ${analysis.qqoqccp.ou}`,
            `Quand: ${analysis.qqoqccp.quand}`,
            `Comment: ${analysis.qqoqccp.comment}`,
            `Combien: ${analysis.qqoqccp.combien}`,
            `Pourquoi: ${analysis.qqoqccp.pourquoi}`,
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
    await interaction.reply({ content: "Metadonnees du ticket introuvables.", flags: MessageFlags.Ephemeral });
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
      ? "Des informations supplementaires sont necessaires. Reponds dans le ticket puis clique sur `J'ai repondu`."
      : "La synthese IA est prete. Confirme ou demande une unique modification dans le ticket.",
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
  await channel.send({ content: "Ticket annule. Ce salon sera supprime dans 5 secondes." });
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

  const analysis = safeParseJSON<StoredReportAnalysis>(report.aiQQOQCCP);
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
    reason: analysis.reasoning,
    severity: analysis.severity,
      category: analysis.qqoqccp.quoi || "report",
      warnSuffices: analysis.warnSuffices,
      source: { kind: "report", id: report.id, channel },
    });

  await interaction.reply({ content: "Signalement confirme et sanction appliquee.", flags: MessageFlags.Ephemeral });
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
  await channel.send("Ajoute les corrections souhaitees dans le ticket puis clique de nouveau sur **Deposer le signalement**.");
  await interaction.reply({ content: "Ticket repasse en mode edition.", flags: MessageFlags.Ephemeral });
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
      ? "De nouvelles informations sont encore necessaires."
      : "La synthese IA a ete regeneree.",
  });
}

async function handleAppeal(interaction: ButtonInteraction): Promise<void> {
  const [, sourceKind, thirdPart, fourthPart] = interaction.customId.split(":");
  const guildID = await resolveAppealGuildID(
    interaction,
    sourceKind,
    fourthPart ?? thirdPart,
    fourthPart ? thirdPart : undefined,
  );
  const sourceId = fourthPart ?? thirdPart;

  if (!guildID) {
    await interaction.reply({ content: "Serveur introuvable pour cet appel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const source = sourceKind === "flag"
    ? await flaggedMessageApiService.list(guildID).then((items) => items.find((item) => item.id === sourceId) ?? null)
    : await moderationReportApiService.get(guildID, sourceId).catch(() => null);

  if (!source) {
    await interaction.reply({ content: "Element de moderation introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const targetUserID = source.targetUserID;
  if (interaction.user.id !== targetUserID) {
    await interaction.reply({ content: "Seul l'utilisateur sanctionne peut faire appel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${APPEAL_MODAL_PREFIX}${sourceKind}:${sourceId}`)
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
    filter: (modalInteraction) => modalInteraction.customId === `${APPEAL_MODAL_PREFIX}${sourceKind}:${sourceId}` && modalInteraction.user.id === interaction.user.id,
  }).catch(() => null);

  if (!submitted) return;

  const appealText = submitted.fields.getTextInputValue("appeal_text").trim();
  if (sourceKind === "flag") {
    await flaggedMessageApiService.update(guildID, sourceId, {
      appealText,
      appealStatus: "pending_review",
      appealAt: Date.now(),
    });
  } else {
    await moderationReportApiService.update(guildID, sourceId, {
      appealText,
      appealStatus: "pending_review",
      appealAt: Date.now(),
    });
  }

  await submitted.reply({ content: "Appel enregistre.", flags: MessageFlags.Ephemeral });
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
      description: "Signaler un utilisateur a la moderation",
      options: [
        {
          name: "utilisateur",
          description: "L'utilisateur a signaler",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit etre utilisee dans un serveur.", flags: MessageFlags.Ephemeral });
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
    await interaction.editReply({ content: `Ton ticket a ete cree : ${channel}` });
  }
}

export class ReportContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Report");
  }

  async execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit etre utilisee dans un serveur.", flags: MessageFlags.Ephemeral });
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
    await interaction.editReply({ content: `Ton ticket a ete cree : ${channel}` });
  }
}

export class ReportMessageContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Signaler", ApplicationCommandType.Message);
  }

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit etre utilisee dans un serveur.", flags: MessageFlags.Ephemeral });
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

    const flagged = await flaggedMessageApiService.create({
      guildID: interaction.guild.id,
      channelID: targetMessage.channelId,
      messageID: targetMessage.id,
      reporterID: interaction.user.id,
      targetUserID: target.id,
      status: "pending",
    });

    const contextMessages = await collectContextMessages(targetMessage);
    const analysis = await analyzeFlag({
      reporterID: interaction.user.id,
      targetUserID: target.id,
      messageContent: targetMessage.content,
      contextMessages,
    });

    await flaggedMessageApiService.update(interaction.guild.id, flagged.id, {
      aiAnalysis: analysis,
      status: "analyzed",
    });

    if (analysis.isBlackHumor) {
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "dismissed" });
      await interaction.editReply({ content: "Le message a ete classe comme humour noir sans sanction automatique." });
      return;
    }

    if (analysis.isInsult && analysis.requiresCertification && analysis.insultTargetID !== interaction.user.id) {
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "needs_certification" });
      await interaction.editReply({ content: "Le dossier demande une certification de la victime. Utilise le flux de ticket pour fournir plus de contexte." });
      return;
    }

    if (analysis.needsMoreContext) {
      const channel = await openTicket(interaction.guild, interaction.user, target);
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "escalated" });
      await interaction.editReply({ content: `Le message demande plus de contexte. Un ticket a ete cree : ${channel}` });
      return;
    }

    if (!analysis.isViolation) {
      await flaggedMessageApiService.update(interaction.guild.id, flagged.id, { status: "dismissed" });
      await interaction.editReply({ content: "Aucune violation suffisamment claire n'a ete detectee pour une sanction automatique." });
      return;
    }

    await applyAutomaticSanction({
      guild: interaction.guild,
      target,
      moderator: interaction.client.user,
      reason: analysis.reasoning,
      severity: analysis.severity,
      category: analysis.category,
      warnSuffices: analysis.warnSuffices,
      source: { kind: "flag", id: flagged.id, message: targetMessage },
    });

    await interaction.editReply({ content: "Signalement traite automatiquement." });
  }
}

export const contextMenus = [ReportContextMenuCommand, ReportMessageContextMenuCommand];
