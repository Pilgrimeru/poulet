import type { PendingRoleItem } from "@/api";
import {
  appealApiService,
  applicationService,
  channelMetaService,
  deafSessionService,
  guildMetaService,
  messageSnapshotService,
  sanctionApiService,
  userMetaService,
  voiceSessionService,
} from "@/api";
import { memberEventService } from "@/api/memberEventService";
import { config } from "@/app/config";
import { bot } from "@/app/runtime";
import { startStatsReportScheduler } from "@/discord/components";
import { flushPendingSessions } from "@/discord/components/stats/sessionBacklog";
import { registerApplicationHandlers, registerPollHandlers } from "@/discord/interactions";
import { Event } from "@/discord/types";
import { cacheGuildInvites } from "@/services/inviteTrackerService";
import { ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, GuildMember } from "discord.js";

export default new Event("clientReady", () => {
  console.log(`${bot.user!.username} ready!`);

  // Seed guild & channel metadata from Discord cache
  void (async () => {
    const guildRows: Array<{ guildID: string; name: string; iconURL: string }> =
      [];
    const channelRows: Array<{
      channelID: string;
      guildID: string;
      name: string;
      parentID: string | null;
      parentName: string | null;
      channelType: number | null;
    }> = [];

    for (const guild of bot.guilds.cache.values()) {
      guildRows.push({
        guildID: guild.id,
        name: guild.name,
        iconURL: guild.iconURL() ?? "",
      });

      for (const channel of guild.channels.cache.values()) {
        if ("name" in channel && channel.name) {
          const parentID =
            "parentId" in channel ? (channel.parentId ?? null) : null;
          const parentName =
            "parent" in channel && channel.parent ? channel.parent.name : null;
          channelRows.push({
            channelID: channel.id,
            guildID: guild.id,
            name: channel.name,
            parentID,
            parentName,
            channelType: channel.type,
          });
        }
      }
    }

    await guildMetaService.bulkUpsert(guildRows);
    await channelMetaService.bulkUpsert(channelRows);

    // Soft-delete channels that are no longer in Discord (per guild)
    for (const guild of bot.guilds.cache.values()) {
      const activeIDs = channelRows
        .filter((r) => r.guildID === guild.id)
        .map((r) => r.channelID);
      await channelMetaService
        .markDeletedExcept(guild.id, activeIDs)
        .catch(() => undefined);
    }
  })();
  for (const guild of bot.guilds.cache.values()) {
    void cacheGuildInvites(guild);
  }
  void flushPendingSessions("voice", (session) =>
    voiceSessionService.createSession(session),
  );
  void flushPendingSessions("deaf", (session) =>
    deafSessionService.createSession(session),
  );
  void bot.startSessionsForGuildMembers();
  void bot.startPollExpiration();
  seedMemberJoins().catch((err: unknown) =>
    console.error("[members] Erreur seed joins:", err),
  );
  seedUserMetas().catch((err: unknown) =>
    console.error("[userMeta] Erreur seed:", err),
  );
  startStatsReportScheduler();
  registerPollHandlers();
  registerApplicationHandlers();

  void syncOverturnedAppeals();
  let appealSyncChain = Promise.resolve();
  setInterval(() => {
    appealSyncChain = appealSyncChain.then(
      () => syncOverturnedAppeals(),
      () => syncOverturnedAppeals(),
    );
  }, 60_000);

  syncWelcomeMessages().catch((err: unknown) =>
    console.error("[applications] Erreur welcome sync:", err),
  );
  let welcomeSyncChain = Promise.resolve();
  setInterval(() => {
    welcomeSyncChain = welcomeSyncChain.then(
      () => syncWelcomeMessages(),
      () => syncWelcomeMessages(),
    );
  }, 30_000);

  syncApplicationRoles().catch((err: unknown) =>
    console.error("[applications] Erreur role sync:", err),
  );
  let roleSyncChain = Promise.resolve();
  setInterval(() => {
    roleSyncChain = roleSyncChain.then(
      () => syncApplicationRoles(),
      () => syncApplicationRoles(),
    );
  }, 30_000);

  setInterval(() => {
    for (const guild of bot.guilds.cache.values()) {
      applicationService.deleteExpiredSessions(guild.id).catch(() => undefined);
    }
  }, 5 * 60_000);

  // Purge old message snapshots on startup then every 24h
  void messageSnapshotService.purgeOldSnapshots().then((n) => {
    if (n > 0)
      console.log(
        `[snapshots] ${n} snapshot(s) supprimé(s) (rétention ${process.env["MESSAGE_RETENTION_DAYS"] ?? "7"}j)`,
      );
  });
  setInterval(
    () => void messageSnapshotService.purgeOldSnapshots(),
    24 * 3600 * 1000,
  );

  const status: string = "te surveille";

  bot.user!.setActivity(status, { type: ActivityType.Listening });
  setInterval(
    () => {
      bot.user!.setActivity(status, { type: ActivityType.Listening });
    },
    60 * 60 * 1000,
  );
});

