import type { SummaryResult } from "@/ai";
import { analyzeFlag, summarizeReport } from "@/ai";
import { appealApiService, flaggedMessageApiService, guildSettingsService, moderationReportApiService, sanctionApiService } from "@/api";
import { config } from "@/app";
import {
  buildFollowUpAction,
  buildReportSummaryActions,
  buildReportSummaryEmbed,
  buildReviseAction,
  MODERATION_MESSAGES,
} from "@/discord/components/moderation/moderationMessages";
import { getAlreadySanctionedMessageIDs, processTicketAnalysis } from "@/discord/components/moderation/reportService";
import { applyAutomaticSanction } from "@/discord/components/moderation/sanctionHelpers";
import { collectContextMessages, collectTicketMessages, ticketMessagesToTranscript } from "@/discord/components/moderation/ticketTranscript";
import { componentRouter } from "@/discord/interactions";
import { safeParseJSON } from "@/discord/utils/json";
import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  User,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { decodeTicketMeta, openTicket } from "./ticket";

const APPEAL_MODAL_PREFIX = "appeal:modal:";

type StoredReportAnalysis = SummaryResult;

async function hasReporterTextMessageSince(
  channel: TextChannel,
  reporterID: string,
  sinceTimestamp: number,
): Promise<boolean> {
  const allMessages = await channel.messages.fetch({ limit: 100 });
  return [...allMessages.values()].some(
    (message) =>
      !message.author.bot &&
      message.author.id === reporterID &&
      message.createdTimestamp > sinceTimestamp &&
      message.content.trim() !== "",
  );
}

export async function sendAnalysisResult(
  channel: TextChannel,
  reportId: string,
  summary: SummaryResult,
  allowModify: boolean,
): Promise<{ kind: "follow_up" | "ready" }> {
  if (summary.needsFollowUp) {
    await channel.send({
      content: MODERATION_MESSAGES.followUpContent(summary.questions),
      components: [buildFollowUpAction(reportId)],
    });
    return { kind: "follow_up" };
  }

  await channel.send({
    embeds: [buildReportSummaryEmbed(summary, allowModify)],
    components: [buildReportSummaryActions(reportId, allowModify)],
  });
  return { kind: "ready" };
}

