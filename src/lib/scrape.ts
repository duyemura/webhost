import { load } from "cheerio";

export interface ScrapedImage {
  src: string;
  alt: string;
}

export interface ScrapedSection {
  tag: string;
  class_hints: string;
  heading: string;
  subheading: string;
  paragraphs: string[];
  buttons: string[];
  list_items: string[];
  images: ScrapedImage[];
}

export interface ScrapedPage {
  url: string;
  slug: string;
  title: string;
  sections: ScrapedSection[];
  page_images: string[];  // absolute image URLs from CSS/preload hints, not tied to a section
  _html?: string;  // raw HTML preserved on home page only, for brand extraction
}

export interface ScrapeResult {
  site_name: string;
  base_url: string;
  pages: [ScrapedPage, ...ScrapedPage[]];
}

export type ScrapeEvent =
  | { type: "discovered"; urls: string[] }
  | { type: "fetching"; url: string }
  | { type: "page_done"; url: string; title: string; sections: number }
  | { type: "page_failed"; url: string };

const SECTION_SELECTORS = [
  "header", "section", "article",
  "main > div", "main > [class]",
  "[class*='hero']", "[class*='about']", "[class*='feature']",
  "[class*='pricing']", "[class*='team']", "[class*='contact']",
  "[class*='faq']", "[class*='testimonial']", "[class*='review']",
  "[class*='gallery']", "[class*='cta']", "[class*='banner']",
  "[class*='offer']", "[class*='program']", "[class*='service']",
];

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// Private/reserved IPv4 ranges that must never be fetched server-side
const PRIVATE_IPV4 = /^(127\.|10\.|169\.254\.|0\.|255\.|(172\.(1[6-9]|2\d|3[01])\.)|(192\.168\.)|(100\.(6[4-9]|[7-9]\d|1([01]\d|2[0-7]))\.))/;
const PRIVATE_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

/** Throws if the URL is not a public http/https URL. Returns the parsed URL. */
export function validatePublicUrl(rawUrl: string): URL {
  const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`URL must use http or https`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (PRIVATE_HOSTNAMES.has(host) || PRIVATE_IPV4.test(host)) {
    throw new Error(`URL targets a private or reserved address`);
  }
  return url;
}

/** Returns false for URLs that point to private/reserved addresses — used for soft-skip contexts. */
export function isPublicUrl(url: string): boolean {
  try {
    validatePublicUrl(url);
    return true;
  } catch {
    return false;
  }
}

function slugFromPath(pathname: string): string {
  const clean = pathname.replace(/\/$/, "").replace(/^\//, "");
  return clean || "index";
}

function isContentImage(src: string): boolean {
  if (src.startsWith("data:")) return false;
  const lower = src.toLowerCase();
  if (/\/(icon|sprite|logo|favicon|arrow|chevron|star|check|close|menu|social|badge)[-_.]/.test(lower)) return false;
  if (/\.(ico|svg)(\?|$)/.test(lower)) return false;
  return true;
}

/** Extract image URLs that are referenced in CSS (style blocks, linked sheets, preload hints) */
async function extractCssImages(html: string, baseUrl: string): Promise<string[]> {
  const $ = load(html);
  const found: string[] = [];

  function addUrl(raw: string) {
    const clean = raw.replace(/['"]/g, "").trim();
    if (!clean || !isContentImage(clean)) return;
    try {
      const abs = new URL(clean, baseUrl).href;
      if (!found.includes(abs)) found.push(abs);
    } catch { /* skip invalid URL */ }
  }

  // `<link rel="preload" as="image">` — explicitly flagged critical images
  $("link[rel='preload'][as='image']").each((_, el) => {
    const href = $(el).attr("href") ?? $(el).attr("imagesrcset")?.split(",")[0]?.trim()?.split(" ")[0];
    if (href) addUrl(href);
  });

  // `<style>` blocks — any url() pointing at an image
  $("style").each((_, el) => {
    const css = $(el).text();
    const matches = css.matchAll(/url\(\s*(['"]?)([^'")\s]+\.(?:webp|jpg|jpeg|png|gif)(?:\?[^'")\s]*)?)\1\s*\)/gi);
    for (const m of matches) addUrl(m[2]);
  });

  // Linked CSS stylesheets — fetch & parse, one level deep
  const sheetUrls: string[] = [];
  $("link[rel='stylesheet'][href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).href;
      if (isPublicUrl(abs)) sheetUrls.push(abs);
    } catch { /* skip */ }
  });

  await Promise.all(sheetUrls.slice(0, 3).map(async (sheetUrl) => {
    try {
      const res = await fetch(sheetUrl, {
        headers: { "User-Agent": FETCH_HEADERS["User-Agent"] },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return;
      const css = await res.text();
      const matches = css.matchAll(/url\(\s*(['"]?)([^'")\s]+\.(?:webp|jpg|jpeg|png|gif)(?:\?[^'")\s]*)?)\1\s*\)/gi);
      for (const m of matches) addUrl(m[2]);
    } catch (err) {
      console.warn({ err, sheetUrl }, "css stylesheet fetch failed — skipping");
    }
  }));

  return found.slice(0, 10);
}

