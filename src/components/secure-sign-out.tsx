"use client";

import { signOut } from "@/server/actions";
import { clearPrivateClientData } from "@/lib/outbox";

export function SecureSignOut() {
  async function signOutAndClear() {
    await clearPrivateClientData();
    await signOut();
  }

  return (
    <form action={signOutAndClear}>
      <button className="btn" type="submit">Sign out securely</button>
    </form>
  );
}
