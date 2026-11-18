// locale-wired
import { requireUser } from "@/server/auth";
import { redirect } from 'next/navigation';
import { TeamSetup } from './team-setup';
import './team-setup.css';

export const dynamic = "force-dynamic";

export default async function OnboardingPage({searchParams}:{searchParams:Promise<{invite?:string}>}) {
  const {invite}=await searchParams;
  if(invite && /^[A-Za-z0-9_-]{12,64}$/.test(invite))redirect('/join/'+encodeURIComponent(invite));
  const user = await requireUser();
  return <TeamSetup initialLocale={user.locale} />;
}
