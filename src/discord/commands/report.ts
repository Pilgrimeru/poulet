import { config } from "@/app";
import { componentRouter } from "@/discord/interactions";
import { Command, ContextMenuCommand } from "@/discord/types";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  OverwriteType,
  PermissionFlagsBits,
  TextChannel,
  User,
  UserContextMenuCommandInteraction,
} from "discord.js";

const CATEGORY_NAME = "𝕊𝕚𝕘𝕟𝕒𝕝𝕖𝕞𝕖𝕟𝕥𝕤";

// ─── shared logic ────────────────────────────────────────────────────────────

async function getOrCreateCategory(guild: Guild): Promise<CategoryChannel> {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME,
  ) as CategoryChannel | undefined;

  if (existing) return existing;

  // Create at the bottom (position = very large number)
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
  let n = 1;
  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    const name = channel.name.toLowerCase();
    if (name === base || name.startsWith(`${base}-`)) n++;
  }
  return n;
}

async function openTicket(
  guild: Guild,
  reporter: User,
  target: User,
): Promise<TextChannel> {
  const category = await getOrCreateCategory(guild);
  const botId = guild.client.user.id;
  const baseName = target.username.toLowerCase().replaceAll(/[^a-z0-9]/g, "-").replaceAll(/-+/g, "-").replaceAll(/^-|-$/g, "");
  const n = await getNextTicketNumber(guild, baseName);
  const channelName = n === 1 ? baseName : `${baseName}-${n}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      // Everyone: hidden
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
      // Reporter: can read & write
      {
        id: reporter.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        type: OverwriteType.Member,
      },
      // Bot: full access
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
        `Bonjour ${reporter}, ta demande de signalement concernant **${target.username}** va être prise en charge dans les meilleurs délais.`,
        "",
        "**Avant de commencer, merci de prendre connaissance des règles suivantes :**",
        "",
        "⚠️ **Engagement de vérité** : Tu t'engages à ne rapporter que des faits véridiques et vérifiables. Tout signalement abusif, mensonger ou de mauvaise foi pourra être retourné contre toi sous forme de sanction.",
        "",
        "🚫 **Ne mentionne pas les modérateurs** : Il n'est pas nécessaire de ping ou de contacter un modérateur directement. Ta demande sera traitée automatiquement.",
        "",
        "✍️ **Rédigez des messages complets** : Explique clairement ce qui est reproché à l'utilisateur signalé.",
        "",
        "🔗 **Fournis des preuves si possible :**",
        "- Lien direct vers le ou les messages concernés",
        "- À défaut : le salon, l'utilisateur, la date et l'heure approximative",
        "",
        "─────────────────────────────",
        "Une fois que tu as fourni toutes les informations, clique sur **Déposer le signalement** pour finaliser.",
        "Si tu as ouvert ce ticket par erreur, clique sur **Annuler**.",
      ].join("\n"),
    )
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: `Signalement à l'encontre de ${target.username} (${target.id})` })
    .setTimestamp();

  const submitButton = new ButtonBuilder()
    .setCustomId(`report:submit:${channel.id}`)
    .setLabel("Déposer le signalement")
    .setStyle(ButtonStyle.Success)
    .setEmoji("📨");

  const cancelButton = new ButtonBuilder()
    .setCustomId(`report:cancel:${channel.id}`)
    .setLabel("Annuler")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🗑️");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(submitButton, cancelButton);

  const welcomeMsg = await channel.send({ embeds: [embed], components: [row] });
  await welcomeMsg.pin().catch(() => undefined);

  // Register button handlers (permanent — no TTL)
  componentRouter.register(`report:submit:${channel.id}`, async (i) => {
    if (!i.isButton()) return;
    if (i.user.id !== reporter.id) {
      await i.reply({ content: "Seul le signaleur peut finaliser ce ticket.", flags: MessageFlags.Ephemeral });
      return;
    }
    componentRouter.unregister(`report:submit:${channel.id}`);
    componentRouter.unregister(`report:cancel:${channel.id}`);

    await i.update({ components: [] });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("✅ Signalement déposé")
          .setDescription("Ton signalement a bien été transmis à l'équipe de modération. Merci pour ta contribution."),
      ],
    });
  });

  componentRouter.register(`report:cancel:${channel.id}`, async (i) => {
    if (!i.isButton()) return;
    if (i.user.id !== reporter.id) {
      await i.reply({ content: "Seul le signaleur peut annuler ce ticket.", flags: MessageFlags.Ephemeral });
      return;
    }
    componentRouter.unregister(`report:submit:${channel.id}`);
    componentRouter.unregister(`report:cancel:${channel.id}`);

    await i.update({ components: [] });
    await channel.send({
      content: "Ticket annulé. Ce salon sera supprimé dans 5 secondes.",
    });
    setTimeout(() => channel.delete().catch(() => undefined), 5000);
  });
}

// ─── slash command ────────────────────────────────────────────────────────────

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
      await interaction.reply({ content: "Tu ne peux pas te signaler toi-même.", flags: MessageFlags.Ephemeral });
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

// ─── context menu command (clic droit → Application → Report) ─────────────────

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
      await interaction.reply({ content: "Tu ne peux pas te signaler toi-même.", flags: MessageFlags.Ephemeral });
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

// ─── context menu command (clic droit → message → Apps → Report) ─────────────

export class ReportMessageContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Signaler", ApplicationCommandType.Message);
  }

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    await interaction.reply({
      content: "Le signalement de messages n'est pas encore disponible. Pour signaler un utilisateur, fais un clic droit sur son profil → Apps → Report.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

// Export nommé pour que Bot.ts puisse le détecter via mod.contextMenus
export const contextMenus = [ReportContextMenuCommand, ReportMessageContextMenuCommand];
