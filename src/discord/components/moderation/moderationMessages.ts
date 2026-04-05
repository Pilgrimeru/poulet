import { config } from "@/app";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type User } from "discord.js";

type SummaryShape = {
  isViolation: boolean;
  severity: string;
  nature: string;
  reason: string;
  summary: string;
};

export const MODERATION_MESSAGES = {
  spamTimeoutReply: "Tu spam, tu es relou.",
  singleMessageLimitNotice: (user: User) =>
    `${user} Tu ne peux envoyer qu'un seul message dans ce salon. Supprime ton message précédent pour en envoyer un nouveau.`,
  sanctionDmTitle: "Modération",
  sanctionDmHumanReviewNotice: "Si tu fais appel, ta demande sera traitée par un modérateur humain.",
  banPendingTitle: "Confirmation de bannissement requise",
  banPendingDescription: (target: User, reason: string) =>
    `L'utilisateur ${target} est exclu temporairement pendant 7 jours en attente d'une validation humaine pour un éventuel bannissement.\nMotif : ${reason}`,
  sanctionEmbedTitle: (username: string) => `Sanction : ${username}`,
  sanctionEmbedDescription: (reason: string) => `Motif : ${reason.trim() || "*[Non communiqué]*"}`,
  sanctionEmbedFields: {
    user: "👤 Utilisateur",
    moderator: "🛡️ Modérateur",
    decision: "⚖️ Décision",
    originalMessage: "💬 Message d'origine",
  },
  ticketWelcomeTitle: "📋 Signalement",
  ticketWelcomeDescription: (reporter: User, target: User) =>
    [
      `Bonjour ${reporter}, ton signalement concernant **${target.username}** va être analysé automatiquement puis, si nécessaire, transmis à la modération.`,
      "",
      "**Ce qui est demandé dans ce ticket :**",
      "- décrire précisément les faits reprochés",
      "- indiquer qui a fait quoi, quand et dans quel salon",
      "- joindre les preuves utiles, liens, captures ou contexte si nécessaire",
      "- expliquer brièvement pourquoi le comportement te semble sanctionnable",
      "",
      "⚠️ Tout mensonge, faux signalement, omission volontaire importante ou abus du système de modération peut entraîner de lourdes sanctions.",
      "Quand ton dossier est complet, clique sur **Déposer le signalement**.",
    ].join("\n"),
  ticketWelcomeFooter: (target: User) => `Signalement à l'encontre de ${target.username} (${target.id})`,
  ticketButtons: {
    submit: "Déposer le signalement",
    cancel: "Annuler",
  },
  followUpContent: (questions: string[]) => questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
  followUpButton: "J'ai répondu",
  summaryTitle: (allowModify: boolean) => (allowModify ? "Synthèse IA du dossier" : "Synthèse IA — version finale"),
  summaryDescription: (summary: SummaryShape) =>
    [
      `Violation: **${summary.isViolation ? "Oui" : "Non"}**`,
      `Gravité: **${summary.severity}**`,
      `Nature: **${summary.nature}**`,
      `Motif: ${summary.reason}`,
      "",
      summary.summary,
    ].join("\n"),
  summaryFinalFooter: "Dernière révision effectuée. Aucune modification supplémentaire possible.",
  summaryButtons: {
    confirm: "Confirmer",
    modify: "Modifier",
  },
  interactionReplies: {
    ticketCreated: (channelRef: string) => `Ton ticket a été créé : ${channelRef}`,
    duplicateFlag: "Ce message a déjà été pris en compte dans une sanction existante. Il ne peut pas être sanctionné une seconde fois.",
    noAutomaticViolation: "Aucune violation suffisamment claire n'a été détectée pour une sanction automatique.",
    unidentifiedVictim: (channelRef: string) => `La victime n'est pas identifiable avec assez de certitude. Un ticket a été créé : ${channelRef}`,
    targetedVictimOnly: "Cette insulte ciblée ne peut être signalée que par la personne visée. Utilise le flux de ticket si tu es la victime.",
    moreContextNeeded: (channelRef: string) => `Le message demande plus de contexte. Un ticket a été créé : ${channelRef}`,
    automaticallyProcessed: "Signalement traité automatiquement.",
    missingTicketContent: "Décris d'abord le comportement reproché avant de déposer le signalement.",
    targetedTicketRejected: "Ce signalement concerne une insulte ciblée : seule la personne visée peut le déposer.",
    followUpNeeded: "Des informations supplémentaires sont nécessaires. Réponds dans le ticket puis clique sur `J'ai répondu`.",
    summaryReady: "La synthèse IA est prête. Confirme ou demande une unique modification dans le ticket.",
    ticketCancelDenied:
      "Seul le signaleur, le propriétaire du serveur ou un membre pouvant supprimer des messages peut annuler ce ticket.",
    reportNotFound: "Signalement introuvable.",
    analysisNotFound: "Analyse IA introuvable.",
    ticketChannelNotFound: "Salon du ticket introuvable.",
    onlyReporterCanConfirm: "Seul le signaleur peut confirmer ce dossier.",
    onlyReporterCanModify: "Seul le signaleur peut demander une modification.",
    singleModifyOnly: "Une seule modification est autorisée pour ce ticket.",
    onlyReporterCanSubmit: "Seul le signaleur peut soumettre ce dossier.",
    addDetailsBeforeRevise: "Ajoute d'abord tes précisions dans le ticket avant de relancer l'analyse.",
    analysisInProgress: "Analyse en cours...",
    onlyReporterCanFollowUp: "Seul le signaleur peut relancer l'analyse.",
    replyBeforeFollowUp: "Réponds d'abord dans le ticket avant de cliquer sur `J'ai répondu`.",
    followUpStillNeeded: "De nouvelles informations sont encore nécessaires.",
    summaryRegenerated: "La synthèse IA a été régénérée.",
    sanctionUnavailable: "Cette sanction n'est plus accessible. Contactez un modérateur.",
    sanctionNotFound: "Sanction introuvable.",
    appealOwnerOnly: "Seul l'utilisateur sanctionné peut faire appel.",
    appealRecorded: "Appel enregistré. Il sera étudié par un modérateur humain.",
    ticketMetadataNotFound: "Métadonnées du ticket introuvables.",
    onlyReporterCanFinalize: "Seul le signaleur peut finaliser ce ticket.",
  },
  channelPosts: {
    ticketRejected: "Signalement rejeté : seule la victime identifiée peut soumettre ce dossier. Ce salon sera supprimé dans 30 secondes.",
    ticketCancelled: "Ticket annulé. Ce salon sera supprimé dans 5 secondes.",
    reportConfirmedNoSanction: "Le dossier a été confirmé sans sanction : aucune infraction n'a été établie. Ce salon sera supprimé dans 30 secondes.",
    reportConfirmedWithSanction: "Signalement confirmé et sanction appliquée. Ce salon sera supprimé dans 30 secondes.",
    modifyPrompt: "Ajoute tes précisions dans le ticket. Une fois terminé, clique sur le bouton ci-dessous pour relancer l'analyse.",
  },
  reviseButton: "J'ai ajouté mes précisions",
  appealModal: {
    title: "Faire appel",
    fieldLabel: "Pourquoi revoir cette sanction ?",
  },
  appealButton: "Faire appel",
  warnSent: "Signalement envoyé.",
};

