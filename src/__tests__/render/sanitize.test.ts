import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../../render/sanitize.js";

describe("sanitizeHtml()", () => {
  it("strips script tags and their content", () => {
    const html = `<p>Hello</p><script>alert('xss')</script><p>World</p>`;
    expect(sanitizeHtml(html)).toBe("<p>Hello</p><p>World</p>");
  });

  it("strips style tags and their content", () => {
    const html = `<p>Hi</p><style>body { display:none }</style>`;
    expect(sanitizeHtml(html)).toBe("<p>Hi</p>");
  });

  it("strips iframe opening tags (closing tags remain in surrounding markup)", () => {
    const html = `<div><iframe src="evil.com"></div>`;
    // The regex strips only the opening tag; the outer </div> stays
    expect(sanitizeHtml(html)).toBe("<div></div>");
  });

  it("strips inline event handlers", () => {
    expect(sanitizeHtml(`<img src="x" onerror="alert(1)">`)).toBe(
      `<img src="x" >`
    );
    expect(sanitizeHtml(`<a onclick='steal()'>click</a>`)).toBe(
      `<a >click</a>`
    );
  });

  it("strips javascript: URIs", () => {
    const html = `<a href="javascript:alert(1)">click</a>`;
    expect(sanitizeHtml(html)).toBe(`<a href="alert(1)">click</a>`);
  });

  it("preserves safe HTML untouched", () => {
    const html = `<h1>Hello</h1><p class="lead">World &amp; co.</p>`;
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("handles multiline script blocks", () => {
    const html = `<p>Before</p><script>\nvar x = 1;\nalert(x);\n</script><p>After</p>`;
    expect(sanitizeHtml(html)).toBe("<p>Before</p><p>After</p>");
  });
});
