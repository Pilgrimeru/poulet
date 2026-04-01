import { Config } from "@/app/types";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: "config.env", quiet: true });

function parseEnvColor(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value) {
    value = value.replace("#", "0x");
    const parsedValue = Number.parseInt(value, 16);
    return Number.isNaN(parsedValue) ? defaultValue : parsedValue;
  }
  return defaultValue;
}

const config: Config = {
  TOKEN: process.env["TOKEN"] ?? "",
  AUTO_DELETE: Boolean(process.env["AUTO_DELETE"]),
  ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS: Boolean(process.env["ALLOW_DUPLICATE_SANCTIONED_MESSAGE_REPORTS"]),
  LOCALE: process.env["LOCALE"] ?? "en",
  GUILD_ID: process.env["GUILD_ID"],
  COLORS: {
    MAIN: parseEnvColor(process.env["MAIN_COLOR"], 0x69adc7),
  },
};

export { config };
