export type OfflineSignoutChoice = { choice: "keep" | "discard"; count: number };
export function prepareOfflineSignout(options: { userId: string; locale?: "ru" | "en" | "kk" }): Promise<OfflineSignoutChoice | null>;
export function finishOfflineSignout(options: { userId: string; choice?: "keep" | "discard" }): Promise<number>;
