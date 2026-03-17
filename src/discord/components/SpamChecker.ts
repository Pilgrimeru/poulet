import { Message, Snowflake } from "discord.js";

import { autoDelete } from "@/discord/utils";

export type SpamCheckerOption = {
  messageLimit: number;
  inIntervalInSec: number;
  punishmentDurationInSec: number;
  whitelistChannel?: Snowflake[];
  blacklistChannel?: Snowflake[];
};

export class SpamChecker {
  private readonly messageLimit: number;
  private readonly inIntervalInSec: number;
  private readonly punishmentDurationInSec: number;
  private readonly whitelistChannel: Snowflake[] | undefined;
  private readonly blacklistChannel: Snowflake[] = [];
  private readonly messageCounter: Map<string, number> = new Map();

  constructor(option: SpamCheckerOption) {
    Object.assign(this, option);
  }

  public check(message: Message): boolean {
    const authorID = message.author.id;
    if (
      this.whitelistChannel &&
      !this.whitelistChannel.includes(message.channelId)
    ) {
      return true;
    }
    if (this.blacklistChannel.includes(message.channelId)) {
      return true;
    }

    if (this.messageCounter.has(authorID)) {
      const count = this.messageCounter.get(authorID)! + 1;
      this.messageCounter.set(authorID, count);

      if (count >= this.messageLimit) {
        message.member
          ?.timeout(this.punishmentDurationInSec * 1000)
          .catch(console.error);
        message.reply("Tu spam, tu es relou.").then(autoDelete);
        return false;
      }
    } else {
      this.messageCounter.set(authorID, 1);

      setTimeout(() => {
        this.messageCounter.delete(authorID);
      }, this.inIntervalInSec * 1000);
    }
    return true;
  }
}
