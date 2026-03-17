import {
  SETTINGS_AS_ACTIONS_PREFIX,
  SETTINGS_AS_CHANNELS_PREFIX,
} from "@/discord/commands/settings/ids";

export function isPositiveInt(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

export function parseRuleIDFromActionsCustomID(customID: string): string | null {
  if (!customID.startsWith(SETTINGS_AS_ACTIONS_PREFIX)) return null;
  return customID.slice(SETTINGS_AS_ACTIONS_PREFIX.length) || null;
}

export function parseRuleIDFromChannelsCustomID(customID: string): string | null {
  if (!customID.startsWith(SETTINGS_AS_CHANNELS_PREFIX)) return null;
  return customID.slice(SETTINGS_AS_CHANNELS_PREFIX.length) || null;
}
