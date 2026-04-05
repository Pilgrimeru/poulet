import styles from "./ui.module.css";

export function ToggleField({
  checked,
  onChange,
}: Readonly<{
  checked: boolean;
  onChange: (value: boolean) => void;
}>) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={styles.toggleInput}
      />
      <span className={styles.toggleTrack} />
      <span className={styles.toggleThumb} />
    </label>
  );
}
