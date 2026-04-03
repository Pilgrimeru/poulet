"use client";

import { StatsScreen } from "@/features/stats";
import { Suspense } from "react";

export default function StatsPage() {
  return (
    <Suspense fallback={null}>
      <StatsScreen />
    </Suspense>
  );
}
