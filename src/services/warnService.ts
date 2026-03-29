import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  MessageFlags,
  TextChannel,
  User,
} from "discord.js";

export type WarnSeverity = "LOW" | "MEDIUM" | "HIGH";

const SEVERITY_CONFIG: Record<
  WarnSeverity,
  { color: number; label: string; emoji: string }
> = {
  LOW: { color: 0xf0c040, label: "Faible", emoji: "🟡" },
  MEDIUM: { color: 0xe07820, label: "Moyen", emoji: "🟠" },
  HIGH: { color: 0xe03030, label: "Élevé", emoji: "🔴" },
};

export interface WarnOptions {
  target: User;
  severity: WarnSeverity;
  message: string;
  moderator: User;
  /** Message original à citer (optionnel) */
  originalMessage?: Message;
}

export function buildWarnEmbed(opts: WarnOptions): EmbedBuilder {
  const sev = SEVERITY_CONFIG[opts.severity];

  const embed = new EmbedBuilder()
    .setColor(sev.color)
    .setAuthor({
      name: `${sev.emoji} Niveau de gravité : ${sev.label}`,
      iconURL: opts.target.displayAvatarURL(),
    })
    .setTitle(`Signalement de ${opts.target.tag ?? opts.target.username}`)
    .setDescription(`Motif : ${opts.message.trim() || "*[Non communiqué]*"}`)
    .addFields(
      {
        name: "👤 Utilisateur signalé",
        value: `${opts.target}`,
        inline: true,
      },
      {
        name: "🛡️ Modérateur",
        value: `${opts.moderator}`,
        inline: true,
      },
    )
    .setThumbnail(opts.target.displayAvatarURL())
    .setTimestamp();

  if (opts.originalMessage) {
    const url = opts.originalMessage.url;
    const preview =
      opts.originalMessage.content.length > 100
        ? `${opts.originalMessage.content.slice(0, 100)}…`
        : opts.originalMessage.content || "*[Pas de texte]*";
    embed.addFields({
      name: "💬 Message d'origine",
      value: `[Voir le message](${url})\n> ${preview}`,
    });
  }

  return embed;
}

/**
 * Envoie un signalement en réponse à un message d'origine.
 * Si le message n'est plus disponible, mentionne l'utilisateur dans le salon.
 */
export async function sendWarn(
  interaction: ChatInputCommandInteraction,
  opts: WarnOptions,
): Promise<void> {
  const embed = buildWarnEmbed(opts);

  if (opts.originalMessage) {
    try {
      await opts.originalMessage.reply({ embeds: [embed] });
      await interaction.reply({
        content: "✅ Signalement envoyé.",
        ephemeral: true,
      });
      return;
    } catch {
      // Message plus disponible — fallback ci-dessous
    }
  }

  // Pas de message d'origine (ou introuvable) : envoyer dans le salon courant
  const channel = interaction.channel as TextChannel;
  await channel.send({
    content: `${opts.target}`,
    embeds: [embed],
  });

  await interaction.reply({
    content: "✅ Signalement envoyé.",
    flags: MessageFlags.Ephemeral,
  });
}
