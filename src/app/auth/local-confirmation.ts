export type LocalMailPurpose = "verify_email" | "reset_password";
export type LocalMailMessage = { id: string; subject: string; actionUrl: string; purpose?: LocalMailPurpose; createdAt?: string };

/** Local preview links must remain on this origin and match the requested action. */
export function localConfirmation(message: LocalMailMessage, purpose: LocalMailPurpose, origin: string) {
  try {
    const url = new URL(message.actionUrl);
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    if (message.purpose !== purpose || url.origin !== origin || url.pathname !== "/auth" ||
        url.searchParams.get("mode") !== (purpose === "verify_email" ? "verify" : "reset") ||
        !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return { token, url: url.href };
  } catch { return null; }
}
