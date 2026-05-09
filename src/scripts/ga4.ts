import type { ScriptDefinition } from "./index.js";

export const ga4: ScriptDefinition = {
  label: "Google Analytics (GA4)",
  headSnippet: (id) => `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${id}');
</script>
<!-- End Google Analytics -->`,
};
