import { applicationService } from "@/api";
import type { ApplicationFormDTO, ApplicationSessionDTO, Question } from "@/api";
import { bot } from "@/app/runtime";
import { config } from "@/app/config";
import { componentRouter } from "@/discord/interactions/ComponentRouter";
import type { AnyDispatchableInteraction } from "@/discord/interactions/ComponentRouter";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { randomBytes } from "node:crypto";

function genNonce(): string {
  return randomBytes(3).toString("hex");
}

function formatCooldownRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
  return parts.join(" ");
}

function buildQuestionEmbed(form: ApplicationFormDTO, step: number, question: Question): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Candidature : ${form.name}`)
    .setDescription(`**Question ${step + 1}/${form.questions.length}**\n\n${question.label}`)
    .setColor(config.COLORS.MAIN)
    .setFooter({ text: question.required ? "* Réponse obligatoire" : "Réponse facultative" });
}

function buildNavigationRow(
  prefix: string,
  step: number,
  totalSteps: number,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (step > 0) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}back`)
        .setLabel("← Retour")
        .setStyle(ButtonStyle.Secondary),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}cancel`)
      .setLabel("Annuler")
      .setStyle(ButtonStyle.Danger),
  );
  void totalSteps;
  return row;
}

function renderOpenTextQuestion(
  form: ApplicationFormDTO,
  session: ApplicationSessionDTO,
  step: number,
  prefix: string,
) {
  const question = form.questions[step]!;
  const hasAnswer = session.answers[question.id] !== undefined;

  const embed = buildQuestionEmbed(form, step, question);
  if (hasAnswer) {
    embed.addFields({ name: "Ta réponse actuelle", value: String(session.answers[question.id] ?? "").slice(0, 500) || "(vide)", inline: false });
  }

  const answerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}modal:${step}`)
      .setLabel(hasAnswer ? "✏️ Modifier" : "📝 Répondre")
      .setStyle(ButtonStyle.Primary),
  );

  const navRow = buildNavigationRow(prefix, step, form.questions.length);

  const components = [answerRow];
  if (navRow.components.length > 0) components.push(navRow as unknown as ActionRowBuilder<ButtonBuilder>);

  return { embeds: [embed.toJSON()], components };
}

function renderChoiceQuestion(
  form: ApplicationFormDTO,
  step: number,
  question: Question,
  prefix: string,
) {
  const embed = buildQuestionEmbed(form, step, question);
  const isMulti = question.type === "multiple_choice";

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${prefix}answer:${step}`)
      .setPlaceholder(question.placeholder ?? "Sélectionne une réponse")
      .setMinValues(
        question.required
          ? (isMulti ? (question.minValues ?? 1) : 1)
          : (isMulti ? (question.minValues ?? 0) : 0),
      )
      .setMaxValues(isMulti ? (question.maxValues ?? (question.options?.length ?? 1)) : 1)
      .addOptions(
        (question.options ?? []).slice(0, 25).map((opt) => ({
          label: opt.slice(0, 100),
          value: opt.slice(0, 100),
        })),
      ),
  );

  const navRow = buildNavigationRow(prefix, step, form.questions.length);
  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [selectRow];
  if (!question.required) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${prefix}skip:${step}`)
          .setLabel("Passer")
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }
  if (navRow.components.length > 0)
    components.push(navRow as unknown as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>);

  return { embeds: [embed.toJSON()], components };
}