export async function executeOpenTicket(
  interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction,
  target: User,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (target.id === interaction.user.id) {
    await interaction.reply({ content: "Tu ne peux pas te signaler toi-meme.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (target.bot) {
    await interaction.reply({ content: "Tu ne peux pas signaler un bot.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = await openTicket(interaction.guild, interaction.user, target, interaction.channelId);
  await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.ticketCreated(`${channel}`) });
}

export async function handleFlaggedMessage(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const targetMessage = interaction.targetMessage;
  const target = targetMessage.author;

  const contextMessages = await collectContextMessages(targetMessage);
  const alreadySanctionedMessageIDs = await getAlreadySanctionedMessageIDs(guild.id, target.id);
  if (!config.ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS && alreadySanctionedMessageIDs.has(targetMessage.id)) {
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.duplicateFlag });
    return;
  }

  const reporterDisplayName =
    interaction.member && typeof interaction.member === "object" && "displayName" in interaction.member
      ? (interaction.member as { displayName: string }).displayName
      : interaction.user.globalName ?? interaction.user.username;
  const messageMentions = [...targetMessage.mentions.users.values()].map((user) => ({
    id: user.id,
    username: user.username,
    displayName: guild.members.cache.get(user.id)?.displayName ?? user.globalName ?? user.username,
  }));

  const flagged = await flaggedMessageApiService.create({
    guildID: guild.id,
    channelID: targetMessage.channelId,
    messageID: targetMessage.id,
    reporterID: interaction.user.id,
    targetUserID: target.id,
    status: "pending",
    context: contextMessages,
  });

  const analysis = await analyzeFlag({
    guildID: guild.id,
    reporterID: interaction.user.id,
    reporterUsername: interaction.user.username,
    reporterDisplayName,
    targetUserID: target.id,
    targetUsername: target.username,
    targetDisplayName: guild.members.cache.get(target.id)?.displayName ?? target.globalName ?? target.username,
    messageMentions,
    messageContent: targetMessage.content,
    messageCreatedAt: targetMessage.createdTimestamp,
    contextMessages,
    alreadySanctionedMessageIDs,
  });

  const resolvedVictimUserID = analysis.victimUserID && analysis.victimUserID !== target.id
    ? analysis.victimUserID
    : null;

  console.info("[report][target-debug]", {
    guildID: guild.id,
    channelID: targetMessage.channelId,
    messageID: targetMessage.id,
    reporterID: interaction.user.id,
    reporterUsername: interaction.user.username,
    reporterDisplayName,
    targetUserID: target.id,
    messageContent: targetMessage.content,
    messageMentions,
    aiAnalysis: analysis,
    wouldRequireCertification: Boolean(resolvedVictimUserID && resolvedVictimUserID !== interaction.user.id),
  });

  await flaggedMessageApiService.update(guild.id, flagged.id, {
    aiAnalysis: { ...analysis, victimUserID: resolvedVictimUserID },
    status: "analyzed",
  });

  if (!analysis.isViolation) {
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "dismissed" });
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.noAutomaticViolation });
    return;
  }

  if (analysis.isTargeted && !resolvedVictimUserID) {
    const channel = await openTicket(guild, interaction.user, target, targetMessage.channelId);
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "escalated" });
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.unidentifiedVictim(`${channel}`) });
    return;
  }

  if (analysis.isTargeted && resolvedVictimUserID && resolvedVictimUserID !== interaction.user.id) {
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "needs_certification" });
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.targetedVictimOnly });
    return;
  }

  if (analysis.needsMoreContext) {
    const channel = await openTicket(guild, interaction.user, target, targetMessage.channelId);
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "escalated" });
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.moreContextNeeded(`${channel}`) });
    return;
  }

  await applyAutomaticSanction({
    guild,
    target,
    moderator: interaction.client.user,
    reason: analysis.reason,
    severity: analysis.severity,
    sanctionKind: analysis.sanctionKind,
    nature: analysis.nature,
    aiSummary: null,
    source: { kind: "flag", id: flagged.id, message: targetMessage },
  });

  await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.automaticallyProcessed });
}

async function handleTicketSubmit(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.slice("report:submit:".length);
  if (!interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;

  const meta = decodeTicketMeta(channel.topic);
  if (!meta) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.ticketMetadataNotFound, flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.onlyReporterCanFinalize, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const allMessages = await channel.messages.fetch({ limit: 100 });
  const hasUserContent = [...allMessages.values()].some(
    (m) => !m.author.bot && m.author.id === meta.reporterID && m.content.trim() !== "",
  );
  if (!hasUserContent) {
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.missingTicketContent });
    return;
  }

  const { reportId, summary } = await processTicketAnalysis(interaction.guild, channel, meta);

  if (summary.isTargeted && summary.victimUserID && summary.victimUserID !== meta.reporterID) {
    await moderationReportApiService.update(interaction.guild.id, reportId, { status: "dismissed" });
    await interaction.editReply({ content: MODERATION_MESSAGES.interactionReplies.targetedTicketRejected });
    await channel.send(MODERATION_MESSAGES.channelPosts.ticketRejected);
    setTimeout(() => void channel.delete().catch(() => undefined), 30_000);
    return;
  }

  const result = await sendAnalysisResult(channel, reportId, summary, true);
  await interaction.editReply({
    content: result.kind === "follow_up"
      ? MODERATION_MESSAGES.interactionReplies.followUpNeeded
      : MODERATION_MESSAGES.interactionReplies.summaryReady,
  });
}

