import { describe, expect, it } from "vitest";
import { uiPhrase } from "../src/lib/ui-phrases";

describe("Russian workspace localization", () => {
  it("translates primary screens and form actions", () => {
    expect(uiPhrase("Evidence Inbox", "ru")).toBe("Материалы проекта");
    expect(uiPhrase("Save capture", "ru")).toBe("Сохранить запись");
    expect(uiPhrase("What changed in this photo?", "ru")).toBe("Что изменилось на фотографии?");
  });
  it("normalizes source whitespace without joining neighboring words", () => {
    expect(uiPhrase("  Save   capture ", "ru")).toBe("  Сохранить запись ");
  });
  it("localizes counts while preserving values", () => {
    expect(uiPhrase("5 waiting to sync", "ru")).toBe("Ожидают отправки: 5");
    expect(uiPhrase("Select my robot", "ru")).toBe("Выбрать: my robot");
  });
  it("does not rewrite unknown user-authored content", () => {
    expect(uiPhrase("Thats is my studypy", "ru")).toBe("Thats is my studypy");
    expect(uiPhrase("My robot prototype 999", "en")).toBe("My robot prototype 999");
  });
});
