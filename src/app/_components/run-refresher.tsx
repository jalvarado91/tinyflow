"use client";

import { type RunProjection } from "~/server/api/routers/workflow";
import { useInterval } from "../_hooks/useInterval";
import { useRouter } from "next/navigation";

export function ActiveRunsRefresher({ runs }: { runs: RunProjection[] }) {
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

export function RunRefresher({ run }: { run: RunProjection }) {
  const router = useRouter();

  const hasActiveRuns = run.status === "RUNNING";

  useInterval(
    () => {
      router.refresh();
    },
    hasActiveRuns ? 1000 : null,
  );

  return <></>;
}
