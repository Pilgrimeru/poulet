export const SETTINGS_MENU_ID = "settings:menu";

export const SETTINGS_STATS_ACTIONS_ID = "settings:stats:actions";
export const SETTINGS_STATS_REPORT_ACTIONS_ID = "settings:stats:report:actions";
export const SETTINGS_STATS_TOGGLE_DEAF_ID = "settings:stats:toggle_deaf";
export const SETTINGS_STATS_CHANNELS_ID = "settings:stats:channels";
export const SETTINGS_STATS_REPORT_CHANNEL_ID = "settings:stats:report_channel";
export const SETTINGS_STATS_FREQUENCY_ID = "settings:stats:frequency";
export const SETTINGS_STATS_RANKING_ID = "settings:stats:ranking";

export const SETTINGS_AS_ACTIONS_PREFIX = "settings:as:actions:";
export const SETTINGS_AS_CHANNELS_PREFIX = "settings:as:channels:";
export const SETTINGS_AS_CREATE_MODAL_ID = "settings:as:modal:create";
export const SETTINGS_AS_META_MODAL_PREFIX = "settings:as:modal:meta:";
export const SETTINGS_AS_THRESHOLDS_MODAL_PREFIX = "settings:as:modal:thresholds:";

export const SETTINGS_SB_CONFIG_MODAL_ID = "settings:sb:modal:config";

// Scoped IDs embed the userId so only the original invoker's interactions are routed
export interface ScopedSettingsIds {
  MENU: string;
  STATS_ACTIONS: string;
  STATS_REPORT_ACTIONS: string;
  STATS_TOGGLE_DEAF: string;
  STATS_CHANNELS: string;
  STATS_REPORT_CHANNEL: string;
  STATS_FREQUENCY: string;
  STATS_RANKING: string;
  AS_ACTIONS_PREFIX: string;
  AS_CHANNELS_PREFIX: string;
  CR_CHANNEL_SELECT: string;
  CR_ACTIONS_PREFIX: string;
  CR_FILTER_PREFIX: string;
  IL_CHANNEL_SELECT: string;
  IL_ACTIONS: string;
  MOD_ACTIONS: string;
  MOD_CHANNEL_SELECT: string;
  MOD_ROLE_SELECT: string;
  SB_ACTIONS: string;
  SB_CHANNEL_SELECT: string;
}

export function scopeIds(userId: string): ScopedSettingsIds {
  const p = `settings:${userId}`;
  return {
    MENU: `${p}:menu`,
    STATS_ACTIONS: `${p}:stats:actions`,
    STATS_REPORT_ACTIONS: `${p}:stats:report:actions`,
    STATS_TOGGLE_DEAF: `${p}:stats:toggle_deaf`,
    STATS_CHANNELS: `${p}:stats:channels`,
    STATS_REPORT_CHANNEL: `${p}:stats:report_channel`,
    STATS_FREQUENCY: `${p}:stats:frequency`,
    STATS_RANKING: `${p}:stats:ranking`,
    AS_ACTIONS_PREFIX: `${p}:as:actions:`,
    AS_CHANNELS_PREFIX: `${p}:as:channels:`,
    CR_CHANNEL_SELECT: `${p}:cr:channel_select`,
    CR_ACTIONS_PREFIX: `${p}:cr:actions:`,
    CR_FILTER_PREFIX: `${p}:cr:filter:`,
    IL_CHANNEL_SELECT: `${p}:il:channel_select`,
    IL_ACTIONS: `${p}:il:actions`,
    MOD_ACTIONS: `${p}:mod:actions`,
    MOD_CHANNEL_SELECT: `${p}:mod:channel_select`,
    MOD_ROLE_SELECT: `${p}:mod:role_select`,
    SB_ACTIONS: `${p}:sb:actions`,
    SB_CHANNEL_SELECT: `${p}:sb:channel_select`,
  };
}
