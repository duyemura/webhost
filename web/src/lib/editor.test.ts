import { describe, it, expect } from "vitest";
import { inferFieldType, colorToHex } from "./editor";

describe("inferFieldType()", () => {
  it("show_* keys → switch", () => {
    expect(inferFieldType("show_map", "")).toBe("switch");
    expect(inferFieldType("show_hours", "")).toBe("switch");
  });

  it("boolean value → switch regardless of key", () => {
    expect(inferFieldType("enabled", true)).toBe("switch");
    expect(inferFieldType("visible", false)).toBe("switch");
  });

  it("url key → url", () => {
    expect(inferFieldType("url", "")).toBe("url");
  });

  it("*_url keys → url", () => {
    expect(inferFieldType("image_url", "")).toBe("url");
    expect(inferFieldType("photo_url", "")).toBe("url");
  });

  it("textarea keys → textarea", () => {
    for (const key of ["body", "description", "html", "quote", "answer", "bio", "details", "subheadline"]) {
      expect(inferFieldType(key, ""), key).toBe("textarea");
    }
  });

  it("text keys → text", () => {
    for (const key of ["headline", "title", "name", "price", "period"]) {
      expect(inferFieldType(key, ""), key).toBe("text");
    }
  });

  it("unknown string value → text (scalar fallback)", () => {
    expect(inferFieldType("whatever", "some string")).toBe("text");
  });

  it("array value → json", () => {
    expect(inferFieldType("items", [])).toBe("json");
  });

  it("object value → json", () => {
    expect(inferFieldType("cta", { text: "Go", url: "#" })).toBe("json");
  });
});

describe("colorToHex()", () => {
  it("passes through full hex", () => {
    expect(colorToHex("#e63946")).toBe("#e63946");
  });

  it("expands short hex", () => {
    expect(colorToHex("#fff")).toBe("#ffffff");
    expect(colorToHex("#abc")).toBe("#aabbcc");
  });

  it("strips alpha channel from 8-digit hex", () => {
    expect(colorToHex("#e63946ff")).toBe("#e63946");
  });

  it("converts rgb()", () => {
    expect(colorToHex("rgb(230, 57, 70)")).toBe("#e63946");
  });

  it("converts rgba() ignoring alpha", () => {
    expect(colorToHex("rgba(230, 57, 70, 1)")).toBe("#e63946");
  });

  it("converts hsl() to a valid hex", () => {
    // hsl(354, 70%, 56%) ≈ #dc3e4f — just verify format and that it's not the fallback
    const hex = colorToHex("hsl(354, 70%, 56%)");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(hex).not.toBe("#000000");
  });

  it("converts hsl(0, 100%, 50%) → pure red #ff0000", () => {
    expect(colorToHex("hsl(0, 100%, 50%)")).toBe("#ff0000");
  });

  it("converts hsl(120, 100%, 50%) → pure green #00ff00", () => {
    expect(colorToHex("hsl(120, 100%, 50%)")).toBe("#00ff00");
  });

  it("converts hsl(240, 100%, 50%) → pure blue #0000ff", () => {
    expect(colorToHex("hsl(240, 100%, 50%)")).toBe("#0000ff");
  });

  it("unknown/named colors → #000000 fallback", () => {
    expect(colorToHex("red")).toBe("#000000");
    expect(colorToHex("transparent")).toBe("#000000");
    expect(colorToHex("not-a-color")).toBe("#000000");
  });
});
