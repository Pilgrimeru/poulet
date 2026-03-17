import { VoiceState } from "discord.js";
import { deafSessionManager, voiceSessionManager } from "@/discord/components";
import { Event } from "@/discord/types";

export default new Event(
  "voiceStateUpdate",
  async (oldState: VoiceState, newState: VoiceState) => {
    // User leave a channel
    if (
      newState.channelId !== oldState.channelId &&
      oldState.channelId !== null &&
      oldState.member
    ) {
      await voiceSessionManager.endSession(oldState.member.id);

      if (oldState.deaf) {
        await deafSessionManager.endSession(oldState.member.id);
      }
    }

    // User is in a channel
    if (newState.channelId && newState.member) {
      // User join a channel
      if (oldState.channelId !== newState.channelId) {
        await voiceSessionManager.startSession(
          newState.member.id,
          newState.channelId,
          newState.guild.id,
        );
        if (newState.deaf) {
          await deafSessionManager.startSession(
            newState.member.id,
            newState.channelId,
            newState.guild.id,
          );
        }

        // User is deaf
      } else if (!oldState.deaf && newState.deaf) {
        await deafSessionManager.startSession(
          newState.member.id,
          newState.channelId,
          newState.guild.id,
        );

        // User is no longer deaf
      } else if (oldState.deaf && !newState.deaf) {
        await deafSessionManager.endSession(newState.member.id);
      }
    }
  },
);
