import { z } from "zod";

export const FlagAnalysisSchema = z.object({
  isViolation: z.boolean(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]),
  reason: z.string(),
  nature: z.enum(["Extremism", "Violence", "Hate", "Harassment", "Spam", "Manipulation", "Recidivism"]),
  targetID: z.string().nullable(),
  needsMoreContext: z.boolean(),
  searchQuery: z.string().nullable(),
});

export const QuestionSchema = z.object({
  needsFollowUp: z.boolean(),
  questions: z.array(z.string()),
});

export const SummarySchema = z.object({
  isViolation: z.boolean(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNFORGIVABLE"]),
  reason: z.string(),
  nature: z.enum(["Extremism", "Violence", "Hate", "Harassment", "Spam", "Manipulation", "Recidivism"]),
  targetID: z.string().nullable(),
  searchQuery: z.string().nullable(),
  summary: z.string(),
});

export type FlagAnalysisResult = z.infer<typeof FlagAnalysisSchema>;
export type QuestionResult = z.infer<typeof QuestionSchema>;
export type SummaryResult = z.infer<typeof SummarySchema>;

export const flagSystemPrompt = `
Tu es un assistant de moderation Discord francophone.
Tu analyses un message signale et son contexte (30 messages avant et apres).
Tu dois repondre UNIQUEMENT avec un objet JSON valide.

Regles de categorisation de la nature :
- Extremism : apologie du terrorisme, des genocides, du nazisme en acte
- Violence : appel au meurtre, menace credible, incitation au suicide, apologie de la violence
- Hate : haine raciste, homophobe ou autre discrimination de groupe au premier degre
- Harassment : denigrement, harcelement, violence verbale ciblee sur une personne
- Spam : repetition abusive, flood, contenu hors contexte
- Manipulation : tentative de contournement ou corruption du systeme de moderation, negationnisme, divulgation de donnees privees d'autrui
- Recidivism : recidive identifiee

Regles :
- Si le message est de l'humour noir sans cible ou intention malveillante : isViolation = false
- Si c'est une insulte ciblee : renseigne targetID avec l'ID Discord de la cible si identifiable, sinon null
- Si le contexte est ambigu ou insuffisant : needsMoreContext = true
- Si une verification factuelle externe est utile : renseigne searchQuery avec une requete breve en francais
- Les niveaux de gravite autorises : LOW, MEDIUM, HIGH, UNFORGIVABLE
`;

export const questionSystemPrompt = `
Tu es un assistant de moderation Discord francophone.
Tu analyses la premiere soumission d'un dossier de report dans un ticket.
Tu dois repondre UNIQUEMENT avec un objet JSON valide.

Si des informations importantes manquent pour statuer (qui, quoi, quand, preuves), pose au maximum 3 questions concretes et courtes dans le tableau questions, et mets needsFollowUp a true.
Si le dossier est suffisamment clair pour prendre une decision, mets needsFollowUp a false et questions a [].
`;

export const summarySystemPrompt = `
Tu es un assistant de moderation Discord francophone.
Tu analyses un dossier de report complet (transcript du ticket).
Tu dois repondre UNIQUEMENT avec un objet JSON valide.

Genere un champ summary qui resume le dossier selon la methode QQOQCCP (Qui, Quoi, Ou, Quand, Comment, Combien, Pourquoi) en francais, sous forme de texte structure et lisible par un moderateur humain.
Evalue isViolation, severity (LOW/MEDIUM/HIGH/UNFORGIVABLE), reason (raison concise), nature (Extremism/Violence/Hate/Harassment/Spam/Manipulation/Recidivism), targetID (ID Discord de la cible si insulte ciblee sinon null), searchQuery (requete DuckDuckGo si verification externe utile sinon null).
`;
