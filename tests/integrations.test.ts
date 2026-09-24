import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { extractRatio, extractTags, normalizeGithubPush, normalizeOnshape, normalizeTelegram, verifyGithubSignature, verifyStripeSignature } from "../src/integrations/normalize";
import { parseCsv } from "../src/lib/csv";
import { relativeImprovement, clusterEvents } from "../src/server/evidence";

describe("GitHub webhook", () => {
  const body = JSON.stringify({ ref: "refs/heads/main", repository: { full_name: "team/orion-robot" }, commits: [{ id: "abc123", message: "fix: intake PID overshoot\n\nlonger body", timestamp: "2026-09-02T14:02:00Z", url: "https://github.com/team/orion-robot/commit/abc123", author: { username: "anim" }, added: ["a.java"], modified: [], removed: [] }] });
  it("verifies HMAC signatures and rejects tampering", () => {
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifyGithubSignature(body, sig, "s3cret")).toBe(true);
    expect(verifyGithubSignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifyGithubSignature(body, sig, "other")).toBe(false);
    expect(verifyGithubSignature(body, null, "s3cret")).toBe(false);
    expect(verifyGithubSignature(body, "sha1=deadbeef", "s3cret")).toBe(false);
  });
  it("normalizes push → commit metadata only (no contents)", () => {
    const evs = normalizeGithubPush(JSON.parse(body));
    expect(evs).toHaveLength(1);
    expect(evs[0].providerEventId).toBe("abc123");
    expect(evs[0].title).toBe("fix: intake PID overshoot");
    expect(evs[0].rawMetadata.changedFiles).toBe(1);
    expect(evs[0].rawMetadata.branch).toBe("main");
    expect(JSON.stringify(evs[0])).not.toContain("longer body\n\nfile contents");
  });
});

describe("Onshape / chat normalizers", () => {
  it("Onshape says the design changed, never why", () => {
    const e = normalizeOnshape({ event: "onshape.model.lifecycle.changed", documentId: "d1", workspaceId: "w1", elementId: "e1", microversionId: "mv7", timestamp: "2026-09-01T10:00:00Z", messageId: "m1" });
    expect(e?.eventType).toBe("cad_revision");
    expect(e?.artifact?.externalReference).toContain("/documents/d1/w/w1/e/e1");
    expect(JSON.stringify(e)).not.toMatch(/rationale|because/);
    expect(normalizeOnshape({})).toBeNull();
  });
  it("Telegram: tags and ratios are metadata, not authoritative tests", () => {
    const e = normalizeTelegram({ update_id: 1, message: { message_id: 5, date: 1_700_000_000, text: "#test #intake 36 mm spacing 17/20 success", from: { id: 1, username: "anim_k" }, chat: { id: -100, title: "orion" } } });
    expect(e?.rawMetadata.tags).toEqual(["test", "intake"]);
    expect(e?.rawMetadata.ratio).toEqual({ successes: 17, trials: 20 });
    expect(extractTags("#Проблема #lift")).toEqual(["проблема", "lift"]);
    expect(extractRatio("25/20")).toBeNull();
    expect(extractRatio("no numbers")).toBeNull();
  });
});

describe("Stripe-style signature", () => {
  it("accepts fresh valid signatures and rejects stale/invalid ones", () => {
    const t = Math.floor(Date.now() / 1000);
    const body = '{"id":"evt_1"}';
    const v1 = createHmac("sha256", "whsec").update(`${t}.${body}`).digest("hex");
    expect(verifyStripeSignature(body, `t=${t},v1=${v1}`, "whsec")).toBe(true);
    expect(verifyStripeSignature(body, `t=${t - 10_000},v1=${v1}`, "whsec")).toBe(false);
    expect(verifyStripeSignature(body, `t=${t},v1=bad`, "whsec")).toBe(false);
  });
});

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes and CRLF without coercing values", () => {
    const rows = parseCsv('title,trials,successes\r\n"Intake, 36 mm",20,17\r\n"He said ""go""",abc,1\r\n');
    expect(rows).toEqual([
      ["title", "trials", "successes"],
      ["Intake, 36 mm", "20", "17"],
      ['He said "go"', "abc", "1"],
    ]);
  });
});

describe("evidence math & clustering", () => {
  it("computes relative improvement and refuses invalid inputs", () => {
    expect(relativeImprovement({ successes: 11, trials: 20 }, { successes: 17, trials: 20 })).toBe(54.5);
    expect(relativeImprovement({ successes: 0, trials: 20 }, { successes: 17, trials: 20 })).toBeNull();
    expect(relativeImprovement({ successes: 1, trials: 0 }, { successes: 1, trials: 1 })).toBeNull();
  });
  it("clusters same-subsystem events within 30 minutes as suggestions only", () => {
    const base = Date.now();
    const evs = [
      { id: "a", occurredAt: new Date(base), subsystemId: "s1", rawMetadata: {}, provider: "github" },
      { id: "b", occurredAt: new Date(base + 10 * 60_000), subsystemId: "s1", rawMetadata: {}, provider: "onshape" },
      { id: "c", occurredAt: new Date(base + 3 * 3600_000), subsystemId: "s1", rawMetadata: {}, provider: "github" },
      { id: "d", occurredAt: new Date(base + 5 * 60_000), subsystemId: "s2", rawMetadata: {}, provider: "github" },
    ];
    const c = clusterEvents(evs);
    expect(c).toHaveLength(1);
    expect(c[0].eventIds.sort()).toEqual(["a", "b"]);
    expect(c[0].label).toBe("Possible iteration");
  });
});