function renderConfirmation(form: ApplicationFormDTO, session: ApplicationSessionDTO, prefix: string) {
  const embed = new EmbedBuilder()
    .setTitle("Récapitulatif de ta candidature")
    .setDescription(`Formulaire : **${form.name}**\n\nVérifie tes réponses avant d'envoyer.`)
    .setColor(config.COLORS.MAIN);

  const fields = form.questions
    .filter((q) => session.answers[q.id] !== undefined)
    .map((q) => {
      const raw = session.answers[q.id];
      const rawStr = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
      const value = rawStr.length > 1000 ? `${rawStr.slice(0, 997)}…` : rawStr || "(vide)";
      return { name: q.label.slice(0, 250), value, inline: false };
    });

  const displayFields = fields.length > 25
    ? [...fields.slice(0, 24), { name: "…", value: `+${fields.length - 24} réponse(s) supplémentaire(s)`, inline: false }]
    : fields;

  embed.addFields(displayFields);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}confirm`)
      .setLabel("✅ Envoyer ma candidature")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${prefix}cancel`)
      .setLabel("❌ Annuler")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed.toJSON()], components: [row] };
}

function registerScopedHandlers(
  formID: string,
  guildID: string,
  userID: string,
  nonce: string,
  sessionID: string,
  form: ApplicationFormDTO,
  originalInteraction: ButtonInteraction,
): void {
  const prefix = `apply:${formID}:${userID}:${nonce}:`;
  const ttl = form.sessionTimeoutMs;

  const unregister = () => componentRouter.unregisterPrefix(prefix);
  let isClosed = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const closeSession = async (): Promise<void> => {
    if (isClosed) return;
    isClosed = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    unregister();
    await applicationService.deleteSession(guildID, sessionID).catch(() => undefined);
  };

  componentRouter.registerPrefix(
    prefix,
    async (interaction: AnyDispatchableInteraction) => {
      const suffix = interaction.customId.slice(prefix.length);

      // Show modal for open text question
      if (suffix.startsWith("modal:") && interaction instanceof ButtonInteraction) {
        const step = Number(suffix.slice("modal:".length));
        const question = form.questions[step];
        if (!question) return;

        const modal = new ModalBuilder()
          .setCustomId(`${prefix}modalsubmit:${step}`)
          .setTitle(`Question ${step + 1}/${form.questions.length}`);

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("answer")
              .setLabel(question.label.slice(0, 45))
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(question.required)
              .setMaxLength(Math.min(question.maxLength ?? 2000, 4000))
              .setPlaceholder(question.placeholder?.slice(0, 100) ?? "Ta réponse…"),
          ),
        );

        await interaction.showModal(modal);
        return;
      }

      // Modal submitted for open text question
      if (suffix.startsWith("modalsubmit:") && interaction instanceof ModalSubmitInteraction) {
        const step = Number(suffix.slice("modalsubmit:".length));
        const question = form.questions[step];
        if (!question) { await interaction.deferUpdate(); return; }

        const answer = interaction.fields.getTextInputValue("answer").trim();
        if (question.required && !answer) {
          await interaction.reply({
            content: "Cette question est obligatoire. Merci d'écrire une réponse non vide.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
        if (!session) { await interaction.deferUpdate(); return; }

        const newAnswers = { ...session.answers, [question.id]: answer };
        const nextStep = step + 1;
        const updated = await applicationService.updateSession(guildID, session.id, {
          answers: newAnswers,
          currentStep: nextStep,
        }).catch(() => null);

        await interaction.deferUpdate();

        if (!updated) return;

        if (nextStep >= form.questions.length) {
          await originalInteraction.editReply(renderConfirmation(form, updated, prefix));
        } else {
          const nextQ = form.questions[nextStep]!;
          if (nextQ.type === "open_text") {
            await originalInteraction.editReply(renderOpenTextQuestion(form, updated, nextStep, prefix));
          } else {
            await originalInteraction.editReply(renderChoiceQuestion(form, nextStep, nextQ, prefix));
          }
        }
        return;
      }

      // Select menu answer for choice/multiple-choice
      if (suffix.startsWith("answer:") && interaction instanceof StringSelectMenuInteraction) {
        const step = Number(suffix.slice("answer:".length));
        const question = form.questions[step];
        if (!question) { await interaction.deferUpdate(); return; }

        const values = interaction.values;
        const answer = question.type === "multiple_choice" ? values : values[0] ?? "";

        const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
        if (!session) { await interaction.deferUpdate(); return; }

        const newAnswers = { ...session.answers, [question.id]: answer };
        const nextStep = step + 1;
        const updated = await applicationService.updateSession(guildID, session.id, {
          answers: newAnswers,
          currentStep: nextStep,
        }).catch(() => null);

        await interaction.deferUpdate();
        if (!updated) return;

        if (nextStep >= form.questions.length) {
          await originalInteraction.editReply(renderConfirmation(form, updated, prefix));
        } else {
          const nextQ = form.questions[nextStep]!;
          if (nextQ.type === "open_text") {
            await originalInteraction.editReply(renderOpenTextQuestion(form, updated, nextStep, prefix));
          } else {
            await originalInteraction.editReply(renderChoiceQuestion(form, nextStep, nextQ, prefix));
          }
        }
        return;
      }

      if (suffix.startsWith("skip:") && interaction instanceof ButtonInteraction) {
        const step = Number(suffix.slice("skip:".length));
        const question = form.questions[step];
        if (!question || question.required) {
          await interaction.deferUpdate();
          return;
        }

        const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
        if (!session) { await interaction.deferUpdate(); return; }

        const newAnswers = { ...session.answers };
        delete newAnswers[question.id];
        const nextStep = step + 1;
        const updated = await applicationService.updateSession(guildID, session.id, {
          answers: newAnswers,
          currentStep: nextStep,
        }).catch(() => null);

        await interaction.deferUpdate();
        if (!updated) return;

        if (nextStep >= form.questions.length) {
          await originalInteraction.editReply(renderConfirmation(form, updated, prefix));
        } else {
          const nextQ = form.questions[nextStep]!;
          if (nextQ.type === "open_text") {
            await originalInteraction.editReply(renderOpenTextQuestion(form, updated, nextStep, prefix));
          } else {
            await originalInteraction.editReply(renderChoiceQuestion(form, nextStep, nextQ, prefix));
          }
        }
        return;
      }

      // Back navigation
      if (suffix === "back" && interaction instanceof ButtonInteraction) {
        await interaction.deferUpdate();
        const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
        if (!session) return;

        const prevStep = Math.max(0, session.currentStep - 1);
        const updated = await applicationService.updateSession(guildID, session.id, {
          currentStep: prevStep,
        }).catch(() => null);
        if (!updated) return;

        const q = form.questions[prevStep]!;
        if (q.type === "open_text") {
          await originalInteraction.editReply(renderOpenTextQuestion(form, updated, prevStep, prefix));
        } else {
          await originalInteraction.editReply(renderChoiceQuestion(form, prevStep, q, prefix));
        }
        return;
      }

      // Confirm submission
      if (suffix === "confirm" && interaction instanceof ButtonInteraction) {
        await interaction.deferUpdate();
        const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
        if (!session) return;

        const result = await applicationService
          .createSubmission(guildID, formID, userID, session.answers)
          .catch((err: unknown) => {
            if (String(err).includes("409") || String(err).includes("active_submission")) return "conflict";
            return null;
          });

        await closeSession();

        if (result === "conflict") {
          await originalInteraction.editReply({
            content: "Tu as déjà une candidature en attente de révision.",
            embeds: [],
            components: [],
          });
          return;
        }

        if (!result) {
          await originalInteraction.editReply({
            content: "Une erreur est survenue lors de l'envoi. Réessaie plus tard.",
            embeds: [],
            components: [],
          });
          return;
        }

        // Notify submission channel
        if (form.submissionChannelID) {
          const channel = await bot.channels.fetch(form.submissionChannelID).catch(() => null);
          if (channel?.isTextBased() && channel.type !== ChannelType.GroupDM) {
            const dashboardURL = config.DASHBOARD_URL;
            const deepLink = dashboardURL
              ? `${dashboardURL}/applications?guild=${guildID}&tab=submissions&formId=${form.id}&submissionId=${result.id}`
              : null;

            const actionRow = deepLink
              ? [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setLabel("Voir la candidature")
                    .setURL(deepLink)
                    .setStyle(ButtonStyle.Link),
                ),
              ]
              : [];

            await channel
              .send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("Nouvelle candidature")
                    .setDescription(
                      deepLink
                        ? `<@${userID}> a soumis une candidature pour **${form.name}**.\n[Ouvrir dans le dashboard](${deepLink})`
                        : `<@${userID}> a soumis une candidature pour **${form.name}**`,
                    )
                    .setColor(config.COLORS.MAIN)
                    .setTimestamp()
                    .toJSON(),
                ],
                components: actionRow,
              })
              .catch(() => undefined);
          }
        }

        await originalInteraction.editReply({
          content: "✅ Ta candidature a bien été envoyée ! Nous te répondrons dès que possible.",
          embeds: [],
          components: [],
        });
        return;
      }

      // Cancel
      if (suffix === "cancel" && interaction instanceof ButtonInteraction) {
        await interaction.deferUpdate();
        await closeSession();
        await originalInteraction.editReply({
          content: "❌ Candidature annulée.",
          embeds: [],
          components: [],
        });
        return;
      }
    },
    ttl,
  );

  // Session timeout cleanup
  timeoutHandle = setTimeout(async () => {
    if (isClosed) return;
    const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
    if (!session || session.id !== sessionID) return;
    await closeSession();
    await originalInteraction
      .editReply({
        content: "⏰ Ta session de candidature a expiré. Clique à nouveau sur le bouton pour recommencer.",
        embeds: [],
        components: [],
      })
      .catch(() => undefined);
  }, ttl);
}

