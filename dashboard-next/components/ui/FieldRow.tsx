import styles from "./ui.module.css";

export function FieldRow({
  label,
  hint,
  children,
}: Readonly<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldMeta}>
        <div className={styles.fieldLabel}>{label}</div>
        {hint ? <div className={styles.fieldHint}>{hint}</div> : null}
      </div>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  );
}
