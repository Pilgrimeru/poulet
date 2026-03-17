import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "@/discord/types";
import { autoDelete } from "@/discord/utils";

export default class RollCommand extends Command {
  constructor() {
    super({
      name: "roll",
      description: "lance un dé",
      options: [
        {
          name: "face",
          description: "nombre de face du dé",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          min_value: 1,
          max_value: 1000,
        },
        {
          name: "nombre",
          description: "nombre de lancé",
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 10,
        },
      ],
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const faces = interaction.options.getInteger("face", true);
    const number = interaction.options.getInteger("nombre") ?? 1;
    let dice: number[] = [];

    for (let i = 0; i < number; i++) {
      dice.push(Math.ceil(Math.random() * faces));
    }
    const totalDice = dice.reduce((total, roll) => total + roll);

    interaction
      .reply(`${number}d${faces} : \`${dice}\` | Total = ${totalDice}`)
      .then((msg) => autoDelete(msg, true));
  }
}
