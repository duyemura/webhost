import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Trash2,
  CheckCheck,
  Plus,
  Code2,
  Globe,
  X,
  PanelRight,
  RotateCcw,
  ArrowLeft,
  Monitor,
  Smartphone,
  Loader2,
  CheckCircle2,
  Wand2,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Badge,
  Skeleton,
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Switch,
  Input,
  Label,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@pushpress/pushpress-ui";
import { useSetHeader } from "../components/AppLayout";
import {
  getSite,
  deleteSite,
  updateSite,
  publishSite,
  getScripts,
  addScript,
  updateScript,
  deleteScript,
  getDomainStatus,
  getProfile,
  saveProfile,
  generateSite,
  THEME_PRESETS,
  THEME_PRESET_SWATCH,
  THEME_PRESET_LABELS,
  THEME_PRESET_DESCRIPTIONS,
  getTemplates,
  getTemplate,
  getPresets,
  type ThemePreset,
  type SiteScript,
  type BusinessProfile,
  type SiteSpec,
  type Theme,
  type ImportSummary,
  type Site,
  type BuildProgress,
  DEFAULT_THEME,
  updateSpec,
  updateTheme,
  rebuildPage,
  aiEditPage,
} from "../api";
import { BlockEditor } from "../components/editor/BlockEditor";
import { LivePreview } from "../components/editor/LivePreview";

const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const DOMAIN_STATUS_BADGE: Record<string, { label: string; variant: "warning" | "success" | "error" | "outline" }> = {
  pending: { label: "Pending DNS", variant: "warning" },
  active:  { label: "Active", variant: "success" },
  failed:  { label: "Failed", variant: "error" },
};

