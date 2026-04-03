"use client";

import { Suspense } from "react";
import { ModerationInner } from "./ModerationInner";

export default function ModerationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Chargement…</div>}>
      <ModerationInner />
    </Suspense>
  );
}
