import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, ExternalLink, Wand2, CheckCircle2, AlertTriangle, Loader2, MapPin, Phone, Search, X } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from "@pushpress/pushpress-ui";
import {
  getSites,
  createSite,
  generateSite,
  searchPlaces,
  getPlaceDetail,
  postQualitySignal,
  THEME_PRESETS,
  THEME_PRESET_LABELS,
  THEME_PRESET_DESCRIPTIONS,
  type Site,
  type ThemePreset,
  type ImportSummary,
  type PlaceSearchResult,
  type PlaceDetail,
} from "../api";

interface PageRatingItem {
  slug: string;
  label: string;
  aiCallId: string | null;
  rating: number | null;
}
import { useAuth } from "../context/AuthContext";

function SiteCard({ site }: { site: Site }) {
  const navigate = useNavigate();
  const isPublished = !!site.published_at;
  const siteUrl = `http://${site.slug}.localhost:3000`;

  return (
    <Card className="tw-flex tw-flex-col">
      <CardHeader className="tw-pb-2">
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
          <CardTitle className="tw-text-base tw-font-semibold tw-leading-tight">
            {site.name}
          </CardTitle>
          <Badge variant={isPublished ? "success" : "outline"} className="tw-shrink-0">
            {isPublished ? "Published" : "Draft"}
          </Badge>
        </div>
        <p className="tw-text-xs tw-text-muted-foreground tw-font-mono">
          {site.slug}
        </p>
      </CardHeader>

      <CardContent className="tw-flex-1">
        {isPublished && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-primary hover:tw-underline"
          >
            <Globe className="tw-h-3 tw-w-3" />
            {site.slug}.localhost:3000
            <ExternalLink className="tw-h-3 tw-w-3" />
          </a>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          className="tw-w-full"
          onClick={() => navigate(`/sites/${site.id}`)}
        >
          Manage site
        </Button>
      </CardFooter>
    </Card>
  );
}

type BuildMode = "import" | "generate";

function CreateSiteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<BuildMode>("import");
  const [theme, setTheme] = useState<ThemePreset>("bold");
  const [genName, setGenName] = useState("");
  const [genPrompt, setGenPrompt] = useState("");

  // GMB search state
  const [gmbQuery, setGmbQuery] = useState("");
  const [gmbResults, setGmbResults] = useState<PlaceSearchResult[]>([]);
  const [gmbSearching, setGmbSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetail | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const [manualUrl, setManualUrl] = useState(false);
  const [importUrlManual, setImportUrlManual] = useState("");
  const gmbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const pageSubstepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Import state
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [pageRatings, setPageRatings] = useState<PageRatingItem[]>([]);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [pendingSiteId, setPendingSiteId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // GMB website takes priority; manual input is fallback
  const importUrl = selectedPlace?.website || importUrlManual;

  function reset() {
    setMode("import");
    setTheme("bold");
    setGenName("");
    setGenPrompt("");
    setGmbQuery("");
    setGmbResults([]);
    setGmbSearching(false);
    setSelectedPlace(null);
    setLoadingPlace(false);
    setManualUrl(false);
    setImportUrlManual("");
    setImportLog([]);
    setImportSummary(null);
    setImportError(null);
    setIsImporting(false);
    setAiStatus(null);
    setPageRatings([]);
    setRatingSubmitted(false);
    setPendingSiteId(null);
  }

  // Cleanup substep interval on unmount
  useEffect(() => () => { if (pageSubstepRef.current) clearInterval(pageSubstepRef.current); }, []);

  // Debounced GMB search
  useEffect(() => {
    if (gmbDebounceRef.current) clearTimeout(gmbDebounceRef.current);
    if (!gmbQuery.trim() || selectedPlace) {
      setGmbResults([]);
      return;
    }
    gmbDebounceRef.current = setTimeout(async () => {
      setGmbSearching(true);
      try {
        const results = await searchPlaces(gmbQuery);
        setGmbResults(results);
      } catch {
        setGmbResults([]);
      } finally {
        setGmbSearching(false);
      }
    }, 400);
    return () => { if (gmbDebounceRef.current) clearTimeout(gmbDebounceRef.current); };
  }, [gmbQuery, selectedPlace]);

  async function handleSelectPlace(result: PlaceSearchResult) {
    setGmbResults([]);
    setGmbQuery(result.name);
    setLoadingPlace(true);
    try {
      const detail = await getPlaceDetail(result.id);
      setSelectedPlace(detail);
    } catch {
      setSelectedPlace({ ...result, city: null, state: null, zip: null, country: null, hours: null });
    } finally {
      setLoadingPlace(false);
    }
  }

  function handleSelectGenerate() {
    setMode("generate");
    setGmbQuery("");
    setGmbResults([]);
    setSelectedPlace(null);
  }

  function handleClose(open: boolean) {
    if (!open) {
      importAbortRef.current?.abort();
      reset();
    }
    onOpenChange(open);
  }

  function addLog(line: string) {
    setImportLog(prev => [...prev, line]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  async function runImport(siteId: string) {
    const token = localStorage.getItem("token");
    const controller = new AbortController();
    importAbortRef.current = controller;
    setIsImporting(true);
    setImportError(null);
    setImportLog([]);
    setPageRatings([]);
    setRatingSubmitted(false);

    const res = await fetch(`/api/sites/${siteId}/import-url`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        url: importUrl,
        theme_preset: theme,
        ...(selectedPlace ? {
          gmb_profile: {
            biz_name: selectedPlace.name,
            phone: selectedPlace.phone,
            address: selectedPlace.address,
            city: selectedPlace.city,
            state: selectedPlace.state,
            zip: selectedPlace.zip,
            country: selectedPlace.country ?? "US",
            website_url: selectedPlace.website,
            hours: selectedPlace.hours,
            gmb_rating: selectedPlace.rating,
            gmb_review_count: selectedPlace.reviewCount,
          },
        } : {}),
      }),
    });

    if (controller.signal.aborted) return null;

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "Unknown error");
      let message = text;
      try { message = JSON.parse(text)?.message ?? text; } catch {}
      setImportError(message);
      setIsImporting(false);
      return null;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalSite: Site | null = null;
    let finalSummary: ImportSummary | null = null;

    while (!controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const eventLine = part.match(/^event: (.+)$/m)?.[1];
        const dataLine = part.match(/^data: (.+)$/m)?.[1];
        if (!eventLine || !dataLine) continue;
        try {
          const data = JSON.parse(dataLine) as Record<string, unknown>;
          if (eventLine === "fetching") {
            addLog(`Fetching ${data.url as string}…`);
          } else if (eventLine === "discovered") {
            const urls = data.urls as string[];
            addLog(`Found ${urls.length} page${urls.length !== 1 ? "s" : ""}: ${urls.map(u => new URL(u).pathname).join(", ")}`);
          } else if (eventLine === "page_done") {
            addLog(`✓ ${data.title as string} — ${data.sections as number} section${(data.sections as number) !== 1 ? "s" : ""}`);
          } else if (eventLine === "page_failed") {
            addLog(`✗ Could not fetch ${data.url as string}`);
          } else if (eventLine === "brand_start") {
            setAiStatus("Extracting brand colors and logo…");
          } else if (eventLine === "brand_done") {
            setAiStatus(null);
            const primary = data.primary as string | null;
            const logo = data.logo as boolean;
            const font = data.heading_font as string | null;
            const parts = [];
            if (primary) parts.push(`brand color ${primary}`);
            if (font) parts.push(`${font} font`);
            if (logo) parts.push("logo");
            addLog(`✓ Brand kit — ${parts.length ? parts.join(", ") : "defaults applied"}`);
          } else if (eventLine === "images_start") {
            setAiStatus("Downloading site images…");
          } else if (eventLine === "images_done") {
            setAiStatus(null);
            const count = data.count as number;
            addLog(`✓ Images — ${count} downloaded`);
          } else if (eventLine === "ai_start") {
            const pages = data.pages as number;
            addLog(`─── Building ${pages} page${pages !== 1 ? "s" : ""} with AI ───`);
          } else if (eventLine === "ai_page_start") {
            const pageLabel = data.label as string;
            const substeps = ["mapping sections", "writing copy", "choosing layouts", "assigning images", "finalizing"];
            let substepIdx = 0;
            if (pageSubstepRef.current) clearInterval(pageSubstepRef.current);
            setAiStatus(`Creating ${pageLabel}… ${substeps[0]}`);
            pageSubstepRef.current = setInterval(() => {
              substepIdx = (substepIdx + 1) % substeps.length;
              setAiStatus(`Creating ${pageLabel}… ${substeps[substepIdx]}`);
            }, 4000);
          } else if (eventLine === "ai_page_done") {
            if (pageSubstepRef.current) { clearInterval(pageSubstepRef.current); pageSubstepRef.current = null; }
            const pageLabel = data.label as string;
            const pageSlug = data.slug as string;
            const aiCallId = (data.aiCallId as string | null) ?? null;
            addLog(`✓ ${pageLabel} — ${data.blocks as number} block${(data.blocks as number) !== 1 ? "s" : ""}`);
            setAiStatus(null);
            setPageRatings(prev => [...prev, { slug: pageSlug, label: pageLabel, aiCallId, rating: null }]);
          } else if (eventLine === "complete") {
            if (pageSubstepRef.current) { clearInterval(pageSubstepRef.current); pageSubstepRef.current = null; }
            setAiStatus(null);
            finalSite = data.site as Site;
            finalSummary = data.summary as ImportSummary;
            setPendingSiteId((data.site as Site).id);
          } else if (eventLine === "error") {
            if (pageSubstepRef.current) { clearInterval(pageSubstepRef.current); pageSubstepRef.current = null; }
            setAiStatus(null);
            setImportError(data.message as string);
            setIsImporting(false);
            return null;
          }
        } catch (e) {
          console.warn("Failed to parse SSE event:", part, e);
        }
      }
    }

    setIsImporting(false);
    return finalSite && finalSummary ? { site: finalSite, summary: finalSummary } : null;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (mode === "generate") {
        const site = await createSite({ name: genName.trim() });
        const generated = await generateSite(site.id, { prompt: genPrompt, theme_preset: theme });
        return { site: generated, summary: null, created: site };
      }
      const name = selectedPlace?.name ?? importUrlManual;
      const site = await createSite({ name });
      const result = await runImport(site.id);
      return { site: result?.site ?? site, summary: result?.summary ?? null, created: site };
    },
    onSuccess: ({ site, summary, created }) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      if (summary) {
        setImportSummary(summary);
        // If we have pages to rate, stay open for rating — user dismisses manually
        // If no pages collected (shouldn't happen), fall back to auto-close
        if (pageRatings.length === 0) {
          setTimeout(() => {
            handleClose(false);
            navigate(`/sites/${site.id}`);
          }, 3000);
        }
      } else {
        handleClose(false);
        navigate(`/sites/${created.id}`);
      }
    },
    onError: (err: Error) => {
      setImportError(err.message);
      setIsImporting(false);
    },
  });

  const isPending = createMutation.isPending || isImporting;
  const canSubmit = mode === "generate"
    ? genName.trim().length > 0 && genPrompt.trim().length > 0
    : importUrl.trim().length > 0;
  const isScanning = isPending && mode === "import";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="tw-max-w-lg">
        <DialogHeader>
          <DialogTitle>Build your website</DialogTitle>
        </DialogHeader>

        <div className="tw-space-y-4">
          {/* ── GMB search (import mode, no selection yet) ── */}
          {mode === "import" && !selectedPlace && !loadingPlace && !isScanning && !importSummary && (
            <div className="tw-space-y-2">
              <Label htmlFor="gmb-search">Find your business on Google</Label>
              <div className="tw-relative">
                <Search className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-h-4 tw-w-4 tw-text-muted-foreground tw-pointer-events-none" />
                <Input
                  id="gmb-search"
                  placeholder="Iron Peak CrossFit Denver"
                  value={gmbQuery}
                  onChange={(e) => { setGmbQuery(e.target.value); setGmbResults([]); }}
                  className="tw-pl-9"
                  autoFocus
                  disabled={isPending}
                />
                {gmbSearching && (
                  <Loader2 className="tw-absolute tw-right-3 tw-top-1/2 -tw-translate-y-1/2 tw-h-4 tw-w-4 tw-animate-spin tw-text-muted-foreground" />
                )}
              </div>

              {/* Inline scrollable results — ~3 items visible, generate always last */}
              <div
                className="tw-rounded-lg tw-border tw-border-border tw-divide-y tw-divide-border tw-overflow-y-auto"
                style={{ maxHeight: "195px" }}
              >
                {gmbResults.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectPlace(r)}
                    className="tw-w-full tw-text-left tw-px-3 tw-py-3 tw-bg-background hover:tw-bg-muted tw-transition-colors"
                  >
                    <p className="tw-text-sm tw-font-medium tw-text-foreground">{r.name}</p>
                    <p className="tw-text-xs tw-text-muted-foreground tw-truncate">{r.address}</p>
                    {!r.website && (
                      <p className="tw-text-xs tw-text-warning tw-mt-0.5">No website listed</p>
                    )}
                  </button>
                ))}
                {/* Always last */}
                <button
                  type="button"
                  onClick={handleSelectGenerate}
                  className="tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-3 tw-text-left tw-bg-background hover:tw-bg-muted tw-transition-colors"
                >
                  <Wand2 className="tw-h-4 tw-w-4 tw-shrink-0 tw-text-muted-foreground" />
                  <div>
                    <p className="tw-text-sm tw-font-medium tw-text-foreground">Generate website using AI</p>
                    <p className="tw-text-xs tw-text-muted-foreground">Describe your business and let AI build your site</p>
                  </div>
                </button>
              </div>

              {/* Manual URL fallback */}
              <button
                type="button"
                onClick={() => setManualUrl(v => !v)}
                className="tw-text-xs tw-text-muted-foreground hover:tw-text-foreground tw-underline tw-underline-offset-2"
              >
                {manualUrl ? "Hide manual URL" : "Enter website URL manually instead"}
              </button>
              {manualUrl && (
                <Input
                  type="url"
                  placeholder="https://yourgym.com"
                  value={importUrlManual}
                  onChange={(e) => { setImportUrlManual(e.target.value); setImportError(null); }}
                  disabled={isPending}
                />
              )}
            </div>
          )}

          {/* ── Loading place ── */}
          {loadingPlace && (
            <div className="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-rounded-lg tw-bg-muted">
              <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin tw-text-muted-foreground" />
              <p className="tw-text-sm tw-text-muted-foreground">Loading business details…</p>
            </div>
          )}

          {/* ── Selected business card ── */}
          {mode === "import" && selectedPlace && !loadingPlace && !isScanning && !importSummary && (
            <div className="tw-rounded-lg tw-border tw-border-border tw-p-3 tw-space-y-2">
              <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                <div>
                  <p className="tw-text-sm tw-font-semibold tw-text-foreground">{selectedPlace.name}</p>
                  {selectedPlace.rating && (
                    <p className="tw-text-xs tw-text-muted-foreground">★ {selectedPlace.rating.toFixed(1)} on Google</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPlace(null); setGmbQuery(""); setGmbResults([]); }}
                  className="tw-text-muted-foreground hover:tw-text-foreground"
                >
                  <X className="tw-h-4 tw-w-4" />
                </button>
              </div>
              {selectedPlace.address && (
                <div className="tw-flex tw-items-start tw-gap-1.5">
                  <MapPin className="tw-h-3.5 tw-w-3.5 tw-text-muted-foreground tw-shrink-0 tw-mt-0.5" />
                  <p className="tw-text-xs tw-text-muted-foreground">{selectedPlace.address}</p>
                </div>
              )}
              {selectedPlace.phone && (
                <div className="tw-flex tw-items-center tw-gap-1.5">
                  <Phone className="tw-h-3.5 tw-w-3.5 tw-text-muted-foreground tw-shrink-0" />
                  <p className="tw-text-xs tw-text-muted-foreground">{selectedPlace.phone}</p>
                </div>
              )}
              {selectedPlace.website ? (
                <div className="tw-flex tw-items-center tw-gap-1.5">
                  <Globe className="tw-h-3.5 tw-w-3.5 tw-text-muted-foreground tw-shrink-0" />
                  <p className="tw-text-xs tw-text-primary tw-truncate">{selectedPlace.website}</p>
                </div>
              ) : (
                <div className="tw-space-y-1">
                  <p className="tw-text-xs tw-text-warning">No website found on Google — enter it manually:</p>
                  <Input
                    type="url"
                    placeholder="https://yourgym.com"
                    value={importUrlManual}
                    onChange={(e) => { setImportUrlManual(e.target.value); setImportError(null); }}
                    disabled={isPending}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Generate with AI form ── */}
          {mode === "generate" && !isScanning && (
            <div className="tw-space-y-3">
              <div className="tw-space-y-1.5">
                <Label htmlFor="gen-name">Business name</Label>
                <Input
                  id="gen-name"
                  placeholder="Iron Peak CrossFit"
                  value={genName}
                  onChange={(e) => setGenName(e.target.value)}
                  autoFocus
                  disabled={isPending}
                />
              </div>
              <div className="tw-space-y-1.5">
                <Label htmlFor="gen-prompt">Describe your business</Label>
                <textarea
                  id="gen-prompt"
                  placeholder="CrossFit gym in Denver. We offer daily WOD classes, personal training, and open gym…"
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  rows={3}
                  disabled={isPending}
                  className="tw-w-full tw-rounded-md tw-border tw-border-border tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-foreground tw-placeholder-muted-foreground tw-resize-none focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-foreground/20 disabled:tw-opacity-50"
                />
              </div>
            </div>
          )}

          {/* ── Theme picker — shown once a business is selected or in generate mode ── */}
          {!isScanning && !importSummary && (mode === "generate" || importUrl.trim().length > 0) && (
            <div className="tw-space-y-1.5">
              <Label>Theme</Label>
              <div className="tw-grid tw-grid-cols-2 tw-gap-2">
                {THEME_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isPending}
                    onClick={() => setTheme(preset)}
                    className={`tw-flex tw-flex-col tw-items-start tw-gap-0.5 tw-px-3 tw-py-2 tw-rounded-lg tw-text-left tw-border tw-transition-all ${
                      theme === preset
                        ? "tw-border-foreground tw-bg-foreground tw-text-background"
                        : "tw-border-border tw-text-foreground hover:tw-border-foreground/50"
                    }`}
                  >
                    <span className="tw-text-xs tw-font-medium">{THEME_PRESET_LABELS[preset]}</span>
                    <span className={`tw-text-xs ${theme === preset ? "tw-text-background/70" : "tw-text-muted-foreground"}`}>
                      {THEME_PRESET_DESCRIPTIONS[preset]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Scanning progress ── */}
          {isScanning && importLog.length === 0 && (
            <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-bg-muted tw-p-3">
              <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin tw-shrink-0 tw-text-muted-foreground" />
              <p className="tw-text-sm tw-text-muted-foreground">Starting scan…</p>
            </div>
          )}
          {importLog.length > 0 && (
            <div className="tw-rounded-lg tw-bg-muted tw-p-3 tw-space-y-1 tw-max-h-44 tw-overflow-y-auto">
              {importLog.map((line, i) => (
                <p key={i} className={`tw-text-xs tw-font-mono tw-leading-relaxed ${line.startsWith("───") ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                  {line}
                </p>
              ))}
              {aiStatus && (
                <div className="tw-flex tw-items-center tw-gap-1.5 tw-pt-0.5">
                  <Loader2 className="tw-h-3 tw-w-3 tw-animate-spin tw-shrink-0 tw-text-muted-foreground" />
                  <p className="tw-text-xs tw-font-mono tw-text-muted-foreground">{aiStatus}</p>
                </div>
              )}
              {isScanning && !aiStatus && (
                <div className="tw-flex tw-items-center tw-gap-1.5 tw-pt-0.5">
                  <Loader2 className="tw-h-3 tw-w-3 tw-animate-spin tw-shrink-0 tw-text-muted-foreground" />
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          )}

          {/* ── Error ── */}
          {importError && (
            <p className="tw-text-sm tw-text-error">{importError}</p>
          )}

          {/* ── Import success + rating ── */}
          {importSummary && (
            <div className="tw-space-y-3">
              <div className="tw-rounded-lg tw-border tw-border-border tw-p-3 tw-space-y-2">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <CheckCircle2 className="tw-h-4 tw-w-4 tw-text-success tw-shrink-0" />
                  <p className="tw-text-sm tw-font-medium">
                    Imported {importSummary.pages_generated} pages · {importSummary.blocks_generated} blocks
                  </p>
                </div>
                {importSummary.gaps.length > 0 && (
                  <div className="tw-rounded tw-bg-warning/10 tw-border tw-border-warning/20 tw-p-2.5 tw-space-y-1">
                    <div className="tw-flex tw-items-center tw-gap-1.5">
                      <AlertTriangle className="tw-h-3.5 tw-w-3.5 tw-text-warning tw-shrink-0" />
                      <p className="tw-text-xs tw-font-medium tw-text-warning">
                        {importSummary.gaps.length} section{importSummary.gaps.length > 1 ? "s" : ""} couldn&apos;t be fully mapped
                      </p>
                    </div>
                    <ul className="tw-space-y-0.5">
                      {importSummary.gaps.map((gap, i) => (
                        <li key={i} className="tw-text-xs tw-text-muted-foreground">• {gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {!ratingSubmitted && pageRatings.length > 0 && (
                <div className="tw-rounded-lg tw-border tw-border-border tw-p-3 tw-space-y-2">
                  <p className="tw-text-xs tw-font-medium tw-text-foreground">How well did the AI capture each page? (helps us improve)</p>
                  {pageRatings.map((item) => (
                    <div key={item.slug} className="tw-flex tw-items-center tw-justify-between">
                      <span className="tw-text-xs tw-text-muted-foreground">{item.label}</span>
                      <div className="tw-flex tw-gap-0.5">
                        {[1,2,3,4,5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setPageRatings(prev => prev.map(p => p.slug === item.slug ? { ...p, rating: star } : p))}
                            className={`tw-text-lg tw-leading-none tw-transition-colors ${(item.rating ?? 0) >= star ? "tw-text-yellow-400" : "tw-text-muted-foreground/30 hover:tw-text-yellow-300"}`}
                          >★</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="tw-flex tw-gap-2 tw-pt-1">
                    <Button size="sm" variant="outline" type="button"
                      onClick={() => { setRatingSubmitted(true); if (pendingSiteId) { handleClose(false); navigate(`/sites/${pendingSiteId}`); } }}
                    >
                      Skip
                    </Button>
                    <Button size="sm" type="button"
                      disabled={pageRatings.every(p => p.rating === null)}
                      onClick={async () => {
                        if (!pendingSiteId) return;
                        await Promise.allSettled(
                          pageRatings.filter(p => p.rating !== null).map(p =>
                            postQualitySignal(pendingSiteId, { ai_call_id: p.aiCallId, page_slug: p.slug, action: "rated", rating: p.rating! })
                          )
                        );
                        setRatingSubmitted(true);
                        handleClose(false);
                        navigate(`/sites/${pendingSiteId}`);
                      }}
                    >
                      Submit rating
                    </Button>
                  </div>
                </div>
              )}

              {(ratingSubmitted || pageRatings.length === 0) && (
                <Button size="sm" type="button"
                  onClick={() => { handleClose(false); if (pendingSiteId) navigate(`/sites/${pendingSiteId}`); }}
                >
                  Open site editor
                </Button>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          {!importSummary && (
            <div className="tw-flex tw-items-center tw-justify-between tw-pt-1">
              {mode === "generate" ? (
                <Button type="button" variant="ghost" size="sm" disabled={isPending}
                  onClick={() => { setMode("import"); setGenName(""); setGenPrompt(""); }}
                >
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button
                disabled={!canSubmit || isPending}
                isSubmitting={isPending}
                onClick={() => createMutation.mutate()}
              >
                {mode === "import" ? "Create & import" : "Generate site"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: getSites,
  });

  return (
    <div className="tw-max-w-5xl">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <div>
          <h1 className="tw-text-2xl tw-font-semibold tw-text-foreground">
            {user?.name ? `${user.name.split(" ")[0]}'s sites` : "Your sites"}
          </h1>
          <p className="tw-text-sm tw-text-muted-foreground tw-mt-0.5">
            Build an AI-generated site and get a live URL instantly.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="tw-h-4 tw-w-4 tw-mr-1.5" />
          New site
        </Button>
      </div>

      {isLoading ? (
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="tw-h-5 tw-w-32" />
                <Skeleton className="tw-h-3 tw-w-20 tw-mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="tw-h-3 tw-w-40" />
              </CardContent>
              <CardFooter>
                <Skeleton className="tw-h-8 tw-w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : sites?.length === 0 ? (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-dashed tw-border-border tw-py-16 tw-text-center">
          <Globe className="tw-h-10 tw-w-10 tw-text-muted-foreground tw-mb-3" />
          <h3 className="tw-font-medium tw-text-foreground">No sites yet</h3>
          <p className="tw-text-sm tw-text-muted-foreground tw-mt-1 tw-mb-4">
            Create your first site to get started.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="tw-h-4 tw-w-4 tw-mr-1.5" />
            Create your first site
          </Button>
        </div>
      ) : (
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
          {sites?.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}

      <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
