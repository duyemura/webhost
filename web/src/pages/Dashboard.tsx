import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, ExternalLink, Wand2, Import, FileEdit, CheckCircle2, AlertTriangle } from "lucide-react";
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
  importFromUrl,
  slugify,
  THEME_PRESETS,
  THEME_PRESET_COLORS,
  THEME_PRESET_LABELS,
  type Site,
  type ThemePreset,
  type ImportSummary,
} from "../api";
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

type BuildMode = "generate" | "import" | "blank";

function CreateSiteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Step 1: name/slug
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");

  // Step 2: build mode
  const [mode, setMode] = useState<BuildMode>("generate");
  const [importUrl, setImportUrl] = useState("");
  const [theme, setTheme] = useState<ThemePreset>("bold");

  // Import result
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const slug = customSlug || slugify(name);

  function reset() {
    setStep(1);
    setName("");
    setCustomSlug("");
    setMode("generate");
    setImportUrl("");
    setImportSummary(null);
    setImportError(null);
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  // Step 1 → 2
  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(2);
  }

  // Create blank site, then optionally import
  const createMutation = useMutation({
    mutationFn: async () => {
      const site = await createSite({ name, ...(customSlug ? { slug: customSlug } : {}) });
      if (mode === "import") {
        const result = await importFromUrl(site.id, { url: importUrl, theme_preset: theme });
        return { site: result, summary: result._import_summary };
      }
      return { site, summary: null };
    },
    onSuccess: ({ site, summary }) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      if (summary) {
        setImportSummary(summary);
        setImportError(null);
        // Show summary briefly, then navigate
        setTimeout(() => {
          handleClose(false);
          navigate(`/sites/${site.id}`);
        }, 3000);
      } else {
        handleClose(false);
        navigate(`/sites/${site.id}`);
      }
    },
    onError: (err: Error) => {
      if (mode === "import") setImportError(err.message);
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    (mode !== "import" || importUrl.trim().length > 0);

  const isScanning = createMutation.isPending && mode === "import";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="tw-max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Name your site" : "How do you want to build it?"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Name + slug */}
        {step === 1 && (
          <form onSubmit={handleNext} className="tw-space-y-4">
            <div className="tw-space-y-1.5">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                placeholder="My Gym Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="tw-space-y-1.5">
              <Label htmlFor="site-slug">
                Slug{" "}
                <span className="tw-text-muted-foreground tw-font-normal">(optional)</span>
              </Label>
              <Input
                id="site-slug"
                placeholder={slug || "auto-generated"}
                value={customSlug}
                onChange={(e) => setCustomSlug(slugify(e.target.value))}
              />
              {slug && (
                <p className="tw-text-xs tw-text-muted-foreground">
                  Your site will be at{" "}
                  <span className="tw-font-mono tw-text-foreground">{slug}.localhost:3000</span>
                </p>
              )}
            </div>
            <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-1">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                Next
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Build mode */}
        {step === 2 && (
          <div className="tw-space-y-4">
            {/* Mode picker */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-2">
              {(
                [
                  { id: "generate", icon: Wand2, label: "Generate with AI", desc: "Describe your business" },
                  { id: "import", icon: Import, label: "Import existing site", desc: "Scan my current website" },
                  { id: "blank", icon: FileEdit, label: "Start blank", desc: "Use the block editor" },
                ] as { id: BuildMode; icon: React.ElementType; label: string; desc: string }[]
              ).map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`tw-flex tw-flex-col tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-p-3 tw-text-center tw-transition-all ${
                    mode === id
                      ? "tw-border-foreground tw-bg-foreground/5"
                      : "tw-border-border hover:tw-border-foreground/40"
                  }`}
                >
                  <Icon className={`tw-h-5 tw-w-5 ${mode === id ? "tw-text-foreground" : "tw-text-muted-foreground"}`} />
                  <p className={`tw-text-xs tw-font-medium tw-leading-tight ${mode === id ? "tw-text-foreground" : "tw-text-muted-foreground"}`}>
                    {label}
                  </p>
                  <p className="tw-text-xs tw-text-muted-foreground tw-leading-tight">{desc}</p>
                </button>
              ))}
            </div>

            {/* Import fields */}
            {mode === "import" && (
              <div className="tw-space-y-3">
                <div className="tw-space-y-1.5">
                  <Label htmlFor="import-url">Current website URL</Label>
                  <Input
                    id="import-url"
                    type="url"
                    placeholder="https://yourgym.com"
                    value={importUrl}
                    onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }}
                    disabled={isScanning || !!importSummary}
                  />
                  <p className="tw-text-xs tw-text-muted-foreground">
                    We'll scan every page and rebuild the structure as editable blocks.
                  </p>
                </div>
                <div className="tw-space-y-1.5">
                  <Label>Theme</Label>
                  <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {THEME_PRESETS.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        disabled={isScanning || !!importSummary}
                        onClick={() => setTheme(preset)}
                        className={`tw-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-full tw-text-xs tw-font-medium tw-border tw-transition-all ${
                          theme === preset
                            ? "tw-border-foreground tw-bg-foreground tw-text-background"
                            : "tw-border-border tw-text-foreground hover:tw-border-foreground/50"
                        }`}
                      >
                        <span className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-shrink-0" style={{ background: THEME_PRESET_COLORS[preset] }} />
                        {THEME_PRESET_LABELS[preset]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Scanning progress */}
            {isScanning && (
              <div className="tw-rounded-lg tw-bg-muted tw-p-3 tw-space-y-1">
                <p className="tw-text-sm tw-font-medium">Scanning your site…</p>
                <p className="tw-text-xs tw-text-muted-foreground">Fetching pages, extracting content, mapping to blocks. Usually 20–40 seconds.</p>
              </div>
            )}

            {/* Import error */}
            {importError && (
              <p className="tw-text-sm tw-text-error">{importError}</p>
            )}

            {/* Import success summary */}
            {importSummary && (
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
                        {importSummary.gaps.length} section{importSummary.gaps.length > 1 ? "s" : ""} couldn't be fully mapped
                      </p>
                    </div>
                    <ul className="tw-space-y-0.5">
                      {importSummary.gaps.map((gap, i) => (
                        <li key={i} className="tw-text-xs tw-text-muted-foreground">• {gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="tw-text-xs tw-text-muted-foreground">Opening your site editor…</p>
              </div>
            )}

            {!importSummary && (
              <div className="tw-flex tw-items-center tw-justify-between tw-pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} disabled={createMutation.isPending}>
                  Back
                </Button>
                <Button
                  disabled={!canSubmit || createMutation.isPending}
                  isSubmitting={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {mode === "import" ? "Create & import" : mode === "generate" ? "Create site" : "Create site"}
                </Button>
              </div>
            )}
          </div>
        )}
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
