import { z } from "zod";

export const FlagAnalysisSchema = z.object({
  isViolation: z.boolean(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]),
  warnSuffices: z.boolean(),
  category: z.string(),
  reasoning: z.string(),
  isBlackHumor: z.boolean(),
  isInsult: z.boolean(),
  insultTargetID: z.string().nullable(),
  requiresCertification: z.boolean(),
  needsMoreContext: z.boolean(),
  searchQuery: z.string().nullable(),
});

export const ReportAnalysisSchema = z.object({
  needsFollowUp: z.boolean(),
  followUpQuestions: z.array(z.string()),
  warnSuffices: z.boolean(),
  qqoqccp: z.object({
    qui: z.string(),
    quoi: z.string(),
    ou: z.string(),
    quand: z.string(),
    comment: z.string(),
    combien: z.string(),
    pourquoi: z.string(),
  }),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]),
  reasoning: z.string(),
});

export type FlagAnalysisResult = z.infer<typeof FlagAnalysisSchema>;
export type ReportAnalysisResult = z.infer<typeof ReportAnalysisSchema>;

export const flagSystemPrompt = `
Tu es un assistant de moderation Discord francophone.
Tu analyses un message signale et son contexte.
Tu dois repondre UNIQUEMENT avec un objet JSON valide.
Tu dois rester prudent: si le contexte est ambigu ou incomplet, mets needsMoreContext a true.
Si le message est de l'humour noir sans cible ou intention clairement malveillante, mets isBlackHumor a true.
Si c'est une insulte, essaie d'identifier la cible. Si le reporter n'est pas la cible et que l'attaque n'est pas auto-evidente, mets requiresCertification a true.
Si des faits externes doivent etre verifies, renseigne searchQuery avec une requete breve en francais.
Les niveaux de gravite autorises sont LOW, MEDIUM, HIGH, UNFORGIVABLE.
Le contexte doit te permettre de decider si un warn suffit. Mets warnSuffices a true quand un rappel a l'ordre formel parait adapte sans exclusion.
`;

export const reportSystemPrompt = `
Tu es un assistant de moderation Discord francophone.
Tu analyses un dossier de signalement dans un ticket.
Tu dois repondre UNIQUEMENT avec un objet JSON valide.
Si des informations manquent, pose jusqu'a 3 questions de suivi concretes dans followUpQuestions et mets needsFollowUp a true.
Sinon, remplis qqoqccp de maniere exploitable pour un moderateur.
Les niveaux de gravite autorises sont LOW, MEDIUM, HIGH, UNFORGIVABLE.
Mets warnSuffices a true quand un warn seul parait adapte, sinon false.
`;
