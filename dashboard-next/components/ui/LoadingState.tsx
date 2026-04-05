import { Panel } from "./Panel";
import styles from "./ui.module.css";

export function LoadingState({
  label = "Chargement…",
  className = "",
}: Readonly<{
  label?: string;
  className?: string;
}>) {
  return (
    <Panel className={className}>
      <div className={styles.loadingState}>{label}</div>
    </Panel>
  );
}