async function seedMemberJoins(): Promise<void> {
  const now = Date.now();
  const events: Array<{ guildID: string; userID: string; date: number }> = [];
  const LARGE_GUILD_THRESHOLD = 500;

  for (const guild of bot.guilds.cache.values()) {
    const members =
      guild.memberCount <= LARGE_GUILD_THRESHOLD
        ? await guild.members.fetch().catch(() => guild.members.cache)
        : guild.members.cache;
    for (const member of members.values()) {
      if (member.user.bot) continue;
      events.push({
        guildID: guild.id,
        userID: member.id,
        date: member.joinedTimestamp ?? now,
      });
    }
  }

  if (events.length === 0) return;
  await memberEventService.seedJoins(events);
  console.log(`[members] ${events.length} jointure(s) seedée(s).`);
}

async function seedUserMetas(): Promise<void> {
  const rows: Array<{
    userID: string;
    guildID: string;
    username: string;
    displayName: string;
    avatarURL: string;
  }> = [];

  for (const guild of bot.guilds.cache.values()) {
    const members = await guild.members
      .fetch()
      .catch(() => guild.members.cache);
    for (const member of members.values()) {
      if (member.user.bot) continue;
      rows.push({
        userID: member.user.id,
        guildID: guild.id,
        username: member.user.username,
        displayName:
          member.nickname ?? member.user.globalName ?? member.user.username,
        avatarURL: member.displayAvatarURL(),
      });
    }
  }

  if (rows.length === 0) return;
  await userMetaService.bulkUpsert(rows);

  // Group active IDs by guildID for efficient per-guild soft-delete
  const activeIDsByGuild = new Map<string, string[]>();
  for (const r of rows) {
    const list = activeIDsByGuild.get(r.guildID) ?? [];
    list.push(r.userID);
    activeIDsByGuild.set(r.guildID, list);
  }

  // Soft-delete members no longer in Discord (per guild)
  for (const guild of bot.guilds.cache.values()) {
    const activeIDs = activeIDsByGuild.get(guild.id) ?? [];
    await userMetaService
      .markDeletedExcept(guild.id, activeIDs)
      .catch(() => undefined);
  }

  console.log(`[userMeta] ${rows.length} membre(s) seedé(s).`);
}

async function syncWelcomeMessages(): Promise<void> {
  for (const guild of bot.guilds.cache.values()) {
    const forms = await applicationService.listFormsNeedingWelcomePost(guild.id).catch(() => []);
    for (const form of forms) {
      if (!form.welcomeChannelID) continue;
      const channel = await guild.channels.fetch(form.welcomeChannelID).catch(() => null);
      if (!channel?.isTextBased()) continue;

      const message = await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle(form.name)
              .setDescription(
                form.description || "Clique sur le bouton ci-dessous pour commencer ta candidature.",
              )
              .setColor(config.COLORS.MAIN)
              .toJSON(),
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`apply:${form.id}`)
                .setLabel("Commencer ma candidature")
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        })
        .catch(() => null);

      if (message) {
        await applicationService
          .patchForm(guild.id, form.id, { welcomeMessageID: message.id } as never)
          .catch(() => undefined);
      }
    }
  }
}

const applicationRoleSyncFailures = new Map<string, { nextRetryAt: number; lastReason: string }>();
const APPLICATION_ROLE_SYNC_RETRY_MS = 10 * 60_000;

function getApplicationRoleSyncKey(item: PendingRoleItem): string {
  return `${item.submission.guildID}:${item.submission.formID}:${item.submission.id}`;
}

async function applyRoleChanges(
  member: GuildMember,
  roleIDs: string[],
  mode: "add" | "remove",
  reason: string,
): Promise<boolean> {
  let ok = true;

  for (const roleID of roleIDs) {
    const role = member.guild.roles.cache.get(roleID) ?? await member.guild.roles.fetch(roleID).catch(() => null);
    if (!role) {
      console.error("[applications] role sync failed: role not found", {
        guildID: member.guild.id,
        userID: member.id,
        roleID,
        mode,
      });
      ok = false;
      continue;
    }

    if (member.guild.members.me && role.position >= member.guild.members.me.roles.highest.position) {
      console.error("[applications] role sync failed: role above bot hierarchy", {
        guildID: member.guild.id,
        userID: member.id,
        roleID,
        roleName: role.name,
        mode,
      });
      ok = false;
      continue;
    }

    try {
      if (mode === "add") {
        await member.roles.add(roleID, reason);
      } else {
        await member.roles.remove(roleID, reason);
      }
    } catch (error) {
      console.error("[applications] role sync failed: discord role mutation error", {
        guildID: member.guild.id,
        userID: member.id,
        roleID,
        roleName: role.name,
        mode,
        error,
      });
      ok = false;
    }
  }

  return ok;
}