async function startSession(
  originalInteraction: ButtonInteraction,
  form: ApplicationFormDTO,
  guildID: string,
  userID: string,
): Promise<void> {
  const session = await applicationService.createSession(guildID, form.id, userID).catch(() => null);
  if (!session) {
    await originalInteraction.editReply({
      content: "Impossible de créer une session. Réessaie plus tard.",
    });
    return;
  }

  const nonce = genNonce();
  registerScopedHandlers(form.id, guildID, userID, nonce, session.id, form, originalInteraction);

  const firstQuestion = form.questions[0]!;
  if (firstQuestion.type === "open_text") {
    await originalInteraction.editReply(
      renderOpenTextQuestion(form, session, 0, `apply:${form.id}:${userID}:${nonce}:`),
    );
  } else {
    await originalInteraction.editReply(
      renderChoiceQuestion(form, 0, firstQuestion, `apply:${form.id}:${userID}:${nonce}:`),
    );
  }
}

async function handleStartApplication(interaction: ButtonInteraction, formID: string): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildID = interaction.guildId;
  const userID = interaction.user.id;

  if (!guildID) return;

  const form = await applicationService.getForm(guildID, formID).catch(() => null);
  if (!form || !form.isActive) {
    await interaction.editReply({ content: "Ce formulaire n'est plus disponible." });
    return;
  }

  if (form.questions.length === 0) {
    await interaction.editReply({ content: "Ce formulaire ne contient aucune question." });
    return;
  }

  // Check active submission
  const activeSubmission = await applicationService
    .getActiveSubmission(guildID, formID, userID)
    .catch(() => null);
  if (activeSubmission) {
    await interaction.editReply({
      content: "Tu as déjà une candidature en attente de révision pour ce formulaire.",
    });
    return;
  }

  // Check cooldown
  if (form.cooldownMs > 0) {
    const lastRejected = await applicationService
      .getLatestRejectedSubmission(guildID, formID, userID)
      .catch(() => null);
    if (lastRejected) {
      const decisionTime = lastRejected.reviewedAt ?? lastRejected.createdAt;
      const elapsed = Date.now() - decisionTime;
      const remaining = form.cooldownMs - elapsed;
      if (remaining > 0) {
        await interaction.editReply({
          content: `Tu dois attendre encore **${formatCooldownRemaining(remaining)}** avant de postuler à nouveau.`,
        });
        return;
      }
    }
  }

  // Check existing session → offer resume/restart
  const existingSession = await applicationService
    .getSession(guildID, formID, userID)
    .catch(() => null);

  if (existingSession) {
    const resumeId = `apply:${formID}:${userID}:resume_choice:resume`;
    const restartId = `apply:${formID}:${userID}:resume_choice:restart`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(resumeId).setLabel("▶️ Reprendre").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(restartId).setLabel("🔄 Recommencer").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`apply:${formID}:${userID}:resume_choice:cancel`)
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({
      content: `Tu as une candidature en cours (question **${existingSession.currentStep + 1}/${form.questions.length}**). Que veux-tu faire ?`,
      components: [row],
    });

    const resumeChoicePrefix = `apply:${formID}:${userID}:resume_choice:`;
    componentRouter.register(
      resumeId,
      async (i) => {
        if (!(i instanceof ButtonInteraction)) return;
        componentRouter.unregister(resumeId);
        componentRouter.unregister(restartId);
        componentRouter.unregister(`apply:${formID}:${userID}:resume_choice:cancel`);

        await i.deferUpdate();
        const session = await applicationService.getSession(guildID, formID, userID).catch(() => null);
        if (!session) {
          await startSession(interaction, form, guildID, userID);
          return;
        }

        const nonce = genNonce();
        registerScopedHandlers(form.id, guildID, userID, nonce, session.id, form, interaction);

        const q = form.questions[session.currentStep];
        if (!q) {
          await interaction.editReply(renderConfirmation(form, session, `apply:${form.id}:${userID}:${nonce}:`));
        } else if (q.type === "open_text") {
          await interaction.editReply(renderOpenTextQuestion(form, session, session.currentStep, `apply:${form.id}:${userID}:${nonce}:`));
        } else {
          await interaction.editReply(renderChoiceQuestion(form, session.currentStep, q, `apply:${form.id}:${userID}:${nonce}:`));
        }
      },
      10 * 60_000,
    );

    componentRouter.register(
      restartId,
      async (i) => {
        if (!(i instanceof ButtonInteraction)) return;
        componentRouter.unregister(resumeId);
        componentRouter.unregister(restartId);
        componentRouter.unregister(`apply:${formID}:${userID}:resume_choice:cancel`);
        await i.deferUpdate();
        await startSession(interaction, form, guildID, userID);
      },
      10 * 60_000,
    );

    componentRouter.register(
      `apply:${formID}:${userID}:resume_choice:cancel`,
      async (i) => {
        if (!(i instanceof ButtonInteraction)) return;
        componentRouter.unregister(resumeId);
        componentRouter.unregister(restartId);
        componentRouter.unregister(`apply:${formID}:${userID}:resume_choice:cancel`);
        await i.deferUpdate();
        await interaction.editReply({ content: "❌ Annulé.", embeds: [], components: [] });
      },
      10 * 60_000,
    );

    void resumeChoicePrefix;
    return;
  }

  await startSession(interaction, form, guildID, userID);
}

export function registerApplicationHandlers(): void {
  // Permanent prefix handler for "Start Application" buttons (customId = "apply:<formId>")
  componentRouter.registerPrefix("apply:", async (interaction: AnyDispatchableInteraction) => {
    if (!(interaction instanceof ButtonInteraction)) return;
    // Only handle the entry button (2 segments: "apply" and formId)
    const parts = interaction.customId.split(":");
    if (parts.length !== 2) return;
    const formID = parts[1]!;
    await handleStartApplication(interaction, formID).catch((err: unknown) => {
      console.error("[application] Erreur handleStartApplication:", err);
    });
  });
}
