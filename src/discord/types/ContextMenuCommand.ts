import {
  ApplicationCommandDataResolvable,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";

export abstract class ContextMenuCommand {
  public readonly name: string;
  protected readonly type: ApplicationCommandType.User | ApplicationCommandType.Message;

  protected constructor(name: string, type: ApplicationCommandType.User | ApplicationCommandType.Message = ApplicationCommandType.User) {
    this.name = name;
    this.type = type;
  }

  abstract execute(interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction): any;

  public toCommandDataResolvable(): ApplicationCommandDataResolvable {
    return {
      name: this.name,
      type: this.type,
    };
  }
}
