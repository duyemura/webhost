interface Env {
  SITES: R2Bucket;
  PLATFORM_DOMAIN: string; // "onboardagent.com"
}

const ASSET_RE = /^\/api\/sites\/([^/]+)\/assets\/([a-zA-Z0-9_-]+\.[a-z0-9]+)$/;

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", ico: "image/x-icon",
  mp4: "video/mp4", webm: "video/webm",
  svg: "image/svg+xml", avif: "image/avif",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const platformDomain = env.PLATFORM_DOMAIN || "onboardagent.com";
    const suffix = `.${platformDomain}`;

    if (!hostname.endsWith(suffix)) {
      return new Response("Not found", { status: 404 });
    }

    const siteSlug = hostname.slice(0, hostname.length - suffix.length);
    if (!siteSlug) return new Response("Not found", { status: 404 });

    // Asset requests: /api/sites/{siteId}/assets/{filename}
    const assetMatch = ASSET_RE.exec(url.pathname);
    if (assetMatch) {
      const [, siteId, filename] = assetMatch;
      const ext = filename.split(".").pop() ?? "";
      const object = await env.SITES.get(`assets/${siteId}/${filename}`);
      if (!object) return new Response("Not found", { status: 404 });
      return new Response(object.body, {
        headers: {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Page requests: serve rendered HTML from live/{slug}/{path}/index.html
    const pagePath = url.pathname.replace(/\/+$/, "") || "/";
    const r2Key =
      pagePath === "/"
        ? `live/${siteSlug}/index.html`
        : `live/${siteSlug}${pagePath}/index.html`;

    const object = await env.SITES.get(r2Key);
    if (!object) {
      // Try the root index for unknown paths (handles trailing slash variants etc.)
      const index = await env.SITES.get(`live/${siteSlug}/index.html`);
      if (!index) {
        return new Response(`Site "${siteSlug}" not found or not yet published.`, {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response(index.body, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  },
};
