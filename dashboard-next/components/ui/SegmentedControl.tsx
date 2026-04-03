import styles from "./ui.module.css";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: Readonly<{
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}>) {
  return (
    <div className={styles.segmented}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.segmentedItem} ${value === option.value ? styles.segmentedItemActive : ""}`}
          onClick={() => !option.disabled && onChange(option.value)}
          disabled={option.disabled}
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
