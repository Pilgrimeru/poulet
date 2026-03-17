import { Role } from "discord.js";
import { Event } from "@/discord/types";

export default new Event("roleUpdate", async (oldRole: Role, newRole: Role) => {
  console.log(`roleUpdate: ${oldRole.name} => ${newRole.name}`);
});
