import { Config } from "@/app/types";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: "config.env" });

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
  LOCALE: process.env["LOCALE"] ?? "en",
  COLORS: {
    MAIN: parseEnvColor(process.env["MAIN_COLOR"], 0x69adc7),
  },
};

export { config };
