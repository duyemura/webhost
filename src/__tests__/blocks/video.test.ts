import { describe, it, expect } from "vitest";
import { render } from "../../blocks/video/renderer.js";
import { DEFAULT_THEME } from "../../blocks/types.js";

const theme = DEFAULT_THEME;

function section(fields: Record<string, unknown>) {
  return { id: "v1", type: "video", ...fields };
}

describe("video renderer — URL extraction", () => {
  it("embeds youtube.com/watch?v= URLs", () => {
    const html = render(section({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }), theme, null);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("<iframe");
  });

  it("embeds youtu.be/ short URLs", () => {
    const html = render(section({ url: "https://youtu.be/dQw4w9WgXcQ" }), theme, null);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("embeds youtube.com/embed/ URLs", () => {
    const html = render(section({ url: "https://www.youtube.com/embed/dQw4w9WgXcQ" }), theme, null);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("embeds youtube.com/shorts/ URLs", () => {
    const html = render(section({ url: "https://www.youtube.com/shorts/dQw4w9WgXcQ" }), theme, null);
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("embeds vimeo.com URLs", () => {
    const html = render(section({ url: "https://vimeo.com/123456789" }), theme, null);
    expect(html).toContain("https://player.vimeo.com/video/123456789");
    expect(html).toContain("<iframe");
  });

  it("renders fallback text for arbitrary URLs (security: no unknown iframes)", () => {
    const html = render(section({ url: "https://evil.com/video.mp4" }), theme, null);
    expect(html).not.toContain("<iframe");
    expect(html).toContain("only YouTube and Vimeo URLs are supported");
  });

  it("renders fallback for javascript: URLs", () => {
    const html = render(section({ url: "javascript:alert(1)" }), theme, null);
    expect(html).not.toContain("<iframe");
  });

  it("renders headline and subheadline when provided", () => {
    const html = render(section({ url: "https://youtu.be/abc1234abcd", headline: "Our Story", subheadline: "Watch this" }), theme, null);
    expect(html).toContain("<h2>Our Story</h2>");
    expect(html).toContain("<p>Watch this</p>");
  });

  it("sets allowfullscreen on iframe", () => {
    const html = render(section({ url: "https://youtu.be/dQw4w9WgXcQ" }), theme, null);
    expect(html).toContain("allowfullscreen");
  });

  it("uses headline as iframe title for accessibility", () => {
    const html = render(section({ url: "https://youtu.be/dQw4w9WgXcQ", headline: "My Video" }), theme, null);
    expect(html).toContain('title="My Video"');
  });
});
