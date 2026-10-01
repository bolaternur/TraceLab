import { describe, it, expect, vi, beforeEach } from "vitest";
import { calendarDays, dayKey, reviewInput } from "../src/lib/community";

const mocks = vi.hoisted(() => ({
  requireTeam: vi.fn(), values: vi.fn(), upsert: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ requireTeam: mocks.requireTeam }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/db", () => ({ db: { insert: () => ({ values: mocks.values }) } }));
import { saveProductReview } from "../src/server/community-actions";

describe("community", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeam.mockResolvedValue({ team: { id: "real-team" }, user: { id: "real-user" } });
    mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.upsert });
    mocks.upsert.mockResolvedValue(undefined);
  });
  it("uses the team's date around midnight and crosses leap days", () => {
    expect(dayKey(new Date("2026-09-29T20:00:00Z"), "Asia/Almaty")).toBe("2026-09-30");
    const days = calendarDays("2024-03-01", 2);
    expect(days).toContain("2024-02-29");
    expect(days.length).toBe(14);
    expect(new Date(`${days[0]}T12:00:00Z`).getUTCDay()).toBe(1);
    expect(new Set(days).size).toBe(14);
  });
  it("rejects empty reviews, out-of-range ratings and absent consent", () => {
    for (const input of [{ body: "          ", rating: 5, consent: "yes" }, { body: "Useful feedback", rating: 6, consent: "yes" }, { body: "Useful feedback", rating: 5 }]) expect(reviewInput.safeParse(input).success).toBe(false);
  });
  it("derives identity from the session, not submitted fields", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ body: "Useful feedback for the project", rating: "4", consent: "yes", teamId: "other-team", userId: "other-user" })) form.set(key, value);
    expect(await saveProductReview(null, form)).toEqual({ ok: true });
    expect(mocks.values).toHaveBeenCalledWith({ teamId: "real-team", userId: "real-user", body: "Useful feedback for the project", rating: 4 });
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledWith("/app/community");
  });
  it("does not write invalid submissions and reports persistence failures", async () => {
    expect((await saveProductReview(null, new FormData()))?.ok).toBe(false);
    expect(mocks.values).not.toHaveBeenCalled();
    const form = new FormData();
    form.set("body", "Useful feedback for testing"); form.set("rating", "4"); form.set("consent", "yes");
    mocks.upsert.mockRejectedValueOnce(new Error("database offline"));
    expect((await saveProductReview(null, form))?.ok).toBe(false);
  });
});
