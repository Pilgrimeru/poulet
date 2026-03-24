import {
  ApplicationCommandDataResolvable,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
} from "discord.js";

export abstract class ContextMenuCommand {
  public readonly name: string;

  protected constructor(name: string) {
    this.name = name;
  }

  abstract execute(interaction: UserContextMenuCommandInteraction): any;

  public toCommandDataResolvable(): ApplicationCommandDataResolvable {
    return {
      name: this.name,
      type: ApplicationCommandType.User,
    };
  }
}
