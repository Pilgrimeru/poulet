import { Role } from "discord.js";
import { Event } from "@/discord/types";

export default new Event("roleDelete", async (role: Role) => {
  console.log(`roleDelete: ${role.name}`);
});
