import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Trash2,
  FileText,
  CheckCheck,
  Plus,
  Code2,
  Globe,
  X,
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
  PageHeader,
  Dropzone,
  DropzoneEmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Switch,
  Input,
  Label,
  Textarea,
} from "@pushpress/pushpress-ui";
import {
  getSite,
  getSiteFiles,
  uploadZip,
  deleteFile,
  deleteSite,
  updateSite,
  getScripts,
  addScript,
  updateScript,
  deleteScript,
  getDomainStatus,
  formatBytes,
  type SiteFile,
  type SiteScript,
} from "../api";

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
      <h2 className="tw-text-sm tw-font-medium tw-text-foreground tw-mb-2">
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
}: {
  script: SiteScript;
  siteId: string;
}) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateScript(siteId, script.id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteScript(siteId, script.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sites", siteId, "scripts"] }),
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
            >
              Remove script
            </AlertDialogAction>
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
}: {
  siteId: string;
  open: boolean;
  onClose: () => void;
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

function FileRow({
  file,
  siteId,
  onDeleted,
}: {
  file: SiteFile;
  siteId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteFile(siteId, file.path),
    onSuccess: onDeleted,
  });

  return (
    <div className="tw-flex tw-items-center tw-gap-3 tw-py-2.5 tw-border-b tw-border-border last:tw-border-0">
      <FileText className="tw-h-4 tw-w-4 tw-text-muted-foreground tw-shrink-0" />
      <span className="tw-flex-1 tw-font-mono tw-text-sm tw-text-foreground tw-truncate">
        {file.path}
      </span>
      <span className="tw-text-xs tw-text-muted-foreground tw-shrink-0">
        {formatBytes(file.size)}
      </span>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
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
          <AlertDialogTitle>Delete file?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="tw-font-mono">{file.path}</span> will be permanently removed from your site.
          </AlertDialogDescription>
          <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => mutation.mutate()}
            >
              Delete file
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [addScriptOpen, setAddScriptOpen] = useState(false);

  const { data: site, isLoading: siteLoading } = useQuery({
    queryKey: ["sites", id],
    queryFn: () => getSite(id!),
    enabled: !!id,
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["sites", id, "files"],
    queryFn: () => getSiteFiles(id!),
    enabled: !!id,
  });

  const { data: scriptsData } = useQuery({
    queryKey: ["sites", id, "scripts"],
    queryFn: () => getScripts(id!),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadZip(id!, file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sites", id] });
      queryClient.invalidateQueries({ queryKey: ["sites", id, "files"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setUploadError(null);
      setUploadSuccess(`${result.filesExtracted} files uploaded successfully.`);
      setTimeout(() => setUploadSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSite(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      navigate("/");
    },
  });

  function handleDrop(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);
    uploadMutation.mutate(file);
  }

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

  const isPublished = !!site.published_at;
  const files: SiteFile[] = filesData?.files ?? [];
  const scripts: SiteScript[] = scriptsData?.scripts ?? [];

  return (
    <div className="tw-max-w-2xl">
      <PageHeader
        title={site.name}
        onBack={() => navigate("/")}
      >
        <Badge variant={isPublished ? "success" : "outline"}>
          {isPublished ? "Published" : "No files yet"}
        </Badge>
      </PageHeader>

      <div className="tw-mt-6 tw-space-y-6">
        {/* URL bar */}
        {isPublished && (
          <div>
            <h2 className="tw-text-sm tw-font-medium tw-text-foreground tw-mb-2">
              Site URL
            </h2>
            <UrlBar slug={site.slug} customDomain={site.custom_domain} />
          </div>
        )}

        {/* Custom domain */}
        {isPublished && (
          <CustomDomainSection
            siteId={id!}
            customDomain={site.custom_domain}
            domainStatus={site.domain_status}
            cnameTarget={site.cname_target}
          />
        )}

        {/* Upload */}
        <div>
          <h2 className="tw-text-sm tw-font-medium tw-text-foreground tw-mb-2">
            {isPublished ? "Replace files" : "Upload your site"}
          </h2>
          <p className="tw-text-xs tw-text-muted-foreground tw-mb-3">
            Export your AI-generated site as a zip file and drop it here.
            {isPublished && " Uploading a new zip will merge files — existing files are kept unless overwritten."}
          </p>

          <Dropzone
            accept={{
              "application/zip": [".zip"],
              "application/x-zip-compressed": [".zip"],
              "application/octet-stream": [".zip"],
            }}
            maxFiles={1}
            disabled={uploadMutation.isPending}
            onChange={handleDrop}
          >
            <DropzoneEmptyState />
          </Dropzone>

          {uploadMutation.isPending && (
            <p className="tw-text-sm tw-text-muted-foreground tw-mt-2">
              Uploading and extracting files…
            </p>
          )}
          {uploadSuccess && (
            <p className="tw-text-sm tw-text-success tw-mt-2">{uploadSuccess}</p>
          )}
          {uploadError && (
            <p className="tw-text-sm tw-text-error tw-mt-2">{uploadError}</p>
          )}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div>
            <h2 className="tw-text-sm tw-font-medium tw-text-foreground tw-mb-2">
              Files{" "}
              <span className="tw-text-muted-foreground tw-font-normal">
                ({files.length})
              </span>
            </h2>
            <div className="tw-rounded-lg tw-border tw-border-border tw-px-3">
              {filesLoading ? (
                <div className="tw-py-4 tw-space-y-2">
                  <Skeleton className="tw-h-4 tw-w-full" />
                  <Skeleton className="tw-h-4 tw-w-3/4" />
                </div>
              ) : (
                files.map((file) => (
                  <FileRow
                    key={file.path}
                    file={file}
                    siteId={id!}
                    onDeleted={() =>
                      queryClient.invalidateQueries({
                        queryKey: ["sites", id, "files"],
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Third-party scripts */}
        <div>
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
            <h2 className="tw-text-sm tw-font-medium tw-text-foreground">
              Third-party scripts
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddScriptOpen(true)}
            >
              <Plus className="tw-h-3.5 tw-w-3.5 tw-mr-1" />
              Add script
            </Button>
          </div>
          <p className="tw-text-xs tw-text-muted-foreground tw-mb-3">
            Scripts are injected into your site's HTML at serve time — no need to edit your files.
          </p>
          {scripts.length > 0 ? (
            <div className="tw-rounded-lg tw-border tw-border-border tw-px-3">
              {scripts.map((script) => (
                <ScriptRow key={script.id} script={script} siteId={id!} />
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

        {/* Danger zone */}
        <div className="tw-rounded-lg tw-border tw-border-error/30 tw-p-4">
          <h2 className="tw-text-sm tw-font-medium tw-text-error tw-mb-1">
            Danger zone
          </h2>
          <p className="tw-text-xs tw-text-muted-foreground tw-mb-3">
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
                This will permanently delete the site and all {files.length} deployed file{files.length !== 1 ? "s" : ""}. This cannot be undone.
              </AlertDialogDescription>
              <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete site
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <AddScriptDialog
        siteId={id!}
        open={addScriptOpen}
        onClose={() => setAddScriptOpen(false)}
      />
    </div>
  );
}
