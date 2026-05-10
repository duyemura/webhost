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
  Import,
  AlertTriangle,
  CheckCircle2,
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
  importFromUrl,
  THEME_PRESETS,
  THEME_PRESET_COLORS,
  THEME_PRESET_LABELS,
  getTemplates,
  getTemplate,
  getPresets,
  type ThemePreset,
  type SiteScript,
  type BusinessProfile,
  type SiteSpec,
  type Theme,
  type ImportSummary,
  DEFAULT_THEME,
  updateSpec,
  updateTheme,
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
  generationPrompt: string;
  genPrompt: string;
  setGenPrompt: (v: string) => void;
  genTheme: ThemePreset;
  setGenTheme: (v: ThemePreset) => void;
  genRegenOpen: boolean;
  setGenRegenOpen: (v: boolean) => void;
  isPending: boolean;
  error: string | null;
  onGenerate: () => void;
  // Import from URL
  importUrl: string;
  setImportUrl: (v: string) => void;
  importPending: boolean;
  importError: string | null;
  importSummary: ImportSummary | null;
  onImport: () => void;
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
                style={{ background: THEME_PRESET_COLORS[preset] }}
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

function ImportFromUrlForm({
  importUrl, setImportUrl, genTheme, setGenTheme,
  isPending, error, summary, onImport,
}: {
  importUrl: string;
  setImportUrl: (v: string) => void;
  genTheme: ThemePreset;
  setGenTheme: (v: ThemePreset) => void;
  isPending: boolean;
  error: string | null;
  summary: ImportSummary | null;
  onImport: () => void;
}) {
  return (
    <div className="tw-space-y-4">
      <div className="tw-space-y-1.5">
        <Label htmlFor="import-url">Your current website URL</Label>
        <p className="tw-text-xs tw-text-muted-foreground">
          We'll scan every page we find and rebuild the structure using our block system.
        </p>
        <Input
          id="import-url"
          type="url"
          placeholder="https://yourgym.com"
          value={importUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportUrl(e.target.value)}
          disabled={isPending}
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
                style={{ background: THEME_PRESET_COLORS[preset] }}
              />
              {THEME_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="tw-text-sm tw-text-error">{error}</p>
      )}

      {isPending && (
        <div className="tw-rounded-lg tw-bg-muted tw-p-4 tw-space-y-2">
          <p className="tw-text-sm tw-font-medium tw-text-foreground">Scanning your site…</p>
          <div className="tw-space-y-1 tw-text-xs tw-text-muted-foreground">
            <p>Fetching pages and extracting content structure</p>
            <p>Mapping sections to block types with AI</p>
            <p>This usually takes 20–40 seconds</p>
          </div>
        </div>
      )}

      {summary && !isPending && (
        <div className="tw-rounded-lg tw-border tw-border-border tw-p-4 tw-space-y-3">
          <div className="tw-flex tw-items-center tw-gap-2">
            <CheckCircle2 className="tw-h-4 tw-w-4 tw-text-success" />
            <p className="tw-text-sm tw-font-medium tw-text-foreground">Import complete</p>
          </div>
          <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-text-sm">
            <div>
              <p className="tw-text-muted-foreground">Pages imported</p>
              <p className="tw-font-semibold">{summary.pages_generated}</p>
            </div>
            <div>
              <p className="tw-text-muted-foreground">Blocks created</p>
              <p className="tw-font-semibold">{summary.blocks_generated}</p>
            </div>
            <div>
              <p className="tw-text-muted-foreground">Pages scanned</p>
              <p className="tw-font-semibold">{summary.pages_scraped}</p>
            </div>
            <div>
              <p className="tw-text-muted-foreground">Sections found</p>
              <p className="tw-font-semibold">{summary.sections_found}</p>
            </div>
          </div>
          {summary.gaps.length > 0 && (
            <div className="tw-rounded tw-bg-warning/10 tw-border tw-border-warning/20 tw-p-3 tw-space-y-1.5">
              <div className="tw-flex tw-items-center tw-gap-1.5">
                <AlertTriangle className="tw-h-3.5 tw-w-3.5 tw-text-warning" />
                <p className="tw-text-xs tw-font-medium tw-text-warning">
                  {summary.gaps.length} section{summary.gaps.length > 1 ? "s" : ""} couldn't be fully mapped
                </p>
              </div>
              <ul className="tw-space-y-1">
                {summary.gaps.map((gap, i) => (
                  <li key={i} className="tw-text-xs tw-text-muted-foreground tw-flex tw-gap-1.5">
                    <span className="tw-shrink-0">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="tw-text-xs tw-text-muted-foreground">
            Switch to the Editor tab to review and refine your imported content.
          </p>
        </div>
      )}

      <Button
        onClick={onImport}
        disabled={!importUrl.trim() || isPending}
        isSubmitting={isPending}
        className="tw-w-full tw-gap-2"
      >
        <Import className="tw-h-4 tw-w-4" />
        {isPending ? "Importing…" : "Import site"}
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
  hasSpec, spec, theme, generationPrompt,
  genPrompt, setGenPrompt, genTheme, setGenTheme,
  genRegenOpen, setGenRegenOpen,
  isPending, error, onGenerate,
  importUrl, setImportUrl, importPending, importError, importSummary, onImport,
}: AiGenerateSectionProps) {
  const specData = spec as { version: number; pages: { slug: string; title: string; sections: Record<string, unknown>[] }[] } | null;
  const themeData = theme as { colors?: { primary?: string } } | null;
  const totalBlocks = specData?.pages.reduce((n, p) => n + p.sections.length, 0) ?? 0;

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
          <h2 className="tw-text-base tw-font-semibold">Build your site</h2>
          <p className="tw-text-sm tw-text-muted-foreground tw-mt-1">
            Start from scratch with AI, or import your existing website.
          </p>
        </div>
        <Tabs defaultValue="generate">
          <TabsList className="tw-w-full">
            <TabsTrigger value="generate" className="tw-flex-1">Generate from scratch</TabsTrigger>
            <TabsTrigger value="import" className="tw-flex-1">Import existing site</TabsTrigger>
          </TabsList>
          <TabsContent value="generate" className="tw-mt-4">
            <GenerateForm
              genPrompt={genPrompt} setGenPrompt={setGenPrompt}
              genTheme={genTheme} setGenTheme={setGenTheme}
              isPending={isPending} error={error} onGenerate={onGenerate}
            />
          </TabsContent>
          <TabsContent value="import" className="tw-mt-4">
            <ImportFromUrlForm
              importUrl={importUrl} setImportUrl={setImportUrl}
              genTheme={genTheme} setGenTheme={setGenTheme}
              isPending={importPending} error={importError}
              summary={importSummary}
              onImport={onImport}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Find preset name from theme primary color
  const primaryColor = themeData?.colors?.primary;
  const presetName = primaryColor
    ? (THEME_PRESETS.find(p => THEME_PRESET_COLORS[p] === primaryColor) ?? null)
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
            <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-muted-foreground">
              {page.title}
            </p>
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

      {/* Theme chip */}
      {primaryColor && (
        <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
          <span className="tw-text-muted-foreground">Theme:</span>
          <span className="tw-flex tw-items-center tw-gap-1.5 tw-font-medium">
            <span className="tw-w-3 tw-h-3 tw-rounded-full tw-inline-block" style={{ background: primaryColor }} />
            {presetName ? THEME_PRESET_LABELS[presetName] : "Custom"}
          </span>
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

export function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addScriptOpen, setAddScriptOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [genPrompt, setGenPrompt] = useState("");
  const [genTheme, setGenTheme] = useState<ThemePreset>("bold");
  const [genRegenOpen, setGenRegenOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [livePreview, setLivePreview] = useState<{ spec: SiteSpec; theme: Theme; page: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ["sites", id],
    queryFn: () => getSite(id!),
    enabled: !!id,
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

  const importMutation = useMutation({
    mutationFn: () => importFromUrl(id!, { url: importUrl, theme_preset: genTheme }),
    onSuccess: (data) => {
      const { _import_summary, ...siteData } = data;
      queryClient.setQueryData(["sites", id], { ...siteData, cname_target: site?.cname_target });
      setImportSummary(_import_summary);
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="tw-mt-6">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
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

            {/* AI generation */}
            <TabsContent value="ai" className="tw-space-y-6">
              <AiGenerateSection
                siteId={id!}
                hasSpec={!!site.spec}
                spec={site.spec}
                theme={site.theme}
                generationPrompt={site.generation_prompt ?? ""}
                genPrompt={genPrompt}
                setGenPrompt={setGenPrompt}
                genTheme={genTheme}
                setGenTheme={setGenTheme}
                genRegenOpen={genRegenOpen}
                setGenRegenOpen={setGenRegenOpen}
                isPending={generateMutation.isPending}
                error={generateMutation.error?.message ?? null}
                onGenerate={() => generateMutation.mutate()}
                importUrl={importUrl}
                setImportUrl={setImportUrl}
                importPending={importMutation.isPending}
                importError={importMutation.error?.message ?? null}
                importSummary={importSummary}
                onImport={() => importMutation.mutate()}
              />
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
    </div>
  );
}
