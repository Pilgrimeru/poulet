import type { SummaryResult } from "@/ai";
import { analyzeFlag, summarizeReport } from "@/ai";
import { appealApiService, flaggedMessageApiService, moderationReportApiService, sanctionApiService } from "@/api";
import { config } from "@/app";
import { getAlreadySanctionedMessageIDs, processTicketAnalysis } from "@/discord/components/moderation/reportService";
import { applyAutomaticSanction } from "@/discord/components/moderation/sanctionHelpers";
import { collectContextMessages, collectTicketMessages, ticketMessagesToTranscript } from "@/discord/components/moderation/ticketTranscript";
import { componentRouter } from "@/discord/interactions";
import { safeParseJSON } from "@/discord/utils/json";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
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

function buildSummaryDescription(summary: SummaryResult): string {
  return [
    `Violation: **${summary.isViolation ? "Oui" : "Non"}**`,
    `Gravite: **${summary.severity}**`,
    `Nature: **${summary.nature}**`,
    `Motif: ${summary.reason}`,
    "",
    summary.summary,
  ].join("\n");
}

export async function sendAnalysisResult(
  channel: TextChannel,
  reportId: string,
  summary: SummaryResult,
  allowModify: boolean,
): Promise<{ kind: "follow_up" | "ready" }> {
  if (summary.needsFollowUp) {
    await channel.send({
      content: summary.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`report:followup:${reportId}`)
            .setLabel("J'ai répondu")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return { kind: "follow_up" };
  }

  const buttons = [
    new ButtonBuilder().setCustomId(`report:confirm:${reportId}`).setLabel("Confirmer").setStyle(ButtonStyle.Success),
  ];
  if (allowModify) {
    buttons.push(new ButtonBuilder().setCustomId(`report:modify:${reportId}`).setLabel("Modifier").setStyle(ButtonStyle.Secondary));
  }

  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(allowModify ? "Synthese IA du dossier" : "Synthese IA — version finale")
    .setDescription(buildSummaryDescription(summary));
  if (!allowModify) {
    embed.setFooter({ text: "Dernière révision effectuée. Aucune modification supplémentaire possible." });
  }

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)],
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
  const channel = await openTicket(interaction.guild, interaction.user, target);
  await interaction.editReply({ content: `Ton ticket a été créé : ${channel}` });
}

export async function handleFlaggedMessage(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const targetMessage = interaction.targetMessage;
  const target = targetMessage.author;

  const contextMessages = await collectContextMessages(targetMessage);
  const alreadySanctionedMessageIDs = await getAlreadySanctionedMessageIDs(guild.id, target.id);
  if (!config.ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS && alreadySanctionedMessageIDs.has(targetMessage.id)) {
    await interaction.editReply({ content: "Ce message a déjà été pris en compte dans une sanction existante. Il ne peut pas être sanctionné une seconde fois." });
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
    contextMessages,
  });

  const isTargetedNature = analysis.nature === "Harassment" || analysis.nature === "Violence" || analysis.nature === "Hate";
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
    await interaction.editReply({ content: "Aucune violation suffisamment claire n'a été détectée pour une sanction automatique." });
    return;
  }

  if (isTargetedNature && !resolvedVictimUserID) {
    const channel = await openTicket(guild, interaction.user, target);
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "escalated" });
    await interaction.editReply({ content: `La victime n'est pas identifiable avec assez de certitude. Un ticket a été créé : ${channel}` });
    return;
  }

  if (resolvedVictimUserID && resolvedVictimUserID !== interaction.user.id) {
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "needs_certification" });
    await interaction.editReply({ content: "Cette insulte ciblée ne peut être signalée que par la personne visée. Utilise le flux de ticket si tu es la victime." });
    return;
  }

  if (analysis.needsMoreContext) {
    const channel = await openTicket(guild, interaction.user, target);
    await flaggedMessageApiService.update(guild.id, flagged.id, { status: "escalated" });
    await interaction.editReply({ content: `Le message demande plus de contexte. Un ticket a été créé : ${channel}` });
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
    source: { kind: "flag", id: flagged.id, message: targetMessage },
  });

  await interaction.editReply({ content: "Signalement traite automatiquement." });
}

