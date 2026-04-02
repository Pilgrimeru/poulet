import { Command, ContextMenuCommand } from "@/discord/types";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  MessageFlags,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { executeOpenTicket, handleFlaggedMessage } from "./report/handlers";

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
    await executeOpenTicket(interaction, interaction.options.getUser("utilisateur", true));
  }
}

export class ReportContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Report");
  }

  async execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
    await executeOpenTicket(interaction, interaction.targetUser);
  }
}

export class ReportMessageContextMenuCommand extends ContextMenuCommand {
  constructor() {
    super("Signaler", ApplicationCommandType.Message);
  }

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "Cette commande doit être utilisée dans un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.targetMessage.author;
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "Tu ne peux pas te signaler toi-meme.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "Tu ne peux pas signaler un bot.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await handleFlaggedMessage(interaction);
  }
}

export const contextMenus = [ReportContextMenuCommand, ReportMessageContextMenuCommand];