export function buildTicketWelcomeEmbed(reporter: User, target: User): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(MODERATION_MESSAGES.ticketWelcomeTitle)
    .setDescription(MODERATION_MESSAGES.ticketWelcomeDescription(reporter, target))
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: MODERATION_MESSAGES.ticketWelcomeFooter(target) })
    .setTimestamp();
}

export function buildTicketWelcomeActions(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report:submit:${channelId}`)
      .setLabel(MODERATION_MESSAGES.ticketButtons.submit)
      .setStyle(ButtonStyle.Success)
      .setEmoji("📨"),
    new ButtonBuilder()
      .setCustomId(`report:cancel:${channelId}`)
      .setLabel(MODERATION_MESSAGES.ticketButtons.cancel)
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️"),
  );
}

export function buildReportSummaryEmbed(summary: SummaryShape, allowModify: boolean): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.COLORS.MAIN)
    .setTitle(MODERATION_MESSAGES.summaryTitle(allowModify))
    .setDescription(MODERATION_MESSAGES.summaryDescription(summary));

  if (!allowModify) {
    embed.setFooter({ text: MODERATION_MESSAGES.summaryFinalFooter });
  }

  return embed;
}

export function buildReportSummaryActions(reportId: string, allowModify: boolean): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report:confirm:${reportId}`)
      .setLabel(MODERATION_MESSAGES.summaryButtons.confirm)
      .setStyle(ButtonStyle.Success),
  );

  if (allowModify) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`report:modify:${reportId}`)
        .setLabel(MODERATION_MESSAGES.summaryButtons.modify)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return row;
}

export function buildFollowUpAction(reportId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report:followup:${reportId}`)
      .setLabel(MODERATION_MESSAGES.followUpButton)
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildReviseAction(reportId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report:revise:${reportId}`)
      .setLabel(MODERATION_MESSAGES.reviseButton)
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✏️"),
  );
}
