import { redirect } from "next/navigation";

// The showcase now opens the real model library instead of fictional project data.
export default function ShowcasePage() {
  redirect("/app/models");
}
