import styles from "./ui.module.css";

export function NumberField({
  value,
  onChange,
  min,
  step = 1,
  placeholder,
  className = "",
}: Readonly<{
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}>) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      placeholder={placeholder}
      className={`${styles.numberInput} ${className}`}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
