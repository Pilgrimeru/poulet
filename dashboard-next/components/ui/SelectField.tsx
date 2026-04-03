import styles from "./ui.module.css";

export function SelectField({
  value,
  onChange,
  children,
  className = "",
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <select className={`${styles.select} ${className}`} value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  );
}