async function applyAcceptedRoles(item: PendingRoleItem, member: GuildMember | null): Promise<boolean> {
  let ok = true;
  if (member) {
    ok = await applyRoleChanges(member, item.form.acceptRoleIDs, "add", "Candidature acceptée");
    ok = (await applyRoleChanges(member, item.form.removeRoleIDs, "remove", "Candidature acceptée")) && ok;
  } else {
    console.error("[applications] role sync failed: member not found for accepted submission", {
      guildID: item.submission.guildID,
      userID: item.submission.userID,
      submissionID: item.submission.id,
    });
    ok = false;
  }
  const notes = item.submission.reviewerNotes ? `\n\n${item.submission.reviewerNotes}` : "";
  await member?.send(`✅ Ta candidature pour **${item.form.name}** a été **acceptée** !${notes}`).catch(() => undefined);
  return ok;
}

async function applyRejectedRoles(item: PendingRoleItem, member: GuildMember | null): Promise<boolean> {
  let ok = true;
  if (member) {
    ok = await applyRoleChanges(member, item.form.rejectRoleIDs, "add", "Candidature refusée");
  } else {
    console.error("[applications] role sync failed: member not found for rejected submission", {
      guildID: item.submission.guildID,
      userID: item.submission.userID,
      submissionID: item.submission.id,
    });
    ok = false;
  }
  const notes = item.submission.reviewerNotes ? `\n\n${item.submission.reviewerNotes}` : "";
  await member?.send(`❌ Ta candidature pour **${item.form.name}** a été **refusée**.${notes}`).catch(() => undefined);
  return ok;
}

async function processRoleItem(guild: Guild, item: PendingRoleItem): Promise<void> {
  const key = getApplicationRoleSyncKey(item);
  const failure = applicationRoleSyncFailures.get(key);
  if (failure && Date.now() < failure.nextRetryAt) {
    return;
  }

  const member = await guild.members.fetch(item.submission.userID).catch(() => null);
  let ok = false;
  if (item.submission.status === "accepted") {
    ok = await applyAcceptedRoles(item, member);
  } else if (item.submission.status === "rejected") {
    ok = await applyRejectedRoles(item, member);
  }
  if (!ok) {
    const reason = member
      ? "role mutation failed"
      : "member not found";
    const previous = applicationRoleSyncFailures.get(key);
    if (previous?.lastReason !== reason || !previous) {
      console.warn("[applications] role sync postponed after failure", {
        guildID: guild.id,
        submissionID: item.submission.id,
        formID: item.submission.formID,
        userID: item.submission.userID,
        retryInMs: APPLICATION_ROLE_SYNC_RETRY_MS,
        reason,
      });
    }
    applicationRoleSyncFailures.set(key, {
      nextRetryAt: Date.now() + APPLICATION_ROLE_SYNC_RETRY_MS,
      lastReason: reason,
    });
    return;
  }

  applicationRoleSyncFailures.delete(key);

  await applicationService
    .markRolesApplied(guild.id, item.submission.formID, item.submission.id)
    .catch((error: unknown) => {
      console.error("[applications] failed to mark roles as applied", {
        guildID: guild.id,
        submissionID: item.submission.id,
        formID: item.submission.formID,
        error,
      });
    });
}

async function syncApplicationRoles(): Promise<void> {
  for (const guild of bot.guilds.cache.values()) {
    const items = await applicationService.listPendingRoles(guild.id).catch(() => [] as PendingRoleItem[]);
    for (const item of items) {
      await processRoleItem(guild, item);
    }
  }
}

async function syncOverturnedAppeals(): Promise<void> {
  for (const guild of bot.guilds.cache.values()) {
    const result = await appealApiService
      .list(guild.id, { status: "overturned" })
      .catch(() => []);
    const appeals = Array.isArray(result) ? result : [];

    for (const appeal of appeals) {
      const sanction = await sanctionApiService
        .get(guild.id, appeal.sanctionID)
        .catch(() => null);
      if (sanction?.state !== "created") continue;

      const member = await guild.members
        .fetch(sanction.userID)
        .catch(() => null);
      if (member) {
        await member.timeout(null, "Appel accepte").catch(() => undefined);
      }
      await sanctionApiService
        .revoke(guild.id, sanction.id)
        .catch(() => undefined);
    }
  }
}