async function handleTicketCancel(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.slice("report:cancel:".length);
  if (!interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;

  const meta = decodeTicketMeta(channel.topic);
  const canModerateTicket =
    interaction.user.id === meta?.reporterID ||
    interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);

  if (!meta || !canModerateTicket) {
    await interaction.reply({
      content: MODERATION_MESSAGES.interactionReplies.ticketCancelDenied,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update({ components: [] });
  await channel.send({ content: MODERATION_MESSAGES.channelPosts.ticketCancelled });
  setTimeout(() => void channel.delete().catch(() => undefined), 5000);
}

async function handleReportConfirm(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:confirm:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.reportNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const analysis = safeParseJSON<StoredReportAnalysis>(report.context?.aiSummary);
  if (!analysis) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.analysisNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.ticketChannelNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.onlyReporterCanConfirm, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [] }).catch(() => undefined);

  const target = await interaction.client.users.fetch(report.targetUserID);
  if (!analysis.isViolation || analysis.severity === "NONE") {
    await moderationReportApiService.update(interaction.guild.id, report.id, {
      status: "dismissed",
      context: { messages: report.context?.messages ?? [], aiSummary: analysis },
    });
    await channel.send(MODERATION_MESSAGES.channelPosts.reportConfirmedNoSanction);
    setTimeout(() => void channel.delete().catch(() => undefined), 30_000);
    return;
  }

  // Guard: block if all target messages in context are already sanctioned
  if (!config.ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS) {
    const sanctionedIDs = await getAlreadySanctionedMessageIDs(interaction.guild.id, report.targetUserID);
    const targetMessages = (report.context?.messages ?? []).filter((m): m is typeof m & { id: string } => m.authorID === report.targetUserID && m.id != null);
    if (targetMessages.length > 0 && targetMessages.every((m) => sanctionedIDs.has(m.id))) {
      await interaction.followUp({ content: MODERATION_MESSAGES.interactionReplies.duplicateFlag, flags: MessageFlags.Ephemeral });
      return;
    }
  }

  await applyAutomaticSanction({
    guild: interaction.guild,
    target,
    moderator: interaction.client.user,
    reason: analysis.reason,
    severity: analysis.severity,
    sanctionKind: analysis.sanctionKind,
    nature: analysis.nature,
    aiSummary: analysis.summary,
    source: { kind: "report", id: report.id, channel, reporterID: meta?.reporterID, originChannelID: meta?.originChannelID ?? interaction.guild.systemChannelId ?? null },
  });

  await channel.send(MODERATION_MESSAGES.channelPosts.reportConfirmedWithSanction);
  setTimeout(() => void channel.delete().catch(() => undefined), 30_000);
}

async function handleReportModify(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:modify:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.reportNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.ticketChannelNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.onlyReporterCanModify, flags: MessageFlags.Ephemeral });
    return;
  }
  if (report.confirmationCount >= 1) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.singleModifyOnly, flags: MessageFlags.Ephemeral });
    return;
  }

  await moderationReportApiService.update(interaction.guild.id, reportId, {
    status: "awaiting_reporter",
    confirmationCount: report.confirmationCount + 1,
  });

  await channel.send({
    content: MODERATION_MESSAGES.channelPosts.modifyPrompt,
    components: [buildReviseAction(reportId)],
  });
  await interaction.update({ components: [] });
}

