const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

// Blocks javascript: and data: schemes before HTML-encoding. Use for href/src attributes.
export function safeUrl(url: string): string {
  if (/^\s*(javascript|data):/i.test(url)) return "#";
  return esc(url);
}
