"use client";
import { useCallback } from "react";
import type { MessageFilters } from "../../hooks/useMessages";
import { DEFAULT_FILTERS } from "../../hooks/useMessages";
import styles from "./FilterBar.module.css";

interface Props {
  filters: MessageFilters;
  onChange: (filters: MessageFilters) => void;
}

export function FilterBar({ filters, onChange }: Readonly<Props>) {
  const set = useCallback(
    (patch: Partial<MessageFilters>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  const isActive = filters.search || filters.dateFrom || filters.dateTo || filters.onlyDeleted;

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrapper}>
        <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Rechercher dans les messages…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          aria-label="Rechercher dans les messages"
        />
        {filters.search && (
          <button className={styles.clearBtn} onClick={() => set({ search: "" })} aria-label="Effacer">×</button>
        )}
      </div>

      <div className={styles.dateRange}>
        <label className={styles.dateLabel} aria-label="Du">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={styles.calIcon}>
            <rect x="1.5" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            className={styles.dateInput}
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            aria-label="Du"
          />
        </label>

        <span className={styles.dateSep}>→</span>

        <label className={styles.dateLabel} aria-label="Au">
          <input
            className={styles.dateInput}
            type="date"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            aria-label="Au"
          />
        </label>
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={filters.onlyDeleted}
          onChange={(e) => set({ onlyDeleted: e.target.checked })}
        />
        <span className={styles.toggleLabel}>Supprimés uniquement</span>
      </label>

      {isActive && (
        <button className={styles.resetBtn} onClick={() => onChange(DEFAULT_FILTERS)}>
          Réinitialiser
        </button>
      )}
    </div>
  );
}
