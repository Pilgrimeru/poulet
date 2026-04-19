import styles from "./ui.module.css";

type MultiValueOption = {
  value: string;
  label: string;
};

export function MultiValueSelect({
  options,
  value,
  onChange,
  placeholder = "Ajouter un élément",
  emptyText = "Aucun élément sélectionné.",
}: Readonly<{
  options: MultiValueOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}>) {
  const uniqueOptions = Array.from(
    new Map(options.map((option) => [option.value, option] as const)).values(),
  );

  const uniqueValue = Array.from(new Set(value));

  const selectedOptions = uniqueValue
    .map((selectedValue) => uniqueOptions.find((option) => option.value === selectedValue))
    .filter((option): option is MultiValueOption => Boolean(option));

  const availableOptions = uniqueOptions.filter((option) => !uniqueValue.includes(option.value));

  return (
    <div className={styles.multiValueSelect}>
      {selectedOptions.length > 0 ? (
        <div className={styles.multiValueList}>
          {selectedOptions.map((option) => (
            <div key={option.value} className={styles.multiValueItem}>
              <span className={styles.multiValueLabel}>{option.label}</span>
              <button type="button" className={styles.multiValueRemove} onClick={() => onChange(uniqueValue.filter((id) => id !== option.value))}>
                Retirer
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span className={styles.fieldHint}>{emptyText}</span>
      )}

      <select
        className={styles.select}
        value=""
        onChange={(event) => {
          const nextValue = event.target.value;
          if (!nextValue || uniqueValue.includes(nextValue)) return;
          onChange([...uniqueValue, nextValue]);
        }}
      >
        <option value="">{placeholder}</option>
        {availableOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
