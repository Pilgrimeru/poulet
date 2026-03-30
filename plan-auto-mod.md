# Plan : Système de modération IA

## Context
Implémentation d'un système de modération automatisé avec IA pour le bot Discord.
Deux flux : **Signalement** (message unique → IA → sanction auto) et **Report** (dossier complexe → ticket → IA → sanction).
Stack IA : LangChain + OpenRouter (minimax/minimax-m2.5:free, fallback mistral-7b) + DuckDuckGo search.
Les données de modération sont persistées via l'API dashboard, pas directement en SQLite depuis le bot.

---

## Phase 1 — Dépendances

**Ajouter au root `package.json` via `bun add`:**
- `@langchain/openai` — client OpenRouter (API OpenAI-compatible)
- `@langchain/community` — outil DuckDuckGoSearch
- `@langchain/core` — types messages/tools
- `zod` — schémas output structuré

**Variable env à ajouter dans `config.env`:**
- `OPENROUTER_API_KEY`

---

## Phase 2 — Modèles DB (dashboard-next/models/)

4 nouveaux fichiers, pattern identique à `MessageSnapshot.ts` :

| Fichier | Champs clés |
|---------|-------------|
| `Warn.ts` | id(UUID), guildID, userID, moderatorID, reason, severity(LOW/MEDIUM/HIGH), isActive, createdAt, expiresAt |
| `Sanction.ts` | id(UUID), guildID, userID, moderatorID, type(MUTE/BAN_PENDING), reason, warnID(FK), isActive, durationMs, createdAt, expiresAt |
| `FlaggedMessage.ts` | id(UUID), guildID, channelID, messageID, reporterID, targetUserID, status, aiAnalysis(JSON TEXT), warnID, sanctionID, appealText, appealStatus, appealAt, moderatorID, createdAt |
| `ModerationReport.ts` | id(UUID), guildID, reporterID, targetUserID, ticketChannelID, status, reporterSummary, aiQuestions(JSON), aiQQOQCCP(TEXT), confirmationCount, warnID, sanctionID, appealText, appealStatus, appealAt, moderatorID, createdAt |

Modifier `dashboard-next/models/index.ts` pour importer les 4 nouveaux modèles.

---

## Phase 3 — Services dashboard (dashboard-next/services/)

| Fichier | Fonctions exposées |
|---------|-------------------|
| `warnService.ts` | `createWarn`, `listWarns(guildID, userID?)`, `revokeWarn`, `getActiveMultiplier(guildID, userID)` → number |
| `sanctionService.ts` | `createSanction`, `listSanctions`, `revokeSanction` |
| `flaggedMessageService.ts` | `createFlaggedMessage`, `listFlaggedMessages`, `updateFlaggedMessage` |
| `moderationReportService.ts` | `createReport`, `getReport`, `getReportByChannel(channelID)`, `updateReport`, `listReports` |

`getActiveMultiplier` : somme les majorations des warns actifs (LOW=+0.25, MEDIUM=+0.25, HIGH=+0.5), plafond 7.

---

## Phase 4 — Routes API dashboard

**Warns** — `dashboard-next/app/api/guilds/[guildId]/warns/`
- `route.ts` : GET (filtre `?userId=`) + POST
- `[warnId]/route.ts` : PATCH (revoke)

**Sanctions** — `dashboard-next/app/api/guilds/[guildId]/sanctions/`
- `route.ts` : GET + POST
- `[sanctionId]/route.ts` : PATCH (revoke)

**Signalements** — `dashboard-next/app/api/guilds/[guildId]/flagged-messages/`
- `route.ts` : GET + POST
- `[flagId]/route.ts` : PATCH (review modérateur humain)

**Reports** — `dashboard-next/app/api/guilds/[guildId]/moderation-reports/`
- `route.ts` : GET + POST
- `[reportId]/route.ts` : GET + PATCH

---

## Phase 5 — Services API bot (src/api/)

Thin wrappers utilisant `apiGet`/`apiPost`/`apiPatch` de `src/api/client.ts` :

- `src/api/warnApiService.ts` : `create`, `list`, `revoke`, `getActiveMultiplier`
- `src/api/sanctionApiService.ts` : `create`, `revoke`
- `src/api/flaggedMessageApiService.ts` : `create`, `update`
- `src/api/moderationReportApiService.ts` : `create`, `getByChannel`, `update`

Exporter depuis `src/api/index.ts` (modifier).

---

## Phase 6 — Module IA (src/ai/)

### `src/ai/client.ts`
```typescript
export const moderationLLM = new ChatOpenAI({
  modelName: "minimax/minimax-m2.5:free",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
});
export const fallbackLLM = new ChatOpenAI({ modelName: "mistralai/mistral-7b-instruct:free", ... });
export async function callWithFallback(messages, tools?) { try { ... } catch { fallback } }
```

### `src/ai/tools.ts`
```typescript
export const duckduckgoTool = new DuckDuckGoSearch({ maxResults: 3 });
```

### `src/ai/prompts.ts`
- Prompt système en français avec toutes les règles
- Schéma Zod `FlagAnalysisSchema` : isViolation, severity, category, reasoning, isBlackHumor, isInsult, insultTargetID, requiresCertification, needsMoreContext, searchQuery
- Schéma Zod `ReportAnalysisSchema` : needsFollowUp, followUpQuestions[], qqoqccp{qui,quoi,ou,quand,comment,combien,pourquoi}, severity, reasoning

