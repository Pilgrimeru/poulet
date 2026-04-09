import { PageHeader, Panel } from "@/components/ui";
import Image from "next/image";
import styles from "./Home.module.css";

export default function HomePage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <Image
            src="/icon.png"
            alt="Icône du poulet"
            width={52}
            height={52}
            className={styles.botIcon}
            priority
          />
        </div>
        <PageHeader
          title="Bienvenue sur le Dashboard"
          subtitle="Pilote la modération de ton serveur depuis une seule interface : appels, signalements, historique des messages, statistiques d'activité et paramètres du bot."
        />

        <div className={styles.featureGrid}>
          <Panel className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>Historique</h3>
            <p>Retrouvez, filtrez et parcourez les messages du serveur.</p>
          </Panel>
          <Panel className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <h3>Activité</h3>
            <p>Analysez l&apos;activité vocale et textuelle de votre communauté.</p>
          </Panel>
          <Panel className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
            </div>
            <h3>Modération</h3>
            <p>Traitez les appels, révisez les sanctions et suivez les cas en attente.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
