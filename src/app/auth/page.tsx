import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { AuthForm } from "./auth-form";
import { brand } from "@/lib/brand";
import { TraceMark } from "@/components/tracelab/brand-mark";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; invite?: string; next?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(sp.invite ? `/join/${sp.invite}` : "/app");
  const mode = sp.mode === "signup" ? "signup" : "signin";
  return (
    <main id="main" className="grid min-h-dvh bg-canvas place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center gap-2 font-semibold">
          <TraceMark className="h-7 w-7 text-text-1" />
          {brand.productName}
        </Link>
        <div className="card p-6">
          <AuthForm mode={mode} invite={sp.invite} next={sp.next} />
        </div>
        <p className="hint mt-4 text-center">
          Demo account: <span className="mono">lead@trace.demo</span> / <span className="mono">demo1234</span>
        </p>
      </div>
    </main>
  );
}