async function handleTicketSubmit(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.slice("report:submit:".length);
  if (!interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;

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

  const allMessages = await channel.messages.fetch({ limit: 100 });
  const hasUserContent = [...allMessages.values()].some(
    (m) => !m.author.bot && m.author.id === meta.reporterID && m.content.trim() !== "",
  );
  if (!hasUserContent) {
    await interaction.editReply({ content: "Décris d'abord le comportement reproché avant de déposer le signalement." });
    return;
  }

  const { reportId, summary } = await processTicketAnalysis(interaction.guild, channel, meta);
  const result = await sendAnalysisResult(channel, reportId, summary, true);
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
  if (channel?.type !== ChannelType.GuildText) return;

  const meta = decodeTicketMeta(channel.topic);
  const canModerateTicket =
    interaction.user.id === meta?.reporterID ||
    interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);

  if (!meta || !canModerateTicket) {
    await interaction.reply({
      content: "Seul le signaleur, le propriétaire du serveur ou un membre pouvant supprimer des messages peut annuler ce ticket.",
      flags: MessageFlags.Ephemeral,
    });
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
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Salon du ticket introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut confirmer ce dossier.", flags: MessageFlags.Ephemeral });
    return;
  }

  const target = await interaction.client.users.fetch(report.targetUserID);
  if (!analysis.isViolation || analysis.severity === "NONE") {
    await moderationReportApiService.update(interaction.guild.id, report.id, {
      status: "dismissed",
      context: { messages: report.context?.messages ?? [], aiSummary: analysis },
    });
    await channel.send("Le dossier a ete confirme sans sanction: aucune infraction n'a ete etablie.");
    await interaction.reply({ content: "Dossier confirmé sans sanction.", flags: MessageFlags.Ephemeral });
    return;
  }

  await applyAutomaticSanction({
    guild: interaction.guild,
    target,
    moderator: interaction.client.user,
    reason: analysis.reason,
    severity: analysis.severity,
    sanctionKind: analysis.sanctionKind,
    nature: analysis.nature,
    source: { kind: "report", id: report.id, channel, reporterID: meta?.reporterID },
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
  if (channel?.type !== ChannelType.GuildText) {
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

  await channel.send({
    content: "Ajoute tes précisions dans le ticket. Une fois terminé, clique sur le bouton ci-dessous pour relancer l'analyse.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`report:revise:${reportId}`)
          .setLabel("J'ai ajouté mes précisions")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("✏️"),
      ),
    ],
  });
  await interaction.update({ components: [] });
}

async function handleReportRevise(interaction: ButtonInteraction): Promise<void> {
  const reportId = interaction.customId.slice("report:revise:".length);
  if (!interaction.guild) return;
  const report = await moderationReportApiService.get(interaction.guild.id, reportId).catch(() => null);
  if (!report) {
    await interaction.reply({ content: "Signalement introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Salon du ticket introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut soumettre ce dossier.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.update({ components: [] });
  await interaction.followUp({ content: "Analyse en cours...", flags: MessageFlags.Ephemeral });

  const ticketMessages = await collectTicketMessages(channel);
  const transcript = await ticketMessagesToTranscript(interaction.guild, ticketMessages);
  const summary = await summarizeReport({
    guildID: interaction.guild.id,
    reporterID: meta!.reporterID,
    targetUserID: meta!.targetUserID,
    transcript,
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
    await interaction.reply({ content: "Signalement introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await interaction.guild.channels.fetch(report.ticketChannelID).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "Salon du ticket introuvable.", flags: MessageFlags.Ephemeral });
    return;
  }

  const meta = decodeTicketMeta(channel.topic);
  if (meta && interaction.user.id !== meta.reporterID) {
    await interaction.reply({ content: "Seul le signaleur peut relancer l'analyse.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { reportId: id, summary } = await processTicketAnalysis(interaction.guild, channel, meta!);
  const result = await sendAnalysisResult(channel, id, summary, true);
  await interaction.editReply({
    content: result.kind === "follow_up"
      ? "De nouvelles informations sont encore nécessaires."
      : "La synthèse IA a été régénérée.",
  });
}

async function handleAppeal(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  // Format: appeal:sanction:<guildID>:<sanctionID>
  if (parts[1] !== "sanction" || parts.length < 4) {
    await interaction.reply({ content: "Cette sanction n'est plus accessible. Contactez un modérateur.", flags: MessageFlags.Ephemeral });
    return;
  }

  const [, , guildID, sanctionID] = parts;

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
    filter: (m) => m.customId === `${APPEAL_MODAL_PREFIX}${guildID}:${sanctionID}` && m.user.id === interaction.user.id,
  }).catch(() => null);

  if (!submitted) return;

  await appealApiService.create(guildID, sanctionID, submitted.fields.getTextInputValue("appeal_text").trim());
  await submitted.reply({ content: "Appel enregistré.", flags: MessageFlags.Ephemeral });
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
  componentRouter.registerPrefix("appeal:", async (i) => { if (i.isButton()) await handleAppeal(i); });
}
