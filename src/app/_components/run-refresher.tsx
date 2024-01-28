"use client";

import { type RunProjection } from "~/server/api/routers/workflow";
import { useInterval } from "../_hooks/useInterval";
import { useRouter } from "next/navigation";

export function ActiveRunRefresher({ runs }: { runs: RunProjection[] }) {
  const router = useRouter();
  const activeRuns = runs.filter((r) => r.status === "RUNNING");

  const hasActiveRuns = activeRuns.length > 0;

  useInterval(
    () => {
      router.refresh();
    },
    hasActiveRuns ? 1000 : null,
  );

  return <></>;
}
