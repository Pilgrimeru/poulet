import { SpamFilterRuleDTO } from "@/api/spamFilterRuleService";
import { SpamChecker } from "@/discord";

type SpamFilterRunner = {
  id: string;
  checker: SpamChecker;
};

const spamCheckersByGuild = new Map<string, SpamFilterRunner[]>();

export function resolveSpamCheckers(
  guildID: string,
  rules: SpamFilterRuleDTO[],
): SpamFilterRunner[] {
  const cached = spamCheckersByGuild.get(guildID);
  if (cached) return cached;

  const created: SpamFilterRunner[] = rules
    .filter((rule) => rule.enabled)
    .map((rule) => ({
      id: rule.id,
      checker: new SpamChecker({
        messageLimit: rule.messageLimit,
        inIntervalInSec: rule.intervalInSec,
        punishmentDurationInSec: rule.punishmentDurationInSec,
        whitelistChannel: rule.mode === "whitelist" ? rule.channelIDs : undefined,
        blacklistChannel: rule.mode === "blacklist" ? rule.channelIDs : undefined,
      }),
    }));

  spamCheckersByGuild.set(guildID, created);
  return created;
}

export function invalidateSpamCheckers(guildID: string) {
  spamCheckersByGuild.delete(guildID);
}
