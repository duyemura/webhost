import type { ScriptDefinition } from "./index.js";

// tracking_id is the PushPress company key (e.g. "crossfit-downtown")
export const pushpress: ScriptDefinition = {
  label: "PushPress",
  headSnippet: (id) => `<!-- PushPress -->
<script async src="https://widgets.pushpress.com/loader.js" data-company="${id}"></script>
<!-- End PushPress -->`,
};
