"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordUsageDay } from "@/server/community-actions";
export function UsageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const record = () => { if (document.visibilityState === "visible") void recordUsageDay().catch(() => {}); };
    record();
    document.addEventListener("visibilitychange", record);
    const timer = window.setInterval(record, 60 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", record); window.clearInterval(timer); };
  }, [pathname]);
  return null;
}
