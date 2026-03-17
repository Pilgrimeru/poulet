import { Role } from "discord.js";
import { Event } from "@/discord/types";

export default new Event("roleCreate", async (role: Role) => {
  console.log(`roleCreate: ${role.name}`);
});
