import { storage } from "./storage";

// Preserve imports while all media, reports, chat and legacy paths share the
// same private provider and lifecycle fence.
export { PrivateSupabaseStorage } from "./private-supabase-storage";
export const mediaStorage = storage;
