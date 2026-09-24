"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SpatialRouteSurface } from "@/components/spatial-motion/route-surface";

export function SecondaryRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSpatialHome = pathname === "/app";
  const isSpatialPowerView = pathname === "/app/graph" || pathname === "/app/timeline";
  const isSpatialRoute = isSpatialHome || isSpatialPowerView;

  return (
    <div className={isSpatialHome ? "min-w-0 flex-1 overflow-hidden" : "min-w-0 flex-1 bg-canvas"}>
      <main
        id="main"
        className={
          isSpatialHome
            ? "h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden md:h-dvh"
            : isSpatialPowerView
              ? "h-[calc(100dvh-3.5rem)] min-w-0 overflow-y-auto px-3 py-4 pb-28 sm:px-4 md:h-dvh md:px-5 md:py-5 md:pb-8 xl:px-6"
              : "mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-[1320px] px-4 py-5 pb-28 sm:px-6 md:min-h-dvh md:px-8 md:py-7 md:pb-10 xl:px-10"
        }
      >
        {isSpatialRoute ? <SpatialRouteSurface routeKey={pathname}>{children}</SpatialRouteSurface> : children}
      </main>
    </div>
  );
}
