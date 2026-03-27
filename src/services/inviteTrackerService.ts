import { Collection, Guild, Invite } from "discord.js";

// Cache: guildID -> Map<inviteCode, uses>
const inviteCache = new Map<string, Map<string, number>>();

export async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, buildUsesMap(invites));
  } catch {
    // Pas la permission MANAGE_GUILD — on ignore silencieusement
  }
}

export async function findUsedInvite(guild: Guild): Promise<Invite | null> {
  const previous = inviteCache.get(guild.id) ?? new Map<string, number>();

  let current: Collection<string, Invite>;
  try {
    current = await guild.invites.fetch();
  } catch {
    return null;
  }

  inviteCache.set(guild.id, buildUsesMap(current));

  for (const invite of current.values()) {
    const prevUses = previous.get(invite.code) ?? 0;
    if ((invite.uses ?? 0) > prevUses) {
      return invite;
    }
  }

  return null;
}

export function removeGuildCache(guildID: string): void {
  inviteCache.delete(guildID);
}

function buildUsesMap(invites: Collection<string, Invite>): Map<string, number> {
  const map = new Map<string, number>();
  for (const invite of invites.values()) {
    map.set(invite.code, invite.uses ?? 0);
  }
  return map;
}
