import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { JoinForm } from "./join-form";
import "../../onboarding/team-setup.css";

export const dynamic = "force-dynamic";
export const metadata = {title:"TraceLab · Join team",robots:{index:false,follow:false},referrer:"no-referrer" as const};

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?mode=signup&invite=${encodeURIComponent(code)}`);
  return <main id="main" className="tl-setup"><header><Link href="/">TraceLab</Link></header><div className="tl-setup-content"><JoinForm code={code} locale={user.locale} /></div></main>;
}
