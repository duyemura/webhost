import type { ScriptDefinition } from "./index.js";

// For custom type, the raw code is passed in as tracking_id
export const custom: ScriptDefinition = {
  label: "Custom code",
  headSnippet: (code) => `<!-- Custom script -->\n${code}\n<!-- End custom script -->`,
};
