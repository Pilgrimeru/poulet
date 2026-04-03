import Link from "next/link";
import { ErrorBanner, Panel, StatusBadge } from "@/components/ui";
import styles from "./LoginPage.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/";
  const hasError = params.error === "oauth";

  return (
    <main className={styles.page}>
      <Panel className={styles.card}>
        <span className={styles.eyebrow}>Poulet Dashboard</span>
        <h1 className={styles.title}>Connexion via Discord</h1>
        <p className={styles.text}>
          Connecte-toi avec ton compte Discord pour accéder uniquement aux serveurs que tu partages avec le bot.
        </p>
        {hasError && (
          <ErrorBanner message="La connexion Discord a échoué. Vérifie la configuration OAuth puis réessaie." />
        )}
        <Link href={`/api/auth/login?next=${encodeURIComponent(nextPath)}`} className={styles.button}>
          Continuer avec Discord
        </Link>
        <div className={styles.meta}>
          <span>Scopes: identify, guilds</span>
          <StatusBadge tone="accent">OAuth2</StatusBadge>
        </div>
      </Panel>
    </main>
  );
}
