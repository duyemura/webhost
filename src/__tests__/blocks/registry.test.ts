import { describe, it, expect, vi } from "vitest";
import { BlockRegistry } from "../../blocks/registry.js";
import { DEFAULT_THEME } from "../../blocks/types.js";
import { z } from "zod";

const noop = () => "<section>ok</section>";

const fakeBlock = {
  type: "fake",
  schema: z.object({ id: z.string(), type: z.string() }),
  render: noop,
  aiSchema: {},
};

describe("BlockRegistry", () => {
  it("registers and renders a block by type", () => {
    const registry = new BlockRegistry();
    registry.register(fakeBlock);
    const html = registry.render({ id: "s1", type: "fake" }, DEFAULT_THEME, null);
    expect(html).toBe("<section>ok</section>");
  });

  it("returns empty string for unknown block type", () => {
    const registry = new BlockRegistry();
    const html = registry.render({ id: "s1", type: "unknown" }, DEFAULT_THEME, null);
    expect(html).toBe("");
  });

  it("returns empty string and logs when render throws", () => {
    const registry = new BlockRegistry();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    registry.register({
      ...fakeBlock,
      type: "broken",
      render: () => { throw new Error("boom"); },
    });

    const html = registry.render({ id: "s1", type: "broken" }, DEFAULT_THEME, null);
    expect(html).toBe("");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("broken"),
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });

  it("getTypes() returns all registered block types", () => {
    const registry = new BlockRegistry();
    registry.register(fakeBlock);
    registry.register({ ...fakeBlock, type: "other" });
    expect(registry.getTypes()).toEqual(expect.arrayContaining(["fake", "other"]));
  });

  it("toAISchema() returns schema keyed by type", () => {
    const registry = new BlockRegistry();
    const aiSchema = { properties: { headline: { type: "string" } } };
    registry.register({ ...fakeBlock, aiSchema });
    const result = registry.toAISchema() as Record<string, unknown>;
    expect(result["fake"]).toEqual(aiSchema);
  });
});
