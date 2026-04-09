import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  PartialGuildMember,
} from "discord.js";
import { Event } from "@/discord/types";
import { sanctionApiService, userMetaService } from "@/api";
import { componentRouter } from "@/discord/interactions";

const TIMEOUT_REVOKE_TTL_MS = 60_000;

async function handleTimeoutRemoved(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember,
) {
  const wasTimedOut =
    oldMember.communicationDisabledUntilTimestamp !== null &&
    oldMember.communicationDisabledUntilTimestamp !== undefined &&
    oldMember.communicationDisabledUntilTimestamp > Date.now();

  const isNowActive = !newMember.communicationDisabledUntilTimestamp ||
    newMember.communicationDisabledUntilTimestamp <= Date.now();

  if (!wasTimedOut || !isNowActive) return;

  const guild = newMember.guild;
  const targetUser = newMember.user;
  if (!targetUser) return;

  // Find the admin who removed the timeout via audit logs
  let adminID: string | null = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // slight delay for audit log
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 });
    const entry = logs.entries.find(
      (e) =>
        e.target?.id === targetUser.id &&
        Date.now() - e.createdTimestamp < 10_000 &&
        e.changes.some((c) => c.key === "communication_disabled_until"),
    );
    if (entry && !entry.executor?.bot) {
      adminID = entry.executor?.id ?? null;
    }
  } catch {
    // audit log fetch failed, skip
  }

  if (!adminID) return;

  // Find active MUTE sanction for this user
  let sanctionID: string | null = null;
  try {
    const sanctions = await sanctionApiService.list(guild.id, { userID: targetUser.id, state: "created" });
    const mute = sanctions.find((s) => s.type === "MUTE");
    if (mute) sanctionID = mute.id;
  } catch {
    return;
  }

  if (!sanctionID) return;

  // Send confirmation DM to the admin
  try {
    const admin = await guild.members.fetch(adminID);
    const dmChannel = await admin.createDM();

    const confirmId = `timeout:confirm:${guild.id}:${sanctionID}`;
    const cancelId = `timeout:cancel:${guild.id}:${sanctionID}`;

    const embed = new EmbedBuilder()
      .setColor(0xf0a500)
      .setTitle("Levée de sanction")
      .setDescription(
        `Vous avez retiré l'exclusion (timeout) de <@${targetUser.id}> sur **${guild.name}**.\n\n` +
        `Une sanction **MUTE** active est enregistrée pour cet utilisateur.\n` +
        `Souhaitez-vous également lever cette sanction dans le système ?\n\n` +
        `*Sans réponse, la sanction sera levée automatiquement dans 1 minute.*`,
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel("Lever la sanction")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel("Conserver la sanction")
        .setStyle(ButtonStyle.Secondary),
    );

    const dmMessage = await dmChannel.send({ embeds: [embed], components: [row] });

    const cleanup = (content: string) => {
      componentRouter.unregister(confirmId);
      componentRouter.unregister(cancelId);
      clearTimeout(timer);
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId + "_done")
          .setLabel("Lever la sanction")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(cancelId + "_done")
          .setLabel("Conserver la sanction")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );
      dmMessage
        .edit({ embeds: [embed.setDescription(content).setColor(0x888888)], components: [disabledRow] })
        .catch(() => undefined);
    };

    const revoke = async () => {
      try {
        await sanctionApiService.revoke(guild.id, sanctionID);
      } catch {
        // ignore
      }
    };

    componentRouter.register(
      confirmId,
      async (interaction) => {
        await interaction.deferUpdate();
        await revoke();
        cleanup("✅ La sanction a été levée.");
      },
      TIMEOUT_REVOKE_TTL_MS,
    );

    componentRouter.register(
      cancelId,
      async (interaction) => {
        await interaction.deferUpdate();
        cleanup("⛔ La sanction a été conservée.");
      },
      TIMEOUT_REVOKE_TTL_MS,
    );

    const timer = setTimeout(async () => {
      componentRouter.unregister(confirmId);
      componentRouter.unregister(cancelId);
      await revoke();
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId + "_done")
          .setLabel("Lever la sanction")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(cancelId + "_done")
          .setLabel("Conserver la sanction")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );
      dmMessage
        .edit({
          embeds: [embed.setDescription("⏱️ Délai expiré — la sanction a été levée automatiquement.").setColor(0x888888)],
          components: [disabledRow],
        })
        .catch(() => undefined);
    }, TIMEOUT_REVOKE_TTL_MS);
  } catch {
    // DM failed or admin not fetchable
  }
}

export default new Event(
  "guildMemberUpdate",
  async (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember,
  ) => {
    if (newMember.user?.bot) return;
    const user = newMember.user;
    if (!user) return;

    await userMetaService.upsert(
      user.id,
      newMember.guild.id,
      user.username,
      newMember.nickname ?? user.globalName ?? user.username,
      newMember.displayAvatarURL(),
    ).catch(() => undefined);

    await handleTimeoutRemoved(oldMember, newMember);
  },
);
