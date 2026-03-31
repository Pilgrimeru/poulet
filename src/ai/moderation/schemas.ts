import { z } from "zod";

export const HistoryQueryToolSchema = z.object({
  userID: z.string().describe("ID Discord de l'utilisateur a inspecter"),
  startAt: z.string().nullable().describe("Borne UTC de debut au format YYYY-MM-DD-HH-mm"),
  endAt: z.string().nullable().describe("Borne UTC de fin au format YYYY-MM-DD-HH-mm"),
  onlyDeleted: z.boolean().describe("true seulement si les messages sont explicitement supprimes ou introuvables en recherche normale"),
  channelID: z.string().nullable().describe("ID du salon si une restriction precise est necessaire, sinon null"),
  search: z.string().nullable().describe("Recherche libre souple pour retrouver les messages pertinents"),
  searchTerms: z.array(z.string()).nullable().describe("Variantes ou mots-cles complementaires"),
  searchMode: z.enum(["any", "all"]).nullable().describe("Utiliser 'any' par defaut pour une recherche large"),
  limit: z.number().int().min(1).max(100).describe("Nombre maximum de messages a renvoyer"),
}).describe("Requete d'historique de messages pour verifier les faits");

export const SearchQueryToolSchema = z.object({
  query: z.string().describe("Requete de recherche en francais"),
});

export const UserSanctionsToolSchema = z.object({
  userID: z.string().describe("ID Discord de l'utilisateur a inspecter"),
  limit: z.number().int().min(1).max(50).describe("Nombre maximum de sanctions a renvoyer"),
});

export const GuildChannelsToolSchema = z.object({
  nameQuery: z.string().nullable().describe("Fragment de nom de salon pour filtrer, ou null pour lister largement"),
  limit: z.number().int().min(1).max(100).describe("Nombre maximum de salons a renvoyer"),
});

export const FlagAnalysisSchema = z.object({
  isViolation: z.boolean().describe("true seulement si le message et son contexte montrent une violation reelle"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]).describe("Gravite de la violation"),
  sanctionKind: z.enum(["WARN", "MUTE", "BAN_PENDING"]).describe("Type de sanction a recommander sans duree"),
  reason: z.string().describe("Motif concis en une phrase"),
  nature: z.enum(["Extremism", "Violence", "Hate", "Harassment", "Spam", "Manipulation", "Recidivism", "Other"]).describe("Categorie de violation la plus pertinente"),
  similarSanctionIDs: z.array(z.string()).describe("IDs des sanctions anterieures similaires explicitement fournies"),
  targetID: z.string().nullable().describe("ID Discord de la victime si une cible est identifiable, sinon null"),
  needsMoreContext: z.boolean().describe("true si le contexte fourni reste ambigu ou insuffisant"),
  searchQuery: z.string().nullable().describe("Champ de compatibilite, laisser null"),
  historyQuery: HistoryQueryToolSchema.nullable().describe("Champ de compatibilite, laisser null"),
}).describe("Analyse d'un message signale et de son contexte immediat");

export const SummarySchema = z.object({
  needsFollowUp: z.boolean().describe("true seulement si des informations bloquantes manquent encore apres usage raisonnable des outils"),
  questions: z.array(z.string()).max(3).describe("Questions minimales, courtes et non techniques si needsFollowUp = true, sinon []"),
  isViolation: z.boolean().describe("true seulement si les faits sont verifies et constituent une violation"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]).describe("Gravite de la violation"),
  sanctionKind: z.enum(["WARN", "MUTE", "BAN_PENDING"]).describe("Sanction recommande sans calcul de duree"),
  reason: z.string().describe("Motif concis de la decision"),
  nature: z.enum(["Extremism", "Violence", "Hate", "Harassment", "Spam", "Manipulation", "Recidivism", "Other"]).describe("Categorie la plus pertinente; utiliser Other si rien ne correspond nettement"),
  similarSanctionIDs: z.array(z.string()).describe("IDs des sanctions anterieures similaires explicitement presentes"),
  targetID: z.string().nullable().describe("ID Discord de la victime si une cible est identifiable, sinon null"),
  searchQuery: z.string().nullable().describe("Champ de compatibilite, laisser null"),
  historyQuery: HistoryQueryToolSchema.nullable().describe("Champ de compatibilite, laisser null"),
  summary: z.string().describe("Resume factuel en francais, ancre dans les preuves collectees"),
}).describe("Decision finale sur un dossier de signalement, ou demande minimale d'informations manquantes");
