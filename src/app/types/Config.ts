export interface Config {
  TOKEN: string;
  AUTO_DELETE: boolean;
  ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS: boolean;
  LOCALE: string;
  GUILD_ID: string | undefined;
  COLORS: {
    MAIN: number;
  };
}
