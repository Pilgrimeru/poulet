export function safeParseJSON<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "object") {
    const parsed = { ...(value as Record<string, unknown>) };
    if ("targetID" in parsed && !("victimUserID" in parsed)) parsed["victimUserID"] = parsed["targetID"];
    return parsed as T;
  }
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed && "targetID" in parsed && !("victimUserID" in parsed)) parsed["victimUserID"] = parsed["targetID"];
    return parsed as T;
  } catch {
    return null;
  }
}
