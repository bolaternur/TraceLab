import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthForm, type AuthMode } from "../src/app/auth/auth-form";

describe("authentication before hydration", () => {
  it.each<AuthMode>(["signin", "signup", "verify", "forgot", "reset"])(
    "%s cannot accept or submit credentials before its handler is attached",
    mode => {
      const html = renderToStaticMarkup(createElement(AuthForm, {
        mode, locale: "en", next: "/workspace", previewAvailable: false,
      }));
      const form = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/);
      expect(form).not.toBeNull();
      // Native fallback must never put named credentials into the URL.
      expect(form![0]).toMatch(/^<form\b[^>]*\bmethod="post"/);
      expect(form![0]).toMatch(/^<form\b[^>]*\baria-busy="true"/);
      const fieldset = form![1].match(/<fieldset\b[^>]*\bdisabled=""[^>]*>([\s\S]*?)<\/fieldset>/);
      expect(fieldset).not.toBeNull();
      expect(fieldset![0]).toContain('aria-labelledby="account-title"');
      // All editable fields and submit/mode controls inherit disabled. No
      // legend may accidentally exempt credentials from fieldset disabling.
      expect(fieldset![1]).not.toMatch(/<legend\b/);
      expect(fieldset![1].match(/<(?:input|button|select|textarea)\b/g)).toEqual(
        form![1].match(/<(?:input|button|select|textarea)\b/g),
      );
      expect(fieldset![1]).toContain('type="submit"');
      if (["signin", "signup", "reset"].includes(mode)) {
        expect(fieldset![1]).toContain('name="password"');
      }
    },
  );
});
