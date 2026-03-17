import {
  Bot,
  deafSessionManager,
  voiceSessionManager,
} from "@/discord/components";

export const bot = new Bot();

process.stdin.resume();

process.on("SIGINT", handleShutdown);
process.on("SIGUSR1", handleShutdown);
process.on("SIGUSR2", handleShutdown);
process.on("uncaughtException", handleCrash);
process.on("exit", console.log);

let saving = false;

function handleCrash(error: any) {
  console.error(error);
  if (!saving) {
    saving = true;
    console.log("Sauvegarde des donnees en cours...");
    save()
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        console.error("Echec de la sauvegarde des donnees. Arret du bot.");
        process.exit(error.code);
      });
  }
}

function handleShutdown() {
  if (!saving) {
    saving = true;
    console.log("Sauvegarde des donnees en cours...");
    save()
      .then(() => {
        console.log("Sauvegarde terminee. Arret du bot.");
        process.exit(0);
      })
      .catch(() => {
        console.error("Echec de la sauvegarde des donnees. Arret du bot.");
        process.exit(1);
      });
  }
}

async function save() {
  try {
    await voiceSessionManager.endAllSessions();
    await deafSessionManager.endAllSessions();
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des donnees :", error);
  }
}
