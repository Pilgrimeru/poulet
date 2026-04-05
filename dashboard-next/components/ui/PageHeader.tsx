import styles from "./ui.module.css";

export function PageHeader({
  title,
  subtitle,
  actions,
  compact = false,
}: Readonly<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}>) {
  return (
    <header className={`${styles.pageHeader} ${compact ? styles.pageHeaderCompact : ""}`}>
      <div className={styles.pageHeaderBody}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}
