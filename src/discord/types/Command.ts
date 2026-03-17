import {
  ApplicationCommandDataResolvable,
  ApplicationCommandOptionData,
  ChatInputCommandInteraction,
  PermissionResolvable,
} from "discord.js";

export abstract class Command {
  public readonly name: string;
  public readonly description: string;
  private readonly defaultMemberPermissions?: PermissionResolvable[];
  private readonly options?: ApplicationCommandOptionData[];

  protected constructor(data: ApplicationCommandDataResolvable) {
    Object.assign(this, data);
  }

  abstract execute(interaction: ChatInputCommandInteraction): any;

  public toCommandDataResolvable(): ApplicationCommandDataResolvable {
    return {
      name: this.name,
      description: this.description,
      options: this.options,
      defaultMemberPermissions: this.defaultMemberPermissions ?? null,
    };
  }
}
