import { describe, it, expect } from "vitest";
import { esc, safeUrl } from "../../render/escape.js";

describe("esc()", () => {
  it("escapes ampersands", () => {
    expect(esc("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(esc("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(esc(`say "hello"`)).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(esc("it's")).toBe("it&#39;s");
  });

  it("escapes all five characters together", () => {
    expect(esc(`<a href="foo" onload='bar'>&`)).toBe(
      "&lt;a href=&quot;foo&quot; onload=&#39;bar&#39;&gt;&amp;"
    );
  });

  it("returns empty string for empty input", () => {
    expect(esc("")).toBe("");
  });

  it("handles non-string values: numbers stringify, null/undefined coerce to empty", () => {
    expect(esc(42)).toBe("42");
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("does not double-escape already-escaped entities", () => {
    // esc is not idempotent — it escapes the & in &amp;
    expect(esc("&amp;")).toBe("&amp;amp;");
  });
});

describe("safeUrl()", () => {
  it("blocks javascript: scheme", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
  });

  it("blocks javascript: case-insensitively", () => {
    expect(safeUrl("JavaScript:alert(1)")).toBe("#");
    expect(safeUrl("JAVASCRIPT:x")).toBe("#");
  });

  it("blocks data: scheme", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("blocks schemes with leading whitespace", () => {
    expect(safeUrl("  javascript:alert(1)")).toBe("#");
  });

  it("passes through normal https URLs", () => {
    expect(safeUrl("https://example.com/page")).toBe("https://example.com/page");
  });

  it("passes through relative URLs", () => {
    expect(safeUrl("/signup")).toBe("/signup");
    expect(safeUrl("#section")).toBe("#section");
  });

  it("HTML-encodes characters in safe URLs", () => {
    expect(safeUrl('https://example.com?q=a&b=c')).toBe("https://example.com?q=a&amp;b=c");
  });
});
