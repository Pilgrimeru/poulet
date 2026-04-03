import { Panel } from "./Panel";
import styles from "./ui.module.css";

export function EmptyState({
  title,
  description,
  className = "",
}: Readonly<{
  title: string;
  description?: string;
  className?: string;
}>) {
  return (
    <Panel className={className}>
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}>{title}</div>
        {description ? <div className={styles.emptyDescription}>{description}</div> : null}
      </div>
    </Panel>
  );
}