async function handleReportRevise(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:revise:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.reportNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.ticketChannelNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.onlyReporterCanSubmit, flags: MessageFlags.Ephemeral });
    return;
  }
  if (!(await hasReporterTextMessageSince(channel, meta!.reporterID, interaction.message.createdTimestamp))) {
    await interaction.reply({
      content: MODERATION_MESSAGES.interactionReplies.addDetailsBeforeRevise,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update({ components: [] });
  await interaction.followUp({ content: MODERATION_MESSAGES.interactionReplies.analysisInProgress, flags: MessageFlags.Ephemeral });

  const ticketMessages = await collectTicketMessages(channel);
  const transcript = await ticketMessagesToTranscript(interaction.guild, ticketMessages);
  const summary = await summarizeReport({
    guildID: interaction.guild.id,
    reporterID: meta!.reporterID,
    targetUserID: meta!.targetUserID,
    transcript,
    anchorTimestamp: ticketMessages[0]?.createdAt ?? Date.now(),
  });

  await moderationReportApiService.update(interaction.guild.id, reportId, {
    status: summary.needsFollowUp ? "awaiting_reporter" : "awaiting_confirmation",
    reporterSummary: transcript,
    context: { messages: ticketMessages, aiSummary: summary },
  });

  await sendAnalysisResult(channel, reportId, summary, false);
}

async function handleReportFollowUp(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:followup:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.reportNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.ticketChannelNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.onlyReporterCanFollowUp, flags: MessageFlags.Ephemeral });
    return;
  }
  if (!(await hasReporterTextMessageSince(channel, meta!.reporterID, interaction.message.createdTimestamp))) {
    await interaction.reply({
      content: MODERATION_MESSAGES.interactionReplies.replyBeforeFollowUp,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { reportId: id, summary } = await processTicketAnalysis(interaction.guild, channel, meta!);
  const result = await sendAnalysisResult(channel, id, summary, true);
  await interaction.editReply({
    content: result.kind === "follow_up"
      ? MODERATION_MESSAGES.interactionReplies.followUpStillNeeded
      : MODERATION_MESSAGES.interactionReplies.summaryRegenerated,
  });
}

async function sendModerationNotif(
  guild: NonNullable<ButtonInteraction["guild"]>,
  content: string,
  embed: EmbedBuilder,
): Promise<void> {
  const settings = await guildSettingsService.getByGuildID(guild.id).catch(() => null);
  if (!settings?.moderationNotifChannelID) return;

  const channel = await guild.channels.fetch(settings.moderationNotifChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;

  await channel.send({ content, embeds: [embed] }).catch(() => undefined);
}

async function handleReportDispute(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:dispute:".length);
  if (!interaction.guild) return;

  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.reportNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.ticketChannelNotFound, flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.onlyReporterCanConfirm, flags: MessageFlags.Ephemeral });
    return;
  }

  await moderationReportApiService.update(interaction.guild.id, reportId, { status: "human_review_requested" });
  await interaction.update({ components: [] });
  await channel.send(MODERATION_MESSAGES.disputeAcknowledged);
  setTimeout(() => void channel.delete().catch(() => undefined), 30_000);

  const settings = await guildSettingsService.getByGuildID(interaction.guild.id).catch(() => null);
  const roleID = settings?.moderationModRoleID || null;
  const dashboardURL = config.DASHBOARD_URL;
  const deepLink = dashboardURL
    ? `${dashboardURL}/moderation?guild=${interaction.guild.id}&tab=reports&reportId=${reportId}`
    : null;

  const reporter = await interaction.client.users.fetch(report.reporterID).catch(() => null);
  const target = await interaction.client.users.fetch(report.targetUserID).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(MODERATION_MESSAGES.disputeNotifEmbed.title)
    .addFields(
      { name: MODERATION_MESSAGES.disputeNotifEmbed.reporterField, value: reporter ? `${reporter} (${reporter.username})` : report.reporterID, inline: true },
      { name: MODERATION_MESSAGES.disputeNotifEmbed.targetField, value: target ? `${target} (${target.username})` : report.targetUserID, inline: true },
    )
    .setTimestamp();

  if (deepLink) {
    embed.setDescription(`[${MODERATION_MESSAGES.disputeNotifEmbed.linkLabel}](${deepLink})`);
  }

  await sendModerationNotif(
    interaction.guild,
    MODERATION_MESSAGES.disputeNotifContent(roleID),
    embed,
  );
}

