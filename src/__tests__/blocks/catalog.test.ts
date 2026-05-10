import { describe, it, expect } from "vitest";
import { BLOCK_CATALOG } from "../../../web/src/lib/spec.js";
import { registry } from "../../blocks/index.js";

// Verify that every BLOCK_CATALOG defaultSection() produces a section that passes
// backend Zod validation. This catches field-name mismatches between the frontend
// catalog defaults and the backend schema definitions.
describe("BLOCK_CATALOG — default sections validate against backend schemas", () => {
  for (const entry of BLOCK_CATALOG) {
    it(`${entry.type} default passes backend Zod schema`, () => {
      const section = entry.defaultSection();
      // registry.validate() throws a descriptive error if the section is invalid
      expect(() => registry.validate(section)).not.toThrow();
    });
  }
});