function extractSections(html: string, baseUrl?: string): ScrapedSection[] {
  const $ = load(html);

  // Remove noise
  $("script, style, noscript, nav, [aria-hidden='true'], [class*='cookie'], [class*='popup'], [class*='modal']").remove();

  const seen = new Set<string>();
  const sections: ScrapedSection[] = [];

  $(SECTION_SELECTORS.join(", ")).each((_, el) => {
    const $el = $(el);

    const text = $el.text().replace(/\s+/g, " ").trim();
    if (text.length < 30) return;

    const fingerprint = text.slice(0, 80);
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);

    const heading = $el.find("h1, h2, h3").first().text().replace(/\s+/g, " ").trim();
    const subheading = $el.find("h2, h3, h4").not($el.find("h1 ~ h2, h1 ~ h3")).first().text().replace(/\s+/g, " ").trim();

    const paragraphs = $el.find("p")
      .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(t => t.length > 20 && t.length < 600);

    const buttons = $el.find("a[class*='btn'], a[class*='cta'], button, a[class*='button'], .button, .btn")
      .map((_, b) => $(b).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(t => t.length > 1 && t.length < 60);

    const listItems = $el.find("li")
      .map((_, li) => $(li).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(t => t.length > 5 && t.length < 200)
      .slice(0, 12);

    // Build paired image list: img tags first, then CSS backgrounds (no alt)
    const images: ScrapedImage[] = [];
    const seenSrcs = new Set<string>();

    $el.find("img[src]").each((_, img) => {
      const src = $(img).attr("src") ?? "";
      if (!src || !isContentImage(src)) return;
      try {
        const abs = baseUrl ? new URL(src, baseUrl).href : src;
        if (!seenSrcs.has(abs)) {
          seenSrcs.add(abs);
          images.push({ src: abs, alt: $(img).attr("alt") ?? "" });
        }
      } catch { /* skip invalid URL */ }
    });

    const styleEls = [$el, ...$el.children().toArray().slice(0, 3).map(c => $el.find(c))];
    for (const styleEl of styleEls) {
      const style = typeof styleEl.attr === "function" ? (styleEl.attr("style") ?? "") : "";
      const match = style.match(/background(?:-image)?\s*:[^;]*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
      if (match?.[1] && isContentImage(match[1])) {
        try {
          const abs = baseUrl ? new URL(match[1], baseUrl).href : match[1];
          if (!seenSrcs.has(abs)) {
            seenSrcs.add(abs);
            images.push({ src: abs, alt: "" });
          }
        } catch { /* skip invalid URL */ }
      }
    }

    const tag = (el as { tagName: string }).tagName;
    const className = ($el.attr("class") ?? "").slice(0, 80);
    const id = ($el.attr("id") ?? "").slice(0, 40);

    sections.push({
      tag,
      class_hints: `${className} ${id}`.trim(),
      heading,
      subheading,
      paragraphs: paragraphs.slice(0, 6),
      buttons: buttons.slice(0, 4),
      list_items: listItems,
      images: images.slice(0, 3),
    });
  });

  return sections;
}

function extractNavLinks(html: string, baseUrl: URL): string[] {
  const $ = load(html);
  const links: string[] = [];

  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const url = new URL(href, baseUrl);
      if (url.hostname !== baseUrl.hostname) return;
      if (url.pathname.match(/\.(pdf|jpg|png|gif|css|js)$/i)) return;
      if (url.pathname === baseUrl.pathname && url.hash) return;
      url.hash = "";
      if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
      links.push(url.href);
    } catch { /* ignore invalid hrefs */ }
  });

  return [...new Set(links)];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  } catch (err) {
    console.warn({ err, url }, "fetchPage failed");
    return null;
  }
}

