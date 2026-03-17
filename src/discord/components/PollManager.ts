import { bot } from "@/app/runtime";
import { Poll, PollParticipation } from "@/database/models";
import { pollParticipationService, pollService } from "@/database/services";
import { PollAttributes } from "@/database/types";
import { APIEmbedField, EmbedBuilder, Message } from "discord.js";

export class PollManager {
  public readonly expirationQueue = new Map<string, NodeJS.Timeout>();

  public async startPoll(
    pollData: PollAttributes,
    message?: Message,
  ): Promise<void> {
    const poll = await pollService.createPoll(pollData);
    await this.activateExpiration(poll, message);
  }

  public async getPoll(pollId: string): Promise<Poll | null> {
    return pollService.getPoll(pollId);
  }

  public async activateExpiration(
    poll: Poll,
    message?: Message,
  ): Promise<void> {
    const delay = poll.expiration - Date.now();
    if (delay > 0) {
      const timeout = setTimeout(() => this.stopPoll(poll, message), delay);
      this.expirationQueue.set(poll.pollId, timeout);
    } else {
      await this.stopPoll(poll, message);
    }
  }

  private async stopPoll(poll: Poll, message?: Message): Promise<void> {
    poll.isClosed = true;
    await poll.save();

    if (!message) {
      message = (await this.fetchPollMessage(poll)) ?? undefined;
      if (!message)
        return console.error(
          "Can't stop the poll - the message can't be found.",
        );
    }

    const embed = await this.updateEmbed(poll);
    await message.edit({ embeds: [embed], components: [] });
  }
  public async userVoteInteraction(
    poll: Poll,
    userId: string,
    optionId: number,
  ): Promise<boolean>;
  public async userVoteInteraction(
    pollId: string,
    userId: string,
    optionId: number,
  ): Promise<boolean>;
  public async userVoteInteraction(
    pollOrPollId: string | Poll,
    userId: string,
    optionId: number,
  ): Promise<boolean> {
    const poll =
      typeof pollOrPollId === "string"
        ? await pollService.getPoll(pollOrPollId)
        : pollOrPollId;
    if (!poll) return false;

    const hasVoted = !!(await pollParticipationService.getUserPollParticipation(
      poll.pollId,
      userId,
      optionId,
    ));
    return hasVoted
      ? await this.removeUserVote(poll, userId, optionId)
      : !!(await this.addUserVote(poll, userId, optionId));
  }

  public async addUserVote(
    pollOrPollId: string | Poll,
    userId: string,
    optionId: number,
  ): Promise<PollParticipation | null> {
    const poll =
      typeof pollOrPollId === "string"
        ? await pollService.getPoll(pollOrPollId)
        : pollOrPollId;
    if (!poll) return null;

    if (!poll.allowMultipleChoice) {
      await pollParticipationService.removeParticipations(poll.pollId, userId);
    }

    return await pollParticipationService.addParticipation(
      poll.pollId,
      userId,
      optionId,
    );
  }

  public async removeUserVote(
    poll: Poll,
    userId: string,
    optionId: number,
  ): Promise<boolean>;
  public async removeUserVote(
    pollId: string,
    userId: string,
    optionId: number,
  ): Promise<boolean>;
  public async removeUserVote(
    pollOrPollId: string | Poll,
    userId: string,
    optionId: number,
  ): Promise<boolean> {
    const poll =
      typeof pollOrPollId === "string"
        ? await pollService.getPoll(pollOrPollId)
        : pollOrPollId;
    if (!poll || poll.expiration <= Date.now()) return false;
    return await pollParticipationService.removeParticipation(
      poll.pollId,
      userId,
      optionId,
    );
  }

  public async updateEmbed(poll: PollAttributes): Promise<EmbedBuilder>;
  public async updateEmbed(pollId: string): Promise<EmbedBuilder | null>;
  public async updateEmbed(
    pollOrPollId: PollAttributes | string,
  ): Promise<EmbedBuilder | null> {
    const poll =
      typeof pollOrPollId === "string"
        ? await pollService.getPoll(pollOrPollId)
        : pollOrPollId;
    if (!poll) return null;

    const voteCounts = await this.countVotes(poll);
    const totalVotes = this.calculateTotalVotes(voteCounts);
    const progressBars = this.generateProgressBars(voteCounts, totalVotes);

    return new EmbedBuilder()
      .setTitle(`📊 ${poll.title}`)
      .setDescription(`*${totalVotes} votes*`)
      .addFields(
        this.generateEmbedFields(poll, progressBars, voteCounts, totalVotes),
      )
      .setColor(0x7cceec)
      .setFooter({ text: `id : ${poll.pollId}` });
  }

  private async fetchPollMessage(poll: Poll): Promise<Message | null> {
    const [guildId, channelId, messageId] = poll.messagePath.split(":");
    const guild = await bot.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      return await channel.messages.fetch(messageId);
    }
    return null;
  }

  private generateEmbedFields(
    poll: PollAttributes,
    progressBars: string[],
    voteCounts: number[],
    totalVotes: number,
  ): APIEmbedField[] {
    const options = JSON.parse(poll.options) as string[];

    const fields: APIEmbedField[] = options.map((option, index) => ({
      name: `${index + 1}. ${option}`,
      value: `${progressBars[index]}\`${this.formatPercentage(voteCounts[index], totalVotes)} (${voteCounts[index]})\``,
      inline: false,
    }));

    const lastField = fields.at(-1)!;

    lastField.value +=
      poll.expiration <= Date.now()
        ? `\n---\n⌛ Expiré <t:${Math.round(poll.expiration / 1000)}:R>\n🔢 Choix multiple: ${poll.allowMultipleChoice ? "`activé`" : "`désactivé`"}`
        : `\n---\n⏳ Expire <t:${Math.round(poll.expiration / 1000)}:R>\n🔢 Choix multiple: ${poll.allowMultipleChoice ? "`activé`" : "`désactivé`"}`;

    return fields;
  }

  private async countVotes(poll: PollAttributes): Promise<number[]> {
    const voteCounts = new Array(JSON.parse(poll.options).length).fill(0);
    const votes = await pollParticipationService.getAllPollParticipations(
      poll.pollId,
    );

    votes.forEach((participation) => {
      voteCounts[participation.option]++;
    });

    return voteCounts;
  }

  private generateProgressBars(
    voteCounts: number[],
    totalVotes: number,
  ): string[] {
    const barLength = 12;
    const colors = ["🟦", "🟥", "🟨", "🟩", "🟪", "🟧"];
    const emptyChar = "⬛";

    return voteCounts.map((count, index) => {
      const filledLength =
        totalVotes > 0 ? Math.round((count / totalVotes) * barLength) : 0;
      const filledChar = colors[index % colors.length];
      return (
        filledChar.repeat(filledLength) +
        emptyChar.repeat(barLength - filledLength)
      );
    });
  }

  private calculateTotalVotes(voteCounts: number[]): number {
    return voteCounts.reduce((total, count) => total + count, 0);
  }

  private formatPercentage(count: number, total: number): string {
    return total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";
  }
}

export const pollManager = new PollManager();