### `src/ai/sanctionCalculator.ts` (logique pure, sans IA)
```
FAIBLE  → base 5min  → warnSeverity LOW
MOYEN   → base 15min → warnSeverity MEDIUM
GRAVE   → base 24h   → warnSeverity HIGH
IMPARDONNABLE → base 7j → requiresBanConfirmation = true
```
Applique multiplicateur (Math.ceil final), gère requalification si récidive similaire.

### `src/ai/moderationAnalyzer.ts`
- `analyzeFlag(input)` : construit contexte → appel IA avec DuckDuckGo → si searchQuery → recherche → re-invoke → retourne FlagAnalysisResult
- `analyzeReport(input)` : appel IA → si needsFollowUp retourne questions → sinon retourne QQOQCCP

---

## Phase 7 — Commandes bot

### Modifier `src/discord/commands/report.ts`

**`ReportMessageContextMenuCommand.execute` (Signalement) :**
1. Defer reply (ephemeral)
2. Fetch 30 messages avant + après dans le canal
3. Créer `FlaggedMessage` en DB (status: "pending")
4. Appel `moderationAnalyzer.analyzeFlag(...)`
5. Exceptions :
   - Si insulte + reporter ≠ victime + pas certifié → refuser, demander certification
   - Si humour noir → dismiss
   - Si `needsMoreContext` → escalader vers flux Report (ouvrir ticket)
6. `warnApiService.getActiveMultiplier` pour le target
7. Vérifier récidive similaire dans les warns actifs
8. `sanctionCalculator.computeSanction(severity, multiplier, hasSimilarPrior)`
9. Appliquer :
   - `warnApiService.create(...)`
   - Si mute : `member.timeout(durationMs, reason)`
   - Si BAN_PENDING : poster dans salon modérateurs
10. Embed public dans le canal (`buildWarnEmbed` étendu)
11. DM target avec bouton "Faire appel" (customId: `appeal:flag:<id>`)
12. Mettre à jour FlaggedMessage status → "sanctioned"

**Submit handler du ticket Report :**
1. Créer `ModerationReport` en DB (status: "awaiting_ai")
2. Récupérer les messages du ticket
3. Appel `moderationAnalyzer.analyzeReport(...)`
4. Si `needsFollowUp` : poster questions, bouton "J'ai répondu", re-analyser
5. Une fois QQOQCCP prêt : embed avec boutons "Confirmer" / "Modifier" (max 1 modification)
6. À la confirmation : même logique sanction que Signalement
7. DM target + archiver ticket

---

## Phase 8 — Flux d'appel

**Enregistrement permanent (startup) :**
```typescript
componentRouter.registerPrefix("appeal:", handleAppealButton);
```

**handleAppealButton :**
1. Lire `appeal:flag:<id>` ou `appeal:report:<id>` depuis customId
2. Ouvrir une `ModalBuilder` (justification en TextInput)
3. Sur soumission modal : `flaggedMessageApiService.update(id, { appealText, appealStatus: "pending_review" })`
4. Reply ephemeral "Appel enregistré"

**Dashboard appeal review** (page Next.js `/moderation`) :
- Liste les signalements/reports avec appealStatus "pending_review"
- Boutons "Maintenir" / "Annuler la sanction"
- Sur annulation : PATCH → `isActive = false` sur la sanction

**Surveillance des annulations :**
Tâche cron (node-cron, 60s) dans `src/discord/events/ready.ts` ou service dédié :
- Query `sanctionApiService.list` filtré par `appealStatus = "overturned" AND isActive = true`
- `member.timeout(null)` pour lever le mute
- Mettre à jour `isActive = false`

---

## Phase 9 — Ordre d'implémentation

1. Modèles + services + routes dashboard (Phase 2-4)
2. Services API bot (Phase 5)
3. AI client + tools (Phase 6.1-6.2) — tester la connectivité OpenRouter
4. sanctionCalculator (Phase 6.5) — logique pure
5. Prompts + analyzer (Phase 6.3-6.4)
6. Flux Signalement (Phase 7 — message context menu)
7. Flux Report (Phase 7 — ticket submit)
8. Flux Appel (Phase 8)

---

## Fichiers critiques

- `src/discord/commands/report.ts` — à modifier pour les deux flux
- `src/ai/moderationAnalyzer.ts` — orchestration IA centrale (fichier le plus complexe)
- `src/ai/prompts.ts` — qualité des sorties IA dépend de ce fichier
- `src/ai/sanctionCalculator.ts` — logique de sanction pure et testable
- `dashboard-next/services/warnService.ts` — calcul multiplicateur
- `src/services/warnService.ts` — garder, étendre `buildWarnEmbed` pour les sanctions IA

## Vérification

1. `bun run typecheck` — pas d'erreurs TS
2. Test Signalement : right-click un message → flux complet (warn + embed public + DM)
3. Test Report : `/report @user` → ticket → AI questions → QQOQCCP → sanction
4. Test appel : cliquer "Faire appel" → modal → vérifier en DB
5. Test dashboard : voir appels pendants, annuler une sanction, vérifier unmute automatique