export async function scrapeWebsite(
  rawUrl: string,
  onEvent: (e: ScrapeEvent) => void = () => {},
): Promise<ScrapeResult> {
  const baseUrl = validatePublicUrl(rawUrl);

  onEvent({ type: "fetching", url: baseUrl.href });
  let homeHtml = await fetchPage(baseUrl.href);

  // Try www. prefix if bare domain failed
  if (!homeHtml && !baseUrl.hostname.startsWith("www.")) {
    const wwwUrl = new URL(baseUrl.href);
    wwwUrl.hostname = `www.${wwwUrl.hostname}`;
    onEvent({ type: "fetching", url: wwwUrl.href });
    homeHtml = await fetchPage(wwwUrl.href);
    if (homeHtml) baseUrl.hostname = wwwUrl.hostname;
  }

  if (!homeHtml) {
    throw new Error(
      `Could not fetch ${baseUrl.href}. The site may block automated requests, require a login, or be behind a firewall. Try a different URL.`
    );
  }

  const $ = load(homeHtml);
  const site_name = $("title").first().text().replace(/\s+/g, " ").trim().split(/[-|]/)[0].trim();
  const homeSections = extractSections(homeHtml, baseUrl.href);
  const homeTitle = $("title").first().text().trim();
  const homeCssImages = await extractCssImages(homeHtml, baseUrl.href);

  const homePage: ScrapedPage = { url: baseUrl.href, slug: "index", title: homeTitle, sections: homeSections, page_images: homeCssImages, _html: homeHtml };
  const pages: [ScrapedPage, ...ScrapedPage[]] = [homePage];
  onEvent({ type: "page_done", url: baseUrl.href, title: homeTitle, sections: homeSections.length });

  // Discover nav links
  const navLinks = extractNavLinks(homeHtml, baseUrl);
  const toVisit = navLinks
    .filter(l => l !== baseUrl.href && l !== baseUrl.href + "/")
    .slice(0, 5);

  if (toVisit.length > 0) {
    onEvent({ type: "discovered", urls: toVisit });
  }

  // Fetch additional pages sequentially so progress events stay ordered
  for (const link of toVisit) {
    onEvent({ type: "fetching", url: link });
    const html = await fetchPage(link);
    if (!html) {
      onEvent({ type: "page_failed", url: link });
      continue;
    }
    const u = new URL(link);
    const ld = load(html);
    const title = ld("title").first().text().trim();
    const sections = extractSections(html, link);
    const cssImages = await extractCssImages(html, link);
    pages.push({ url: link, slug: slugFromPath(u.pathname), title, sections, page_images: cssImages });
    onEvent({ type: "page_done", url: link, title, sections: sections.length });
  }

  return { site_name, base_url: baseUrl.href, pages };
}
