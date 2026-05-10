import { load } from "cheerio";

export interface ScrapedSection {
  tag: string;
  class_hints: string;
  heading: string;
  subheading: string;
  paragraphs: string[];
  buttons: string[];
  list_items: string[];
  image_alts: string[];
}

export interface ScrapedPage {
  url: string;
  slug: string;
  title: string;
  sections: ScrapedSection[];
}

export interface ScrapeResult {
  site_name: string;
  base_url: string;
  pages: ScrapedPage[];
}

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

function slugFromPath(pathname: string): string {
  const clean = pathname.replace(/\/$/, "").replace(/^\//, "");
  return clean || "index";
}

function extractSections(html: string): ScrapedSection[] {
  const $ = load(html);

  // Remove noise
  $("script, style, noscript, nav, [aria-hidden='true'], [class*='cookie'], [class*='popup'], [class*='modal']").remove();

  const seen = new Set<string>();
  const sections: ScrapedSection[] = [];

  $(SECTION_SELECTORS.join(", ")).each((_, el) => {
    const $el = $(el);

    // Skip tiny elements
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (text.length < 30) return;

    // Deduplicate by text fingerprint
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

    const imageAlts = $el.find("img")
      .map((_, img) => $(img).attr("alt") ?? "")
      .get()
      .filter(t => t.length > 0);

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
      image_alts: imageAlts.slice(0, 6),
    });
  });

  return sections;
}

function extractNavLinks(html: string, baseUrl: URL): string[] {
  const $ = load(html);
  const links: string[] = [];

  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, baseUrl);
      if (url.hostname === baseUrl.hostname && !url.pathname.match(/\.(pdf|jpg|png|gif|css|js)$/i)) {
        links.push(url.href);
      }
    } catch {
      // ignore invalid hrefs
    }
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
  } catch {
    return null;
  }
}

export async function scrapeWebsite(rawUrl: string): Promise<ScrapeResult> {
  const baseUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);

  let homeHtml = await fetchPage(baseUrl.href);

  // Try www. prefix if bare domain failed
  if (!homeHtml && !baseUrl.hostname.startsWith("www.")) {
    const wwwUrl = new URL(baseUrl.href);
    wwwUrl.hostname = `www.${wwwUrl.hostname}`;
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

  const pages: ScrapedPage[] = [];

  // Home page
  pages.push({
    url: baseUrl.href,
    slug: "index",
    title: $("title").first().text().trim(),
    sections: extractSections(homeHtml),
  });

  // Follow nav links (up to 5 additional pages)
  const navLinks = extractNavLinks(homeHtml, baseUrl);
  const toVisit = navLinks
    .filter(l => l !== baseUrl.href && l !== baseUrl.href + "/")
    .slice(0, 5);

  await Promise.all(
    toVisit.map(async (link) => {
      const html = await fetchPage(link);
      if (!html) return;
      const u = new URL(link);
      const ld = load(html);
      pages.push({
        url: link,
        slug: slugFromPath(u.pathname),
        title: ld("title").first().text().trim(),
        sections: extractSections(html),
      });
    })
  );

  return { site_name, base_url: baseUrl.href, pages };
}
