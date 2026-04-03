import styles from "./ui.module.css";

export function ErrorBanner({
  message,
  className = "",
}: Readonly<{
  message: string;
  className?: string;
}>) {
  return <div className={`${styles.errorBanner} ${className}`}>{message}</div>;
}
