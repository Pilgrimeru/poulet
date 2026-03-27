import { useState } from "react";
import { Navbar } from "./components/Navbar/Navbar";
import { Home } from "./pages/Home/Home";
import { MessageHistory } from "./pages/MessageHistory/MessageHistory";
import styles from "./App.module.css";

export type View = "home" | "history" | "stats" | "settings";

export function App() {
  const [currentView, setCurrentView] = useState<View>("home");

  return (
    <div className={styles.layout}>
      <Navbar currentView={currentView} onViewChange={setCurrentView} />
      <div className={styles.mainContent}>
        {currentView === "home" && <Home />}
        {currentView === "history" && <MessageHistory />}
        {currentView === "stats" && (
          <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 18 }}>
            En construction : Statistiques du serveur (Bientôt)
          </div>
        )}
        {currentView === "settings" && (
          <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 18 }}>
            En construction : Paramètres du bot (Bientôt)
          </div>
        )}
      </div>
    </div>
  );
}

