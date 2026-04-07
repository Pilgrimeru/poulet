import { Command } from "@/discord/types";
import { callWithFallback } from "@/ai/core/client";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  ThreadChannel,
} from "discord.js";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 heures

export function isOnCooldown(channelId: string): boolean {
  const last = cooldowns.get(channelId);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

export function getRemainingCooldown(channelId: string): string {
  const last = cooldowns.get(channelId);
  if (!last) return "0m";
  const remaining = COOLDOWN_MS - (Date.now() - last);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

export function setCooldown(channelId: string): void {
  cooldowns.set(channelId, Date.now());
}

function chunkText(input: string, maxLength: number): string[] {
  if (input.length <= maxLength) return [input];
  const chunks: string[] = [];
  let remaining = input;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }
  return chunks;
}

function buildConversationTranscript(lines: Array<{
  timestamp: number;
  author: string;
  content: string;
}>): string {
  return lines
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((line) => `[${new Date(line.timestamp).toISOString()}] ${line.author}: ${line.content || "(message vide)"}`)
    .join("\n");
}

async function summarizeConversationFromTranscript(transcript: string): Promise<string> {
  const messages = [
    new SystemMessage(
      [
        "Tu es un assistant de moderation Discord.",
        "Tu rediges un resume neutre et factuel en francais.",
        "Reponds en 6 a 10 puces maximum.",
        "Inclure: participants principaux, thème principal, faits marquants, signaux de conflit/insulte si presents.",
        "Ne pas inventer d'elements absents du transcript.",
        "Si les messages sont trop anciens, ne les prend pas en compte. Il faut être concis et ne parler que de la conversation en cours, soit dans l'heure courante.",
        "Le but est de permettre a la personne de pouvoir intégrer la conversation déjà entamée.",
        "S'il y a des fautes d'orthographe, passe outre"
      ].join(" "),
    ),
    new HumanMessage(
      ["Resume la conversation suivante:", "", transcript].join("\n"),
    ),
  ];

  return callWithFallback(messages);
}

const MODERATOR_ROLE_ID = process.env["MODERATOR_ROLE_ID"];

function isModerator(member: GuildMember): boolean {
  if (MODERATOR_ROLE_ID) return member.roles.cache.has(MODERATOR_ROLE_ID);
  return member.permissions.has(PermissionFlagsBits.ModerateMembers);
}

export default class ResumeCommand extends Command {
  constructor() {
    super({
      name: "resume",
      description: "Résume les 100 derniers messages du salon courant",
      options: [
        {
          name: "public",
          description: "Rendre le résumé visible par tous (réservé aux modérateurs)",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Cette commande doit être utilisée dans un serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const wantsPublic = interaction.options.getBoolean("public") ?? false;
    const member = interaction.member as GuildMember;

    if (wantsPublic && !isModerator(member)) {
      await interaction.reply({
        content: "Tu n'as pas la permission de rendre le résumé public.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    
    if (isOnCooldown(interaction.user.id) && !isModerator(member)) {
      await interaction.reply({
        content: `⏳ Tu as déjà demandé un résumé récemment. Réessaie dans **${getRemainingCooldown(interaction.user.id)}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ephemeral = !wantsPublic;
    await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });

    const channel = interaction.channel;
    if (!channel || !(channel instanceof TextChannel || channel instanceof ThreadChannel)) {
      await interaction.editReply("Type de salon non supporté pour le résumé.");
      return;
    }

    const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!fetched || fetched.size === 0) {
      await interaction.editReply("Impossible de récupérer des messages dans ce salon.");
      return;
    }

    const transcript = buildConversationTranscript(
      [...fetched.values()]
        .filter((m) => !m.author.bot)
        .map((m) => ({
          timestamp: m.createdTimestamp,
          author: m.member?.displayName ?? m.author.username,
          content: m.content.trim(),
        })),
    );

    if (!transcript.trim()) {
      await interaction.editReply("Aucun message utilisateur exploitable dans ce salon.");
      return;
    }

    const summary = await summarizeConversationFromTranscript(transcript);
    const blocks = chunkText(summary, 1900);

    setCooldown(interaction.user.id);

    await interaction.editReply({
      content: `Résumé des 100 derniers messages dans ${channel}:\n\n${blocks[0]}`,
    });

    for (const extra of blocks.slice(1)) {
      await interaction.followUp({
        content: extra,
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      });
    }
  }
}