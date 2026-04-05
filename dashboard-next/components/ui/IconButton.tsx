import styles from "./ui.module.css";

export function IconButton({
  children,
  title,
  onClick,
  disabled = false,
  className = "",
}: Readonly<{
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}>) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.iconButton} ${disabled ? styles.iconButtonDisabled : ""} ${className}`}
    >
      {children}
    </button>
  );
}
