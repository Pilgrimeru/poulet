import styles from "./ui.module.css";

export function Panel({
  children,
  padded = true,
  muted = false,
  className = "",
}: Readonly<{
  children: React.ReactNode;
  padded?: boolean;
  muted?: boolean;
  className?: string;
}>) {
  return (
    <section
      className={[
        styles.panel,
        padded ? styles.panelPadded : "",
        muted ? styles.panelMuted : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </section>
  );
}
