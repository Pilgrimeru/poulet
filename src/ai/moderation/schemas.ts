import { z } from "zod";

export const HistoryQueryToolSchema = z.object({
  userID: z.string().describe("Discord user ID to inspect"),
  startAt: z.string().nullable().describe("UTC start bound in YYYY-MM-DD-HH-mm format"),
  endAt: z.string().nullable().describe("UTC end bound in YYYY-MM-DD-HH-mm format"),
  onlyDeleted: z.boolean().describe("Use true only for deleted or normally unsearchable messages"),
  channelID: z.string().nullable().describe("Discord channel ID, or null for no channel filter"),
  search: z.string().nullable().describe("Broad free-text query for relevant messages"),
  searchTerms: z.array(z.string()).nullable().describe("Extra keywords or variants"),
  searchMode: z.enum(["any", "all"]).nullable().describe("Use 'any' by default for broad search"),
  limit: z.number().int().min(1).max(100).describe("Maximum messages to return"),
}).describe("Message history query used to verify facts");

export const SearchQueryToolSchema = z.object({
  query: z.string().describe("Search query in French"),
});

export const UserSanctionsToolSchema = z.object({
  userID: z.string().describe("Discord user ID to inspect"),
  limit: z.number().int().min(1).max(50).describe("Maximum sanctions to return"),
});

export const GuildChannelsToolSchema = z.object({
  nameQuery: z.string().nullable().describe("Channel name fragment, or null for a broad list"),
  limit: z.number().int().min(1).max(100).describe("Maximum channels to return"),
});

export const FlagAnalysisSchema = z.object({
  isViolation: z.boolean().describe("True only if the facts show a real violation"),
  severity: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]).describe("Violation severity, or NONE if absent or unproven"),
  sanctionKind: z.enum(["WARN", "MUTE", "BAN_PENDING"]).describe("Recommended sanction type"),
  reason: z.string().describe("Concise reason in one sentence"),
  nature: z.enum(["Extremism", "Violence", "Hate", "Harassment", "Spam", "Manipulation", "Recidivism", "Other"]).describe("Most relevant violation category"),
  similarSanctionIDs: z.array(z.string()).describe("IDs of similar past sanctions"),
  victimUserID: z.string().nullable().describe("Discord victim user ID, or null if none is identifiable"),
  needsMoreContext: z.boolean().describe("True if the available context is still ambiguous or insufficient"),
  searchQuery: z.string().nullable().describe("Compatibility field; keep null"),
  historyQuery: HistoryQueryToolSchema.nullable().describe("Compatibility field; keep null"),
}).describe("Analysis of a reported message and its immediate context");

export const SummarySchema = z.object({
  needsFollowUp: z.boolean().describe("True only if key information is still missing after reasonable tool use"),
  questions: z.array(z.string()).max(3).describe("Up to 3 short, non-technical questions if needsFollowUp is true; otherwise []"),
  isViolation: z.boolean().describe("True only if the facts show a real violation"),
  severity: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]).describe("Violation severity, or NONE if absent or unproven"),
  sanctionKind: z.enum(["WARN", "MUTE", "BAN_PENDING"]).describe("Recommended sanction type"),
  reason: z.string().describe("Concise reason in one sentence"),
  nature: z.enum(["Extremism", "Violence", "Hate", "Harassment", "Spam", "Manipulation", "Recidivism", "Other"]).describe("Most relevant violation category"),
  similarSanctionIDs: z.array(z.string()).describe("IDs of similar past sanctions"),
  victimUserID: z.string().nullable().describe("Discord victim user ID, or null if none is identifiable"),
  searchQuery: z.string().nullable().describe("Compatibility field; keep null"),
  historyQuery: HistoryQueryToolSchema.nullable().describe("Compatibility field; keep null"),
  summary: z.string().describe("Factual French summary grounded in collected evidence"),
}).describe("Final decision for a report, or a minimal request for missing information");