async function handleAppeal(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  // Format: appeal:sanction:<guildID>:<sanctionID>
  if (parts[1] !== "sanction" || parts.length < 4) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.sanctionUnavailable, flags: MessageFlags.Ephemeral });
    return;
  }

  const [, , guildID, sanctionID] = parts;

  const sanctionList = await sanctionApiService.list(guildID, {}).catch(() => []);
  const sanction = sanctionList.find((s) => s.id === sanctionID);
  if (!sanction) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.sanctionNotFound, flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== sanction.userID) {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.appealOwnerOnly, flags: MessageFlags.Ephemeral });
    return;
  }

  if (sanction.state === "canceled") {
    await interaction.reply({ content: MODERATION_MESSAGES.interactionReplies.sanctionAlreadyReviewed, flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${APPEAL_MODAL_PREFIX}${guildID}:${sanctionID}`)
    .setTitle(MODERATION_MESSAGES.appealModal.title);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("appeal_text")
        .setLabel(MODERATION_MESSAGES.appealModal.fieldLabel)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
  );

  await interaction.showModal(modal);
  const submitted = await interaction.awaitModalSubmit({
    time: 120_000,
    filter: (m) => m.customId === `${APPEAL_MODAL_PREFIX}${guildID}:${sanctionID}` && m.user.id === interaction.user.id,
  }).catch(() => null);

  if (!submitted) return;

  const appeal = await appealApiService.create(guildID, sanctionID, submitted.fields.getTextInputValue("appeal_text").trim());
  await submitted.reply({ content: MODERATION_MESSAGES.interactionReplies.appealRecorded, flags: MessageFlags.Ephemeral });

  const guild = interaction.client.guilds.cache.get(guildID) ?? await interaction.client.guilds.fetch(guildID).catch(() => null);
  if (!guild) return;

  const settings = await guildSettingsService.getByGuildID(guildID).catch(() => null);
  const roleID = settings?.moderationModRoleID || null;
  const dashboardURL = config.DASHBOARD_URL;
  const deepLink = dashboardURL
    ? `${dashboardURL}/moderation?guild=${guildID}&tab=appeals&appealId=${appeal.id}`
    : null;

  let sanctionTypeLabel: string;
  if (sanction.type === "WARN") sanctionTypeLabel = "Avertissement";
  else if (sanction.type === "MUTE") sanctionTypeLabel = "Exclusion temporaire";
  else sanctionTypeLabel = "Bannissement";
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(MODERATION_MESSAGES.appealNotifEmbed.title)
    .addFields(
      { name: MODERATION_MESSAGES.appealNotifEmbed.userField, value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
      { name: MODERATION_MESSAGES.appealNotifEmbed.sanctionField, value: sanctionTypeLabel, inline: true },
    )
    .setTimestamp();

  if (deepLink) {
    embed.setDescription(`[${MODERATION_MESSAGES.appealNotifEmbed.linkLabel}](${deepLink})`);
  }

  await sendModerationNotif(guild, MODERATION_MESSAGES.appealNotifContent(roleID), embed);
}

// Registers all component interaction handlers (idempotent, safe for hot-reload)
const globalState = globalThis as unknown as { __pouletModerationHandlersRegistered?: boolean };
if (!globalState.__pouletModerationHandlersRegistered) {
  globalState.__pouletModerationHandlersRegistered = true;

  componentRouter.registerPrefix("report:submit:", async (i) => { if (i.isButton()) await handleTicketSubmit(i); });
  componentRouter.registerPrefix("report:cancel:", async (i) => { if (i.isButton()) await handleTicketCancel(i); });
  componentRouter.registerPrefix("report:confirm:", async (i) => { if (i.isButton()) await handleReportConfirm(i); });
  componentRouter.registerPrefix("report:followup:", async (i) => { if (i.isButton()) await handleReportFollowUp(i); });
  componentRouter.registerPrefix("report:modify:", async (i) => { if (i.isButton()) await handleReportModify(i); });
  componentRouter.registerPrefix("report:revise:", async (i) => { if (i.isButton()) await handleReportRevise(i); });
  componentRouter.registerPrefix("report:dispute:", async (i) => { if (i.isButton()) await handleReportDispute(i); });
  componentRouter.registerPrefix("appeal:", async (i) => { if (i.isButton()) await handleAppeal(i); });
}
