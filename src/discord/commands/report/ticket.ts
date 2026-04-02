import { config } from "@/app";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  EmbedBuilder,
  Guild,
  OverwriteType,
  PermissionFlagsBits,
  TextChannel,
  User,
} from "discord.js";

const CATEGORY_NAME = "𝕊𝕚𝕘𝕟𝕒𝕝𝕖𝕞𝕖𝕟𝕥𝕤";
export const TICKET_TOPIC_PREFIX = "report-meta:";

export type TicketMeta = {
  reporterID: string;
  targetUserID: string;
  originChannelID?: string | null;
};

export function encodeTicketMeta(meta: TicketMeta): string {
  return `${TICKET_TOPIC_PREFIX}${JSON.stringify(meta)}`;
}

export function decodeTicketMeta(topic: string | null): TicketMeta | null {
  if (!topic?.startsWith(TICKET_TOPIC_PREFIX)) return null;
  try {
    return JSON.parse(topic.slice(TICKET_TOPIC_PREFIX.length)) as TicketMeta;
  } catch {
    return null;
  }
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

export async function openTicket(guild: Guild, reporter: User, target: User, originChannelID?: string | null): Promise<TextChannel> {
  const category = await getOrCreateCategory(guild);
  const botId = guild.client.user.id;
  const baseName = target.username.toLowerCase().replaceAll(/[^a-z0-9]/g, "-").replaceAll(/-+/g, "-").replaceAll(/^-|-$/g, "");
  const suffix = await getNextTicketNumber(guild, baseName);
  const channelName = suffix === 1 ? baseName : `${baseName}-${suffix}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: encodeTicketMeta({ reporterID: reporter.id, targetUserID: target.id, originChannelID: originChannelID ?? null }),
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
