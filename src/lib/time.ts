/** Small time helpers kept outside components so render functions stay pure. */
export function nowMs() {
  return Date.now();
}
export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000);
}
export function inviteIsValid(inv: { revokedAt: Date | null; expiresAt: Date; uses: number; maxUses: number }) {
  return !inv.revokedAt && inv.expiresAt.getTime() > Date.now() && inv.uses < inv.maxUses;
}