function CustomDomainSection({
  siteId,
  customDomain,
  domainStatus,
  cnameTarget,
}: {
  siteId: string;
  customDomain: string | null;
  domainStatus: string;
  cnameTarget: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!customDomain);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useQuery({
    queryKey: ["sites", siteId, "domain-status"],
    queryFn: () => getDomainStatus(siteId),
    enabled: !!customDomain && domainStatus === "pending",
    refetchInterval: 10_000,
    select: (data) => {
      if (data.status !== domainStatus) {
        queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (domain: string) => updateSite(siteId, { custom_domain: domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
      setEditing(false);
      setValue("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => updateSite(siteId, { custom_domain: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
      setEditing(true);
      setValue("");
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, "");
    if (!DOMAIN_RE.test(trimmed)) {
      setError("Enter a valid domain like www.mygym.com.");
      return;
    }
    setError(null);
    saveMutation.mutate(trimmed);
  }

  function copyCname() {
    navigator.clipboard.writeText(cnameTarget);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusBadge = customDomain ? DOMAIN_STATUS_BADGE[domainStatus] : null;

  return (
    <div>
      <h2 className="tw-text-base tw-font-semibold tw-text-foreground tw-mb-1">
        Custom domain
      </h2>

      {customDomain ? (
        <div className="tw-space-y-3">
          <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-border tw-bg-muted tw-px-3 tw-py-2">
            <Globe className="tw-h-4 tw-w-4 tw-text-muted-foreground tw-shrink-0" />
            <span className="tw-flex-1 tw-font-mono tw-text-sm tw-text-foreground">
              {customDomain}
            </span>
            {statusBadge && (
              <Badge variant={statusBadge.variant} className="tw-shrink-0">
                {statusBadge.label}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              title="Remove custom domain"
            >
              <X className="tw-h-4 tw-w-4" />
            </Button>
          </div>

          {domainStatus !== "active" && (
            <div className="tw-rounded-lg tw-border tw-border-border tw-p-3 tw-space-y-2">
              <p className="tw-text-xs tw-font-medium tw-text-foreground">
                Add this DNS record at your registrar:
              </p>
              <div className="tw-grid tw-grid-cols-[auto_auto_1fr_auto] tw-gap-x-4 tw-gap-y-1 tw-items-center">
                <span className="tw-text-xs tw-font-medium tw-text-muted-foreground">Type</span>
                <span className="tw-text-xs tw-font-medium tw-text-muted-foreground">Name</span>
                <span className="tw-text-xs tw-font-medium tw-text-muted-foreground">Value</span>
                <span />
                <span className="tw-text-xs tw-font-mono tw-text-foreground">CNAME</span>
                <span className="tw-text-xs tw-font-mono tw-text-foreground">
                  {customDomain.split(".").slice(0, -2).join(".") || "@"}
                </span>
                <span className="tw-text-xs tw-font-mono tw-text-foreground tw-truncate">
                  {cnameTarget}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={copyCname} title="Copy value">
                  {copied
                    ? <CheckCheck className="tw-h-3.5 tw-w-3.5 tw-text-success" />
                    : <Copy className="tw-h-3.5 tw-w-3.5" />
                  }
                </Button>
              </div>
              <p className="tw-text-xs tw-text-muted-foreground">
                DNS changes can take up to 48 hours to propagate.
              </p>
            </div>
          )}

          {domainStatus === "failed" && (
            <p className="tw-text-xs tw-text-error">
              SSL provisioning failed. Remove the domain and try again, or check your DNS settings.
            </p>
          )}
        </div>
      ) : editing ? (
        <form onSubmit={handleSave} className="tw-flex tw-gap-2">
          <Input
            placeholder="www.mygym.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="tw-flex-1 tw-font-mono"
          />
          <Button type="submit" isSubmitting={saveMutation.isPending}>
            Set domain
          </Button>
        </form>
      ) : null}

      {error && (
        <p className="tw-text-sm tw-text-error tw-mt-2">{error}</p>
      )}
    </div>
  );
}

// Registry of known script presets — must stay in sync with the backend registry
const SCRIPT_PRESETS = [
  { type: "gtm", label: "Google Tag Manager", placeholder: "GTM-XXXXXX" },
  { type: "ga4", label: "Google Analytics (GA4)", placeholder: "G-XXXXXXXXXX" },
  { type: "meta_pixel", label: "Meta Pixel", placeholder: "Pixel ID (15–16 digits)" },
  { type: "pushpress", label: "PushPress", placeholder: "Your PushPress company key" },
  { type: "custom", label: "Custom code", placeholder: "" },
] as const;

const PRESET_BADGES: Record<string, string> = {
  gtm: "GTM",
  ga4: "GA4",
  meta_pixel: "Meta",
  pushpress: "PushPress",
  custom: "Custom",
};

function ScriptRow({
  script,
  siteId,
  onChanged,
}: {
  script: SiteScript;
  siteId: string;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateScript(siteId, script.id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] });
      onChanged?.();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteScript(siteId, script.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] });
      onChanged?.();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] });
    },
  });

  return (
    <div className="tw-flex tw-items-center tw-gap-3 tw-py-3 tw-border-b tw-border-border last:tw-border-0">
      <Badge variant="outline" className="tw-shrink-0 tw-font-mono tw-text-xs">
        {PRESET_BADGES[script.type] ?? script.type}
      </Badge>
      <div className="tw-flex-1 tw-min-w-0">
        <p className="tw-text-sm tw-font-medium tw-text-foreground tw-truncate">{script.label}</p>
        {script.tracking_id && (
          <p className="tw-text-xs tw-font-mono tw-text-muted-foreground tw-truncate">
            {script.tracking_id}
          </p>
        )}
        {script.type === "custom" && (
          <p className="tw-text-xs tw-text-muted-foreground">Custom code</p>
        )}
      </div>
      <Switch
        checked={script.enabled}
        onCheckedChange={(enabled) => toggleMutation.mutate(enabled)}
        disabled={toggleMutation.isPending}
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="tw-shrink-0 tw-text-muted-foreground hover:tw-text-error"
          >
            <Trash2 className="tw-h-4 tw-w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Remove script?</AlertDialogTitle>
          <AlertDialogDescription>
            "{script.label}" will be removed from your site immediately.
          </AlertDialogDescription>
          <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              isSubmitting={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Remove script
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddScriptDialog({
  siteId,
  open,
  onClose,
  onAdded,
}: {
  siteId: string;
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const preset = SCRIPT_PRESETS.find((p) => p.type === selectedType);

  const mutation = useMutation({
    mutationFn: () =>
      addScript(siteId, {
        type: selectedType!,
        label: preset!.label,
        ...(selectedType === "custom" ? { code: customCode } : { tracking_id: trackingId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] });
      onAdded?.();
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleClose() {
    setSelectedType(null);
    setTrackingId("");
    setCustomCode("");
    setError(null);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType) return;
    if (selectedType === "custom" && !customCode.trim()) {
      setError("Paste your script code above.");
      return;
    }
    if (selectedType !== "custom" && !trackingId.trim()) {
      setError("Enter a tracking ID.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a script</DialogTitle>
        </DialogHeader>

        {!selectedType ? (
          <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-mt-2">
            {SCRIPT_PRESETS.map((p) => (
              <button
                key={p.type}
                onClick={() => setSelectedType(p.type)}
                className="tw-flex tw-flex-col tw-items-start tw-gap-1 tw-rounded-lg tw-border tw-border-border tw-p-3 tw-text-left hover:tw-bg-muted tw-transition-colors"
              >
                <Badge variant="outline" className="tw-font-mono tw-text-xs">
                  {PRESET_BADGES[p.type]}
                </Badge>
                <span className="tw-text-sm tw-font-medium tw-text-foreground">{p.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="tw-space-y-4 tw-mt-2">
            <div className="tw-flex tw-items-center tw-gap-2">
              <Badge variant="outline" className="tw-font-mono tw-text-xs">
                {PRESET_BADGES[selectedType]}
              </Badge>
              <span className="tw-text-sm tw-font-medium tw-text-foreground">{preset?.label}</span>
              <button
                type="button"
                onClick={() => { setSelectedType(null); setError(null); }}
                className="tw-ml-auto tw-text-xs tw-text-muted-foreground hover:tw-text-foreground"
              >
                Change
              </button>
            </div>

            {selectedType === "custom" ? (
              <div className="tw-space-y-1.5">
                <Label htmlFor="custom-code">Script code</Label>
                <Textarea
                  id="custom-code"
                  placeholder={`<script>\n  // your code here\n</script>`}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="tw-font-mono tw-text-xs tw-min-h-32"
                />
              </div>
            ) : (
              <div className="tw-space-y-1.5">
                <Label htmlFor="tracking-id">Tracking ID</Label>
                <Input
                  id="tracking-id"
                  placeholder={preset?.placeholder}
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  className="tw-font-mono"
                />
              </div>
            )}

            {error && (
              <p className="tw-text-sm tw-text-error">{error}</p>
            )}

            <div className="tw-flex tw-justify-end tw-gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" isSubmitting={mutation.isPending}>
                Add script
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BusinessInfoSection({ siteId, onSaved }: { siteId: string; onSaved?: () => void }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["sites", siteId, "profile"],
    queryFn: () => getProfile(siteId),
  });

  const [form, setForm] = useState<BusinessProfile>({});
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    if (profile && !formReady) {
      setForm(profile);
      setFormReady(true);
    }
  }, [profile, formReady]);

  const mutation = useMutation({
    mutationFn: () => saveProfile(siteId, form),
    onSuccess: (data) => {
      queryClient.setQueryData(["sites", siteId, "profile"], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    },
    onError: () => {
      setSaved(false);
    },
  });

  function set(field: keyof BusinessProfile, value: string) {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (isLoading) return <Skeleton className="tw-h-40 tw-w-full" />;

  return (
    <div>
      <h2 className="tw-text-base tw-font-semibold tw-text-foreground tw-mb-1">
        Business info
      </h2>
      <p className="tw-text-sm tw-text-muted-foreground tw-mb-4">
        Used to inject structured data, OG tags, and a sitemap into your site automatically.
      </p>
      <form onSubmit={handleSubmit} className="tw-space-y-3">
        <div className="tw-grid tw-grid-cols-2 tw-gap-3">
          <div className="tw-col-span-2 tw-space-y-1.5">
            <Label htmlFor="biz-name">Business name</Label>
            <Input
              id="biz-name"
              value={form.biz_name ?? ""}
              onChange={(e) => set("biz_name", e.target.value)}
              placeholder="Ironworks CrossFit"
            />
          </div>
          <div className="tw-col-span-2 tw-space-y-1.5">
            <Label htmlFor="biz-description">Description</Label>
            <Textarea
              id="biz-description"
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Community CrossFit gym in Austin, TX…"
              className="tw-min-h-20"
            />
          </div>
          <div className="tw-space-y-1.5">
            <Label htmlFor="biz-phone">Phone</Label>
            <Input
              id="biz-phone"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="512-555-0192"
            />
          </div>
          <div className="tw-space-y-1.5">
            <Label htmlFor="biz-email">Email</Label>
            <Input
              id="biz-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="hello@mygym.com"
            />
          </div>
          <div className="tw-col-span-2 tw-space-y-1.5">
            <Label htmlFor="biz-address">Street address</Label>
            <Input
              id="biz-address"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="tw-space-y-1.5">
            <Label htmlFor="biz-city">City</Label>
            <Input
              id="biz-city"
              value={form.city ?? ""}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Austin"
            />
          </div>
          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            <div className="tw-space-y-1.5">
              <Label htmlFor="biz-state">State</Label>
              <Input
                id="biz-state"
                value={form.state ?? ""}
                onChange={(e) => set("state", e.target.value)}
                placeholder="TX"
              />
            </div>
            <div className="tw-space-y-1.5">
              <Label htmlFor="biz-zip">ZIP</Label>
              <Input
                id="biz-zip"
                value={form.zip ?? ""}
                onChange={(e) => set("zip", e.target.value)}
                placeholder="78701"
              />
            </div>
          </div>
          <div className="tw-col-span-2 tw-space-y-1.5">
            <Label htmlFor="biz-hours">Hours</Label>
            <Input
              id="biz-hours"
              value={form.hours ?? ""}
              onChange={(e) => set("hours", e.target.value)}
              placeholder="Mon–Fri 6am–8pm, Sat 9am–1pm"
            />
          </div>
        </div>
        <div className="tw-flex tw-items-center tw-justify-end tw-gap-3">
          {mutation.isError && (
            <span className="tw-text-sm tw-text-error">Save failed. Please try again.</span>
          )}
          {saved && (
            <span className="tw-text-sm tw-text-success">Saved.</span>
          )}
          <Button type="submit" isSubmitting={mutation.isPending}>
            Save info
          </Button>
        </div>
      </form>
    </div>
  );
}

interface AiGenerateSectionProps {
  siteId: string;
  hasSpec: boolean;
  spec: unknown;
  theme: unknown;
  themePreset: string | null;
  generationPrompt: string;
  canRebuildPages: boolean;
  genPrompt: string;
  setGenPrompt: (v: string) => void;
  genTheme: ThemePreset;
  setGenTheme: (v: ThemePreset) => void;
  genRegenOpen: boolean;
  setGenRegenOpen: (v: boolean) => void;
  isPending: boolean;
  error: string | null;
  onGenerate: () => void;
}

function GenerateForm({
  genPrompt, setGenPrompt, genTheme, setGenTheme, isPending, error, onGenerate,
}: Pick<AiGenerateSectionProps, "genPrompt" | "setGenPrompt" | "genTheme" | "setGenTheme" | "isPending" | "error" | "onGenerate">) {
  return (
    <div className="tw-space-y-4">
      <div>
        <Label htmlFor="gen-prompt" className="tw-text-sm tw-font-medium tw-mb-1.5 tw-block">
          Describe your site
        </Label>
        <Textarea
          id="gen-prompt"
          placeholder='e.g. "A bold CrossFit gym focused on community. Include pricing tiers ($99/mo unlimited, $149/mo unlimited + personal training), a free trial offer, and an FAQ."'
          value={genPrompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGenPrompt(e.target.value)}
          disabled={isPending}
          rows={5}
          className="tw-resize-none"
        />
      </div>
      <div>
        <p className="tw-text-sm tw-font-medium tw-mb-2">Theme</p>
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => setGenTheme(preset)}
              className={`tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-full tw-text-sm tw-font-medium tw-border tw-transition-all ${
                genTheme === preset
                  ? "tw-border-foreground tw-bg-foreground tw-text-background"
                  : "tw-border-border tw-text-foreground hover:tw-border-foreground/50"
              }`}
            >
              <span
                className="tw-w-3 tw-h-3 tw-rounded-full tw-shrink-0"
                style={{ background: THEME_PRESET_SWATCH[preset] }}
              />
              {THEME_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="tw-text-sm tw-text-error">{error}</p>
      )}
      <Button
        onClick={onGenerate}
        disabled={!genPrompt.trim()}
        isSubmitting={isPending}
        className="tw-w-full"
      >
        Generate site
      </Button>
    </div>
  );
}

function blockSummary(section: Record<string, unknown>): string {
  const headline =
    (section.headline as string | undefined) ??
    (section.name as string | undefined) ??
    (section.title as string | undefined);
  if (headline) return `${String(section.type)} — "${headline}"`;
  const items = section.items as unknown[] | undefined;
  if (Array.isArray(items)) return `${String(section.type)} — ${items.length} items`;
  const members = section.members as unknown[] | undefined;
  if (Array.isArray(members)) return `${String(section.type)} — ${members.length} members`;
  const images = section.images as unknown[] | undefined;
  if (Array.isArray(images)) return `${String(section.type)} — ${images.length} images`;
  return String(section.type);
}

function AiGenerateSection({
  siteId, hasSpec, spec, themePreset, generationPrompt, canRebuildPages,
  genPrompt, setGenPrompt, genTheme, setGenTheme,
  genRegenOpen, setGenRegenOpen,
  isPending, error, onGenerate,
}: AiGenerateSectionProps) {
  const queryClient = useQueryClient();
  const specData = spec as { version: number; pages: { slug: string; title: string; sections: Record<string, unknown>[] }[] } | null;
  const totalBlocks = specData?.pages.reduce((n, p) => n + p.sections.length, 0) ?? 0;
  const [rebuildingSlug, setRebuildingSlug] = useState<string | null>(null);
  const [pageRebuildError, setPageRebuildError] = useState<string | null>(null);

  async function handleRebuildPage(slug: string) {
    setRebuildingSlug(slug);
    setPageRebuildError(null);
    try {
      await rebuildPage(siteId, slug);
      await queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
    } catch (err) {
      setPageRebuildError((err as Error).message);
    } finally {
      setRebuildingSlug(null);
    }
  }

  // Prefill prompt from generation_prompt on mount
  const didPrefill = useRef(false);
  useEffect(() => {
    if (!didPrefill.current && generationPrompt && !genPrompt) {
      setGenPrompt(generationPrompt);
      didPrefill.current = true;
    }
  }, [generationPrompt, genPrompt, setGenPrompt]);

  if (!hasSpec) {
    return (
      <div className="tw-space-y-4">
        <div>
          <h2 className="tw-text-base tw-font-semibold">Generate your site with AI</h2>
          <p className="tw-text-sm tw-text-muted-foreground tw-mt-1">
            Describe your business and what you want. Claude will build a complete multi-page site instantly.
          </p>
        </div>
        <GenerateForm
          genPrompt={genPrompt} setGenPrompt={setGenPrompt}
          genTheme={genTheme} setGenTheme={setGenTheme}
          isPending={isPending} error={error} onGenerate={onGenerate}
        />
      </div>
    );
  }

  const presetName = (themePreset && THEME_PRESETS.includes(themePreset as ThemePreset))
    ? (themePreset as ThemePreset)
    : null;

  return (
    <div className="tw-space-y-4">
      <div className="tw-flex tw-items-center tw-justify-between">
        <div>
          <h2 className="tw-text-base tw-font-semibold tw-flex tw-items-center tw-gap-1.5">
            Generated site
            <Badge variant="success" className="tw-text-xs">
              {specData?.pages.length ?? 0} pages · {totalBlocks} blocks
            </Badge>
          </h2>
        </div>
      </div>

      {/* Block list per page */}
      <div className="tw-space-y-3">
        {specData?.pages.map(page => (
          <div key={page.slug} className="tw-space-y-1">
            <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
              <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-muted-foreground">
                {page.title}
              </p>
              {canRebuildPages && (
                <button
                  type="button"
                  title="Rebuild this page"
                  disabled={rebuildingSlug !== null}
                  onClick={() => handleRebuildPage(page.slug)}
                  className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-muted-foreground hover:tw-text-foreground tw-transition-colors disabled:tw-opacity-40 disabled:tw-cursor-not-allowed"
                >
                  {rebuildingSlug === page.slug
                    ? <Loader2 className="tw-h-3 tw-w-3 tw-animate-spin" />
                    : <RefreshCw className="tw-h-3 tw-w-3" />
                  }
                  <span>{rebuildingSlug === page.slug ? "Rebuilding…" : "Rebuild"}</span>
                </button>
              )}
            </div>
            <div className="tw-space-y-0.5">
              {page.sections.map(s => (
                <p key={String(s.id)} className="tw-text-sm tw-text-foreground tw-flex tw-items-center tw-gap-1.5">
                  <span className="tw-text-muted-foreground">·</span>
                  {blockSummary(s)}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      {pageRebuildError && (
        <p className="tw-text-xs tw-text-error">{pageRebuildError}</p>
      )}

      {/* Theme chip */}
      {presetName && (
        <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
          <span className="tw-text-muted-foreground">Theme:</span>
          <span className="tw-font-medium">{THEME_PRESET_LABELS[presetName]}</span>
        </div>
      )}

      {/* Regenerate accordion */}
      <div className="tw-border tw-border-border tw-rounded-lg tw-overflow-hidden">
        <button
          type="button"
          onClick={() => setGenRegenOpen(!genRegenOpen)}
          className="tw-w-full tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3 tw-text-sm tw-font-medium tw-text-foreground hover:tw-bg-muted/50 tw-transition-colors"
        >
          Regenerate
          <span className="tw-text-muted-foreground tw-text-lg tw-leading-none">{genRegenOpen ? "−" : "+"}</span>
        </button>
        {genRegenOpen && (
          <div className="tw-px-4 tw-pb-4 tw-border-t tw-border-border tw-pt-4">
            <GenerateForm
              genPrompt={genPrompt} setGenPrompt={setGenPrompt}
              genTheme={genTheme} setGenTheme={setGenTheme}
              isPending={isPending} error={error} onGenerate={onGenerate}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  slug?: string;
}

function PageAiChatSection({
  siteId,
  spec,
  onSiteUpdated,
}: {
  siteId: string;
  spec: { pages: { slug: string; title: string }[] };
  onSiteUpdated: (site: Site) => void;
}): React.ReactElement {
  const [selectedSlug, setSelectedSlug] = useState(spec.pages[0]?.slug ?? "index");
  const [instruction, setInstruction] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = instruction.trim();
    if (!trimmed || isPending) return;
    const page = spec.pages.find(p => p.slug === selectedSlug);
    const pageLabel = page?.title ?? selectedSlug;
    setMessages(prev => [...prev, { role: "user", content: trimmed, slug: selectedSlug }]);
    setInstruction("");
    setIsPending(true);
    setError(null);
    try {
      const updated = await aiEditPage(siteId, selectedSlug, trimmed);
      onSiteUpdated(updated);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Done — "${pageLabel}" updated. Check the preview to see your changes.`,
        slug: selectedSlug,
      }]);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${msg}`, slug: selectedSlug }]);
    } finally {
      setIsPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

  const pageLabel = spec.pages.find(p => p.slug === selectedSlug)?.title ?? selectedSlug;

  return (
    <div className="tw-space-y-3">
      <div>
        <h3 className="tw-text-sm tw-font-semibold">AI page editor</h3>
        <p className="tw-text-xs tw-text-muted-foreground tw-mt-0.5">
          Edit any page with natural language. Pinpoint ("change the hero headline to…") or broad ("rewrite to speak to beginners").
        </p>
      </div>

      {/* Page selector */}
      <div>
        <label className="tw-text-xs tw-font-medium tw-text-muted-foreground tw-block tw-mb-1">Page</label>
        <select
          value={selectedSlug}
          onChange={e => setSelectedSlug(e.target.value)}
          className="tw-w-full tw-rounded-md tw-border tw-border-border tw-bg-background tw-px-3 tw-py-1.5 tw-text-sm tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-primary/30"
        >
          {spec.pages.map(p => (
            <option key={p.slug} value={p.slug}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Chat history */}
      {messages.length > 0 && (
        <div className="tw-rounded-lg tw-border tw-border-border tw-bg-muted/30 tw-p-3 tw-space-y-3 tw-max-h-64 tw-overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`tw-flex tw-gap-2 ${msg.role === "user" ? "tw-justify-end" : "tw-justify-start"}`}>
              <div className={`tw-max-w-[85%] tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm ${
                msg.role === "user"
                  ? "tw-bg-primary tw-text-primary-foreground"
                  : "tw-bg-background tw-border tw-border-border tw-text-foreground"
              }`}>
                {msg.role === "user" && msg.slug && (
                  <span className="tw-block tw-text-xs tw-opacity-70 tw-mb-0.5">{spec.pages.find(p => p.slug === msg.slug)?.title ?? msg.slug}</span>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {isPending && (
            <div className="tw-flex tw-gap-2 tw-justify-start">
              <div className="tw-bg-background tw-border tw-border-border tw-rounded-lg tw-px-3 tw-py-2">
                <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin tw-text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="tw-space-y-2">
        <Textarea
          placeholder={`Edit "${pageLabel}" — e.g. "Change the hero headline to focus on beginners" or "Rewrite the pricing section to emphasize value"`}
          value={instruction}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={isPending}
          className="tw-resize-none"
        />
        {error && <p className="tw-text-xs tw-text-error">{error}</p>}
        <Button
          onClick={() => void handleSend()}
          disabled={!instruction.trim()}
          isSubmitting={isPending}
          className="tw-w-full"
          size="sm"
        >
          <Wand2 className="tw-h-3.5 tw-w-3.5 tw-mr-1.5" />
          {isPending ? "Editing…" : "Edit with AI"}
        </Button>
        <p className="tw-text-xs tw-text-muted-foreground tw-text-center">⌘↵ to send</p>
      </div>
    </div>
  );
}

function TemplatePickerEmptyState({
  siteId,
  onApplied,
}: {
  siteId: string;
  onApplied: () => void;
}): React.ReactElement {
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });

  const { data: presets } = useQuery({
    queryKey: ["presets"],
    queryFn: getPresets,
  });

  const applyMutation = useMutation({
    mutationFn: async ({ templateId, themePreset }: { templateId: string; themePreset: string }) => {
      const tpl = await getTemplate(templateId);
      const spec: SiteSpec = {
        version: 1,
        pages: [{ slug: "index", title: "Home", meta_description: "", sections: tpl.blocks as never[] }],
      };
      const theme = (presets?.[themePreset] ?? DEFAULT_THEME) as Theme;
      await updateSpec(siteId, spec);
      await updateTheme(siteId, theme, themePreset);
    },
    onSuccess: () => {
      onApplied();
    },
    onSettled: () => {
      // Always sync cache — spec may have been partially applied even on error
      queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
    },
  });

  if (isLoading) {
    return (
      <div className="tw-space-y-3 tw-py-4">
        <Skeleton className="tw-h-24 tw-w-full" />
        <Skeleton className="tw-h-24 tw-w-full" />
      </div>
    );
  }

  const applyingId = applyMutation.isPending ? applyMutation.variables?.templateId : null;
  const errorMessage = applyMutation.error instanceof Error
    ? applyMutation.error.message
    : applyMutation.error
      ? "Failed to apply template."
      : null;

  return (
    <div className="tw-space-y-4 tw-py-4">
      <div>
        <p className="tw-text-sm tw-font-medium tw-text-foreground">Start from a template</p>
        <p className="tw-text-xs tw-text-muted-foreground tw-mt-0.5">
          Load a pre-built layout and customize it in the editor, or generate with AI instead.
        </p>
      </div>
      <div className="tw-space-y-2">
        {templates?.map((tpl) => (
          <div
            key={tpl.id}
            className="tw-flex tw-items-start tw-gap-3 tw-rounded-lg tw-border tw-border-border tw-p-4"
          >
            <div className="tw-flex-1 tw-min-w-0">
              <p className="tw-text-sm tw-font-semibold tw-text-foreground">{tpl.name}</p>
              <p className="tw-text-xs tw-text-muted-foreground tw-mt-0.5 tw-leading-relaxed">
                {tpl.description}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyMutation.mutate({ templateId: tpl.id, themePreset: tpl.theme_preset })}
              isSubmitting={applyingId === tpl.id}
              disabled={applyMutation.isPending}
              className="tw-shrink-0"
            >
              Use template
            </Button>
          </div>
        ))}
      </div>
      {errorMessage && <p className="tw-text-sm tw-text-error">{errorMessage}</p>}
    </div>
  );
}

function UrlBar({ slug, customDomain }: { slug: string; customDomain: string | null }) {
  const [copied, setCopied] = useState(false);
  const primaryUrl = customDomain ? `https://${customDomain}` : `http://${slug}.localhost:3000`;
  const subdomainUrl = `http://${slug}.localhost:3000`;

  function copy() {
    navigator.clipboard.writeText(primaryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="tw-space-y-1.5">
      <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-border tw-bg-muted tw-px-3 tw-py-2">
        <span className="tw-flex-1 tw-font-mono tw-text-sm tw-text-foreground tw-truncate">
          {primaryUrl}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={copy} title="Copy URL">
          {copied ? (
            <CheckCheck className="tw-h-4 tw-w-4 tw-text-success" />
          ) : (
            <Copy className="tw-h-4 tw-w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon-sm" asChild title="Open site">
          <a href={subdomainUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="tw-h-4 tw-w-4" />
          </a>
        </Button>
      </div>
      {customDomain && (
        <p className="tw-text-xs tw-text-muted-foreground tw-px-1">
          Also available at{" "}
          <a
            href={subdomainUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tw-font-mono hover:tw-underline"
          >
            {slug}.localhost:3000
          </a>
        </p>
      )}
    </div>
  );
}

function BuildProgressPanel({ progress, error }: { progress: BuildProgress | null; error: string | null }) {
  const phase = progress?.phase;
  const phaseLabel = progress?.phase_label;
  const pages = progress?.pages ?? [];

  return (
    <div className="tw-rounded-lg tw-border tw-border-border tw-overflow-hidden">
      <div className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-bg-muted tw-border-b tw-border-border">
        <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin tw-shrink-0 tw-text-primary" />
        <p className="tw-text-xs tw-font-medium tw-text-foreground">
          {phase === "scraping" && "Scanning website"}
          {phase === "brand" && "Extracting brand"}
          {phase === "building" && `Building pages${phaseLabel ? ` — ${phaseLabel}` : ""}`}
          {!phase && "Starting…"}
        </p>
        {phaseLabel && phase !== "building" && (
          <p className="tw-text-xs tw-text-muted-foreground tw-truncate">{phaseLabel}</p>
        )}
      </div>
      {phase === "building" && pages.length > 0 && (
        <div className="tw-divide-y tw-divide-border tw-max-h-64 tw-overflow-y-auto">
          {pages.map((page) => (
            <div key={page.slug} className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2">
              {page.status === "done" && <CheckCircle2 className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-success" />}
              {page.status === "active" && <Loader2 className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-animate-spin tw-text-primary" />}
              {page.status === "pending" && <div className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-rounded-full tw-border tw-border-border" />}
              <div className="tw-min-w-0 tw-flex-1">
                <p className={`tw-text-xs tw-font-medium tw-truncate ${page.status === "pending" ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                  {page.label}
                </p>
                {page.status === "done" && page.blocks != null && (
                  <p className="tw-text-xs tw-text-muted-foreground">{page.blocks} block{page.blocks !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="tw-px-3 tw-py-2.5 tw-border-t tw-border-border">
          <p className="tw-text-xs tw-text-error">{error}</p>
        </div>
      )}
    </div>
  );
}

function extractImportUrl(generationPrompt: string | null): string {
  if (!generationPrompt) return "";
  const match = generationPrompt.match(/^Imported from (.+)$/);
  return match ? match[1].trim() : "";
}

function RebuildDialog({
  site,
  open,
  onOpenChange,
  onSuccess,
}: {
  site: Site;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(() => extractImportUrl(site.generation_prompt));
  const [theme, setTheme] = useState<ThemePreset>(
    (THEME_PRESETS.includes(site.theme_preset as ThemePreset) ? site.theme_preset : "bold") as ThemePreset
  );
  const [forceCrawl, setForceCrawl] = useState(false);

  const [importPhase, setImportPhase] = useState<"scraping" | "brand" | "building" | null>(null);
  const [importPhaseLabel, setImportPhaseLabel] = useState<string | null>(null);
  const [importPages, setImportPages] = useState<{ slug: string; label: string; status: "pending" | "active" | "done"; blocks?: number; substep?: string }[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const pageSubstepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pageSubstepRef.current) clearInterval(pageSubstepRef.current);
  }, []);

  function reset() {
    setUrl(extractImportUrl(site.generation_prompt));
    setTheme((THEME_PRESETS.includes(site.theme_preset as ThemePreset) ? site.theme_preset : "bold") as ThemePreset);
    setForceCrawl(false);
    setImportPhase(null);
    setImportPhaseLabel(null);
    setImportPages([]);
    setImportSummary(null);
    setImportError(null);
    setIsImporting(false);
  }

  function handleClose(open: boolean) {
    if (!open) {
      abortRef.current?.abort();
      reset();
    }
    onOpenChange(open);
  }

  async function runRebuild() {
    const token = localStorage.getItem("token");
    const controller = new AbortController();
    abortRef.current = controller;
    setIsImporting(true);
    setImportError(null);
    setImportPhase(null);
    setImportPhaseLabel(null);
    setImportPages([]);
    setImportSummary(null);

    const res = await fetch(`/api/sites/${site.id}/import-url`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url: url.trim(), theme_preset: theme, force_crawl: forceCrawl }),
    });

    if (controller.signal.aborted) return;

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "Unknown error");
      let message = text;
      try { message = JSON.parse(text)?.message ?? text; } catch {}
      setImportError(message);
      setIsImporting(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
          if (eventLine === "scrape_cached") {
            setImportPhase("scraping");
            try {
              const host = new URL(data.url as string).hostname;
              setImportPhaseLabel(`Using cached crawl — ${host}`);
            } catch {
              setImportPhaseLabel(`Using cached crawl (${data.pages as number} pages)`);
            }
          } else if (eventLine === "fetching") {
            setImportPhase("scraping");
            try { setImportPhaseLabel(`Scanning ${new URL(data.url as string).hostname}…`); } catch { setImportPhaseLabel("Scanning…"); }
          } else if (eventLine === "discovered") {
            const urls = data.urls as string[];
            setImportPhaseLabel(`Found ${urls.length} page${urls.length !== 1 ? "s" : ""} to scan`);
          } else if (eventLine === "page_done") {
            setImportPhaseLabel(`Scanned: ${data.title as string}`);
          } else if (eventLine === "brand_start") {
            setImportPhase("brand");
            setImportPhaseLabel("Extracting brand colors and logo…");
          } else if (eventLine === "brand_done") {
            const font = data.heading_font as string | null;
            const logo = data.logo as boolean;
            const parts2: string[] = [];
            if (data.primary) parts2.push(`${data.primary as string}`);
            if (font) parts2.push(font);
            if (logo) parts2.push("logo");
            setImportPhaseLabel(`Brand kit${parts2.length ? ` — ${parts2.join(", ")}` : ""}`);
          } else if (eventLine === "images_start") {
            setImportPhaseLabel("Downloading images…");
          } else if (eventLine === "images_done") {
            setImportPhaseLabel(`${data.count as number} images downloaded`);
          } else if (eventLine === "ai_start") {
            setImportPhase("building");
            setImportPhaseLabel(null);
            const total = data.pages as number;
            setImportPages(Array.from({ length: total }, (_, i) => ({ slug: `page-${i}`, label: `Page ${i + 1}`, status: "pending" as const })));
          } else if (eventLine === "ai_page_start") {
            const slug = data.slug as string;
            const label = data.label as string;
            const index = data.index as number;
            const total = data.total as number;
            setImportPages(prev => prev.map((p, i) =>
              i === index ? { ...p, slug, label, status: "active" as const, substep: "Mapping sections" } : p
            ));
            setImportPhaseLabel(`Page ${index + 1} of ${total}`);
            const substeps = ["Mapping sections", "Writing copy", "Choosing layouts", "Assigning images", "Finalizing"];
            let substepIdx = 0;
            if (pageSubstepRef.current) clearInterval(pageSubstepRef.current);
            pageSubstepRef.current = setInterval(() => {
              substepIdx = Math.min(substepIdx + 1, substeps.length - 1);
              setImportPages(prev => prev.map((p, i) =>
                i === index ? { ...p, substep: substeps[substepIdx] } : p
              ));
              if (substepIdx === substeps.length - 1 && pageSubstepRef.current) {
                clearInterval(pageSubstepRef.current);
                pageSubstepRef.current = null;
              }
            }, 5000);
          } else if (eventLine === "ai_page_done") {
            if (pageSubstepRef.current) { clearInterval(pageSubstepRef.current); pageSubstepRef.current = null; }
            const pageSlug = data.slug as string;
            const pageLabel = data.label as string;
            const blocks = data.blocks as number;
            setImportPages(prev => prev.map(p =>
              p.slug === pageSlug ? { ...p, label: pageLabel, status: "done" as const, blocks, substep: undefined } : p
            ));
          } else if (eventLine === "complete") {
            if (pageSubstepRef.current) { clearInterval(pageSubstepRef.current); pageSubstepRef.current = null; }
            const summary = data.summary as ImportSummary;
            setImportSummary(summary);
            setIsImporting(false);
            queryClient.invalidateQueries({ queryKey: ["sites", site.id] });
          } else if (eventLine === "error") {
            if (pageSubstepRef.current) { clearInterval(pageSubstepRef.current); pageSubstepRef.current = null; }
            setImportError(data.message as string);
            setIsImporting(false);
            return;
          }
        } catch (e) {
          console.warn("Failed to parse SSE event:", part, e);
        }
      }
    }

    setIsImporting(false);
  }

  const canSubmit = url.trim().length > 0 && !isImporting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="tw-max-w-lg">
        <DialogHeader>
          <DialogTitle>Rebuild site</DialogTitle>
        </DialogHeader>

        <div className="tw-space-y-4">
          {!isImporting && !importSummary && (
            <>
              <div className="tw-space-y-1.5">
                <Label htmlFor="rebuild-url">Website URL</Label>
                <Input
                  id="rebuild-url"
                  type="url"
                  placeholder="https://yourgym.com"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setImportError(null); }}
                  disabled={isImporting}
                />
              </div>

              <div className="tw-space-y-1.5">
                <Label>Theme</Label>
                <div className="tw-grid tw-grid-cols-2 tw-gap-2">
                  {THEME_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isImporting}
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

              <div className="tw-flex tw-items-center tw-gap-2">
                <Switch
                  id="force-crawl"
                  checked={forceCrawl}
                  onCheckedChange={setForceCrawl}
                />
                <Label htmlFor="force-crawl" className="tw-cursor-pointer">
                  Force re-crawl (bypass 3-day cache)
                </Label>
              </div>
            </>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="tw-rounded-lg tw-border tw-border-border tw-overflow-hidden">
              <div className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-bg-muted tw-border-b tw-border-border">
                <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin tw-shrink-0 tw-text-muted-foreground" />
                <p className="tw-text-xs tw-font-medium tw-text-foreground">
                  {importPhase === "scraping" && "Scanning website"}
                  {importPhase === "brand" && "Extracting brand"}
                  {importPhase === "building" && `Building pages${importPhaseLabel ? ` — ${importPhaseLabel}` : ""}`}
                  {!importPhase && "Starting…"}
                </p>
                {importPhaseLabel && importPhase !== "building" && (
                  <p className="tw-text-xs tw-text-muted-foreground tw-truncate">{importPhaseLabel}</p>
                )}
              </div>
              {importPhase === "building" && importPages.length > 0 && (
                <div className="tw-divide-y tw-divide-border tw-max-h-52 tw-overflow-y-auto">
                  {importPages.map((page) => (
                    <div key={page.slug} className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2">
                      {page.status === "done" && <CheckCircle2 className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-success" />}
                      {page.status === "active" && <Loader2 className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-animate-spin tw-text-primary" />}
                      {page.status === "pending" && <div className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-rounded-full tw-border tw-border-border" />}
                      <div className="tw-min-w-0">
                        <p className={`tw-text-xs tw-font-medium tw-truncate ${page.status === "pending" ? "tw-text-muted-foreground" : "tw-text-foreground"}`}>
                          {page.label}
                        </p>
                        {page.status === "active" && page.substep && (
                          <p className="tw-text-xs tw-text-muted-foreground">{page.substep}</p>
                        )}
                        {page.status === "done" && page.blocks != null && (
                          <p className="tw-text-xs tw-text-muted-foreground">{page.blocks} block{page.blocks !== 1 ? "s" : ""}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importError && (
            <p className="tw-text-sm tw-text-error">{importError}</p>
          )}

          {importSummary && (
            <div className="tw-space-y-2">
              <p className="tw-text-sm tw-font-semibold tw-text-foreground">Site rebuilt successfully</p>
              <div className="tw-rounded-lg tw-border tw-border-border tw-divide-y tw-divide-border">
                <div className="tw-px-3 tw-py-2.5 tw-flex tw-items-center tw-gap-2">
                  <CheckCircle2 className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-success" />
                  <span className="tw-text-sm tw-text-foreground">{importSummary.pages_generated} pages · {importSummary.blocks_generated} blocks</span>
                </div>
                {importSummary.logo_found && (
                  <div className="tw-px-3 tw-py-2.5 tw-flex tw-items-center tw-gap-2">
                    <CheckCircle2 className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-success" />
                    <span className="tw-text-sm tw-text-foreground">Logo, colors & fonts extracted</span>
                  </div>
                )}
              </div>
              <Button size="sm" className="tw-w-full" onClick={() => { handleClose(false); onSuccess(); }}>
                View updated site
              </Button>
            </div>
          )}

          {!importSummary && (
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-pt-1">
              <Button variant="ghost" size="sm" disabled={isImporting} onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                disabled={!canSubmit}
                isSubmitting={isImporting}
                onClick={() => void runRebuild()}
              >
                Rebuild site
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addScriptOpen, setAddScriptOpen] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [genPrompt, setGenPrompt] = useState("");
  const [genTheme, setGenTheme] = useState<ThemePreset>("bold");
  const [genRegenOpen, setGenRegenOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [livePreview, setLivePreview] = useState<{ spec: SiteSpec; theme: Theme; page: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ["sites", id],
    queryFn: () => getSite(id!),
    enabled: !!id,
    // Poll every 3s while a build is in progress
    refetchInterval: (query) => query.state.data?.build_status === "building" ? 3000 : false,
  });

  const { data: scriptsData } = useQuery({
    queryKey: ["sites", id, "scripts"],
    queryFn: () => getScripts(id!),
    enabled: !!id,
  });

  function refreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  const deleteSiteMutation = useMutation({
    mutationFn: () => deleteSite(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      navigate("/");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", id] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishSite(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(["sites", id], { ...data, cname_target: site?.cname_target });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", id] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSite(id!, { prompt: genPrompt, theme_preset: genTheme }),
    onSuccess: (data) => {
      queryClient.setQueryData(["sites", id], { ...data, cname_target: site?.cname_target });
      setGenRegenOpen(false);
      refreshPreview();
    },
  });


  const isPublished = !!site?.published_at;
  const scripts: SiteScript[] = scriptsData?.scripts ?? [];
  const previewUrl = site ? `http://${site.slug}.localhost:3000` : "";

  const hasUnpublishedChanges =
    isPublished &&
    (!site?.live_published_at ||
      (site?.draft_updated_at != null &&
        new Date(site.draft_updated_at) > new Date(site.live_published_at!)));

  useSetHeader(
    site ? (
      <div className="tw-flex tw-flex-1 tw-items-center tw-justify-between tw-min-w-0">
        <div className="tw-flex tw-items-center tw-gap-2 tw-min-w-0">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")} title="Back to sites">
            <ArrowLeft className="tw-h-4 tw-w-4" />
          </Button>
          <span className="tw-font-semibold tw-text-foreground tw-truncate">{site.name}</span>
          {!!site.spec && (
            <Badge variant="outline" className="tw-shrink-0 tw-text-xs">AI site</Badge>
          )}
        </div>
        <div className="tw-flex tw-items-center tw-gap-2 tw-shrink-0">
          {publishMutation.isError && (
            <span className="tw-text-xs tw-text-error">Publish failed.</span>
          )}
          {!!extractImportUrl(site.generation_prompt) && (
            <Button variant="outline" size="sm" onClick={() => setRebuildOpen(true)}>
              <Wand2 className="tw-h-3.5 tw-w-3.5 tw-mr-1.5" />
              Rebuild
            </Button>
          )}
          {isPublished && (
            hasUnpublishedChanges ? (
              <Button
                size="sm"
                isSubmitting={publishMutation.isPending}
                onClick={() => publishMutation.mutate()}
              >
                {site.live_published_at ? "Publish changes" : "Publish to live"}
              </Button>
            ) : (
              <Badge variant="success">Live</Badge>
            )
          )}
        </div>
      </div>
    ) : null
  );

  if (siteLoading) {
    return (
      <div className="tw-max-w-2xl tw-space-y-4">
        <Skeleton className="tw-h-8 tw-w-48" />
        <Skeleton className="tw-h-12 tw-w-full" />
        <Skeleton className="tw-h-40 tw-w-full" />
      </div>
    );
  }

  if (!site) return null;

  return (
    <div className="tw-flex tw-gap-0 tw-h-[calc(100vh-5rem)]">
      {/* Main panel — 1/3 width on lg+, full width on mobile */}
      <div className="tw-flex-1 lg:tw-flex-none lg:tw-w-1/3 tw-shrink-0 tw-flex tw-flex-col tw-overflow-hidden lg:tw-border-r lg:tw-border-border">
        <div className="tw-overflow-y-auto tw-flex-1 tw-pr-6 tw-pb-8">

          {/* Persistent build progress — visible regardless of active tab */}
          {site.build_status === "building" && (
            <div className="tw-mt-6 tw-mb-0">
              <p className="tw-text-xs tw-font-medium tw-text-muted-foreground tw-mb-2 tw-uppercase tw-tracking-wide">Building site…</p>
              <BuildProgressPanel progress={site.build_progress} error={null} />
              <p className="tw-text-xs tw-text-muted-foreground tw-mt-2">You can navigate away — this will update automatically when done.</p>
            </div>
          )}
          {site.build_status === "error" && site.build_error && (
            <div className="tw-mt-6 tw-mb-0 tw-rounded-lg tw-border tw-border-error/30 tw-bg-error/5 tw-px-3 tw-py-2.5">
              <p className="tw-text-xs tw-font-semibold tw-text-error tw-mb-0.5">Build failed</p>
              <p className="tw-text-xs tw-text-error/80">{site.build_error}</p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="tw-mt-6">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="ai">Pages</TabsTrigger>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="files">Website</TabsTrigger>
              </TabsList>
              {/* Mobile-only preview button */}
              {isPublished && (
                <Button variant="outline" size="sm" className="lg:tw-hidden" asChild>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="tw-h-3.5 tw-w-3.5 tw-mr-1.5" />
                    Preview
                  </a>
                </Button>
              )}
            </div>

            {/* Overview */}
            <TabsContent value="overview" className="tw-space-y-6">
              <BusinessInfoSection siteId={id!} onSaved={refreshPreview} />

              <div className="tw-rounded-lg tw-border tw-border-error/30 tw-p-4">
                <h2 className="tw-text-base tw-font-semibold tw-text-error tw-mb-1">
                  Danger zone
                </h2>
                <p className="tw-text-sm tw-text-muted-foreground tw-mb-3">
                  Permanently delete this site and all its files. This cannot be undone.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="tw-h-4 tw-w-4 tw-mr-1.5" />
                      Delete site
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>Delete "{site.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the site and all its content. This cannot be undone.
                    </AlertDialogDescription>
                    {deleteSiteMutation.isError && (
                      <p className="tw-text-sm tw-text-error tw-mt-2">Delete failed. Please try again.</p>
                    )}
                    <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
                      <AlertDialogCancel disabled={deleteSiteMutation.isPending}>Cancel</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        isSubmitting={deleteSiteMutation.isPending}
                        onClick={() => deleteSiteMutation.mutate()}
                      >
                        Delete site
                      </Button>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>

            {/* Pages tab */}
            <TabsContent value="ai" className="tw-space-y-6">
              <AiGenerateSection
                siteId={id!}
                hasSpec={!!site.spec}
                spec={site.spec}
                theme={site.theme}
                themePreset={site.theme_preset ?? null}
                generationPrompt={site.generation_prompt ?? ""}
                canRebuildPages={!!extractImportUrl(site.generation_prompt)}
                genPrompt={genPrompt}
                setGenPrompt={setGenPrompt}
                genTheme={genTheme}
                setGenTheme={setGenTheme}
                genRegenOpen={genRegenOpen}
                setGenRegenOpen={setGenRegenOpen}
                isPending={generateMutation.isPending}
                error={generateMutation.error?.message ?? null}
                onGenerate={() => generateMutation.mutate()}
              />
              {!!site.spec && (
                <>
                  <hr className="tw-border-border" />
                  <PageAiChatSection
                    siteId={id!}
                    spec={site.spec as { pages: { slug: string; title: string }[] }}
                    onSiteUpdated={(updated) => {
                      queryClient.setQueryData(["sites", id], { ...updated, cname_target: site?.cname_target });
                      refreshPreview();
                    }}
                  />
                </>
              )}
            </TabsContent>

            {/* Block editor */}
            <TabsContent value="editor" className="tw-space-y-4">
              {site.spec ? (
                <BlockEditor
                  siteId={id!}
                  initialSpec={site.spec as SiteSpec}
                  initialTheme={(site.theme ?? DEFAULT_THEME) as Theme}
                  themePreset={site.theme_preset}
                  publishedTheme={site.published_theme}
                  initialBrandKit={site.brand_kit}
                  iframeRef={iframeRef}
                  onLivePreviewChange={(spec, theme, page) => setLivePreview({ spec, theme, page })}
                />
              ) : (
                <TemplatePickerEmptyState
                  siteId={id!}
                  onApplied={() => {
                    queryClient.invalidateQueries({ queryKey: ["sites", id] });
                    refreshPreview();
                  }}
                />
              )}
            </TabsContent>

            {/* Website */}
            <TabsContent value="files" className="tw-space-y-6">
              {isPublished && (
                <>
                  <div>
                    <h2 className="tw-text-base tw-font-semibold tw-text-foreground tw-mb-2">
                      Site URL
                    </h2>
                    <UrlBar slug={site.slug} customDomain={site.custom_domain} />
                  </div>
                  <CustomDomainSection
                    siteId={id!}
                    customDomain={site.custom_domain}
                    domainStatus={site.domain_status}
                    cnameTarget={site.cname_target}
                  />
                </>
              )}

              <div className="tw-space-y-4">
                <div className="tw-flex tw-items-center tw-justify-between">
                  <div>
                    <h2 className="tw-text-base tw-font-semibold tw-text-foreground">
                      Third-party scripts
                    </h2>
                    <p className="tw-text-sm tw-text-muted-foreground tw-mt-0.5">
                      Injected at serve time — no need to edit your files.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAddScriptOpen(true)}>
                    <Plus className="tw-h-3.5 tw-w-3.5 tw-mr-1" />
                    Add script
                  </Button>
                </div>
                {scripts.length > 0 ? (
                  <div className="tw-rounded-lg tw-border tw-border-border tw-px-3">
                    {scripts.map((script) => (
                      <ScriptRow
                        key={script.id}
                        script={script}
                        siteId={id!}
                        onChanged={refreshPreview}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="tw-rounded-lg tw-border tw-border-dashed tw-border-border tw-px-4 tw-py-6 tw-flex tw-flex-col tw-items-center tw-gap-2 tw-text-center">
                    <Code2 className="tw-h-6 tw-w-6 tw-text-muted-foreground" />
                    <p className="tw-text-sm tw-text-muted-foreground">
                      No scripts yet. Add Google Analytics, GTM, Meta Pixel, or any custom code.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Preview panel — 2/3 width on lg+, hidden on mobile */}
      <div className="tw-hidden lg:tw-flex tw-flex-col lg:tw-w-2/3 tw-overflow-hidden tw-bg-muted/40 tw-p-4 tw-gap-0">
        {/* Browser chrome */}
        <div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-t-lg tw-border tw-border-b-0 tw-border-border tw-bg-background tw-shrink-0">
          {/* Viewport toggle */}
          <div className="tw-flex tw-items-center tw-rounded-md tw-border tw-border-border tw-p-0.5 tw-gap-0.5">
            <button
              onClick={() => setPreviewViewport("desktop")}
              title="Desktop view"
              className={`tw-rounded tw-p-1 tw-transition-colors ${previewViewport === "desktop" ? "tw-bg-muted tw-text-foreground" : "tw-text-muted-foreground hover:tw-text-foreground"}`}
            >
              <Monitor className="tw-h-3.5 tw-w-3.5" />
            </button>
            <button
              onClick={() => setPreviewViewport("mobile")}
              title="Mobile view"
              className={`tw-rounded tw-p-1 tw-transition-colors ${previewViewport === "mobile" ? "tw-bg-muted tw-text-foreground" : "tw-text-muted-foreground hover:tw-text-foreground"}`}
            >
              <Smartphone className="tw-h-3.5 tw-w-3.5" />
            </button>
          </div>
          <span className="tw-flex-1 tw-font-mono tw-text-xs tw-text-muted-foreground tw-truncate">
            {previewUrl}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={refreshPreview} title="Reload preview">
            <RotateCcw className="tw-h-3.5 tw-w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" asChild title="Open in new tab">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="tw-h-3.5 tw-w-3.5" />
            </a>
          </Button>
        </div>

        {/* Preview area */}
        {activeTab === "editor" && livePreview ? (
          <div className="tw-flex-1 tw-flex tw-overflow-hidden tw-border tw-border-border tw-rounded-b-lg tw-bg-background">
            <LivePreview
              spec={livePreview.spec}
              theme={livePreview.theme}
              activePage={livePreview.page}
              viewport={previewViewport}
            />
          </div>
        ) : isPublished ? (
          <div className="tw-flex-1 tw-flex tw-overflow-hidden tw-border tw-border-border tw-rounded-b-lg tw-bg-background">
            {previewViewport === "desktop" ? (
              <iframe
                key={`${previewKey}-desktop`}
                ref={iframeRef}
                src={previewUrl}
                className="tw-flex-1 tw-w-full tw-border-0 tw-bg-white"
                title="Site preview — desktop"
              />
            ) : (
              <div className="tw-flex-1 tw-flex tw-items-start tw-justify-center tw-overflow-auto tw-bg-muted/40 tw-p-4">
                <div className="tw-flex tw-flex-col tw-rounded-xl tw-border-2 tw-border-border tw-overflow-hidden tw-shadow-md" style={{ width: 390 }}>
                  <iframe
                    key={`${previewKey}-mobile`}
                    src={previewUrl}
                    style={{ width: 390, height: 844, border: 0 }}
                    title="Site preview — mobile"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="tw-flex tw-flex-1 tw-items-center tw-justify-center tw-text-center tw-p-8 tw-border tw-border-border tw-rounded-b-lg tw-bg-background">
            <div>
              <PanelRight className="tw-h-8 tw-w-8 tw-text-muted-foreground tw-mx-auto tw-mb-3" />
              <p className="tw-text-sm tw-text-muted-foreground">
                Generate a site using the AI tab to see a live preview here.
              </p>
            </div>
          </div>
        )}
      </div>

      <AddScriptDialog
        siteId={id!}
        open={addScriptOpen}
        onClose={() => setAddScriptOpen(false)}
        onAdded={refreshPreview}
      />

      {site && (
        <RebuildDialog
          site={site}
          open={rebuildOpen}
          onOpenChange={setRebuildOpen}
          onSuccess={refreshPreview}
        />
      )}
    </div>
  );
}
