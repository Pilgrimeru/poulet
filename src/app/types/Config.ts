export interface Config {
  TOKEN: string;
  AUTO_DELETE: boolean;
  ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS: boolean;
  MODERATOR_ROLE_ID: string;
  LOCALE: string;
  DASHBOARD_URL: string;
  COLORS: {
    MAIN: number;
  };
}
