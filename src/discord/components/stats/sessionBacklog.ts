import type { SessionAttributes } from "@/api";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type SessionKind = "voice" | "deaf";

interface SessionBacklogFile {
  voice: SessionAttributes[];
  deaf: SessionAttributes[];
}

const BACKLOG_PATH = join(process.cwd(), "data", "pending-sessions.json");

function createEmptyBacklog(): SessionBacklogFile {
  return {
    voice: [],
    deaf: [],
  };
}

async function readBacklog(): Promise<SessionBacklogFile> {
  try {
    const raw = await readFile(BACKLOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionBacklogFile>;

    return {
      voice: Array.isArray(parsed.voice) ? parsed.voice : [],
      deaf: Array.isArray(parsed.deaf) ? parsed.deaf : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyBacklog();
    }

    console.error("[sessions] Impossible de lire le backlog local.", error);
    return createEmptyBacklog();
  }
}

async function writeBacklog(backlog: SessionBacklogFile): Promise<void> {
  await mkdir(dirname(BACKLOG_PATH), { recursive: true });

  const tempPath = `${BACKLOG_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(backlog, null, 2), "utf8");
  await rename(tempPath, BACKLOG_PATH);
}

export async function enqueuePendingSessions(kind: SessionKind, sessions: SessionAttributes[]): Promise<void> {
  if (sessions.length === 0) return;

  const backlog = await readBacklog();
  backlog[kind].push(...sessions);
  await writeBacklog(backlog);

  console.warn(`[sessions] ${sessions.length} session(s) ${kind} stockée(s) localement en attente de l'API.`);
}

export async function flushPendingSessions(
  kind: SessionKind,
  createSession: (data: SessionAttributes) => Promise<void>,
): Promise<void> {
  const backlog = await readBacklog();
  const pendingSessions = backlog[kind];

  if (pendingSessions.length === 0) return;

  const remainingSessions: SessionAttributes[] = [];

  for (const session of pendingSessions) {
    try {
      await createSession(session);
    } catch (error) {
      remainingSessions.push(session);
      console.error(`[sessions] Échec de la relecture d'une session ${kind} en attente.`, error);
    }
  }

  backlog[kind] = remainingSessions;

  if (backlog.voice.length === 0 && backlog.deaf.length === 0) {
    await rm(BACKLOG_PATH, { force: true });
    console.log("[sessions] Backlog local vidé.");
    return;
  }

  await writeBacklog(backlog);
  console.warn(`[sessions] ${remainingSessions.length} session(s) ${kind} restent en attente.`);
}
