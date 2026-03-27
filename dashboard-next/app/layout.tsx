import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar/Navbar";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Poulet Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className={styles.layout}>
          <Navbar />
          <div className={styles.mainContent}>{children}</div>
        </div>
      </body>
    </html>
  );
}
