import { Navbar } from "@/components/Navbar/Navbar";
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Poulet Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning={true}>
        <div className={styles.layout}>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          <div className={styles.mainContent}>{children}</div>
        </div>
      </body>
    </html>
  );
}
