import styles from "./ui.module.css";

type Tone = "neutral" | "success" | "danger" | "accent";

export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
}: Readonly<{
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}>) {
  const toneClass = tone === "success"
    ? styles.statusSuccess
    : tone === "danger"
      ? styles.statusDanger
      : tone === "accent"
        ? styles.statusAccent
        : styles.statusNeutral;

  return <span className={`${styles.statusBadge} ${toneClass} ${className}`}>{children}</span>;
}
