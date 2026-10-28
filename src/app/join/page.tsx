import {redirect} from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {getCurrentUser} from "@/server/auth";
import {JoinForm} from "./[code]/join-form";
import "../onboarding/team-setup.css";

export const dynamic="force-dynamic";
export const metadata={title:"Iznera · Join team",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function JoinTeamPage(){
  const user=await getCurrentUser();
  if(!user)redirect('/auth?mode=signup&next=%2Fjoin');
  return <main id="main" className="tl-setup"><header><Link href="/" aria-label="Iznera"><BrandLogo /></Link></header><div className="tl-setup-content"><JoinForm locale={user.locale}/></div></main>;
}
