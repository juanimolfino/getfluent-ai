"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { JobStatus } from "@/lib/db/schema";

const ACTIVE_STATUSES = new Set<JobStatus>(["pending", "processing"]);

export function DashboardAutoRefresh({ statuses }: { statuses: JobStatus[] }) {
  const router = useRouter();
  const hasActiveJobs = statuses.some((status) => ACTIVE_STATUSES.has(status));

  useEffect(() => {
    if (!hasActiveJobs) return;

    const interval = window.setInterval(() => {
      router.refresh();
    }, 2500);

    return () => window.clearInterval(interval);
  }, [hasActiveJobs, router]);

  return null;
}
