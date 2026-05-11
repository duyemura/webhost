import React from "react";
import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button } from "@pushpress/pushpress-ui";
import { RotateCcw, History, Upload, ImageIcon } from "lucide-react";
import { colorToHex } from "../../lib/editor";
import type { Theme, BrandKit } from "../../api";

const COLOR_LABELS: Record<keyof Theme["colors"], string> = {
  primary: "Primary",
  primary_foreground: "Primary foreground",
  secondary: "Secondary",
  secondary_foreground: "Secondary foreground",
  background: "Background",
  foreground: "Foreground",
  muted: "Muted",
  muted_foreground: "Muted foreground",
  accent: "Accent",
  border: "Border",
  surface: "Surface",
};

const RADIUS_OPTIONS: { value: Theme["shape"]["radius"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "full", label: "Full" },
];

const PADDING_OPTIONS: { value: Theme["spacing"]["section_padding"]; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "loose", label: "Loose" },
];

interface ThemeEditorProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
  brandKit?: BrandKit | null;
  onBrandKitChange?: (kit: BrandKit) => void;
  onLogoUpload?: (file: File) => Promise<string | null>;
  onFaviconUpload?: (file: File) => Promise<string | null>;
  preset?: Theme;
  presetName?: string;
  publishedTheme?: Theme | null;
  onRevertToPublished?: () => void;
  isRevertingToPublished?: boolean;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function themesDiffer(a: Theme, b: Theme): boolean {
  return !deepEqual(a, b);
}

export function ThemeEditor({
  theme,
  onChange,
  brandKit,
  onBrandKitChange,
  onLogoUpload,
  onFaviconUpload,
  preset,
  presetName,
  publishedTheme,
  onRevertToPublished,
  isRevertingToPublished,
}: ThemeEditorProps) {
  const hasPresetChanges = preset ? themesDiffer(theme, preset) : false;
  const hasPublishedVersion = !!publishedTheme && themesDiffer(theme, publishedTheme);

  function setColor(key: keyof Theme["colors"], hex: string) {
    onChange({ ...theme, colors: { ...theme.colors, [key]: hex } });
  }

  function resetColor(key: keyof Theme["colors"]) {
    if (!preset) return;
    onChange({ ...theme, colors: { ...theme.colors, [key]: preset.colors[key] } });
  }

  function setTypography(key: keyof Theme["typography"], value: string) {
    onChange({ ...theme, typography: { ...theme.typography, [key]: value } });
  }

  function resetTypography(key: keyof Theme["typography"]) {
    if (!preset) return;
    onChange({ ...theme, typography: { ...theme.typography, [key]: preset.typography[key] } });
  }

  function setBrandColor(key: keyof Pick<BrandKit, "primary" | "primary_foreground" | "secondary" | "background" | "foreground" | "accent">, hex: string) {
    if (!brandKit || !onBrandKitChange) return;
    onBrandKitChange({ ...brandKit, [key]: hex });
  }

  function setBrandFont(key: "heading_font" | "body_font", value: string) {
    if (!brandKit || !onBrandKitChange) return;
    onBrandKitChange({ ...brandKit, [key]: value });
  }

  const [logoUploading, setLogoUploading] = React.useState(false);
  const [faviconUploading, setFaviconUploading] = React.useState(false);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onLogoUpload || !brandKit || !onBrandKitChange) return;
    setLogoUploading(true);
    try {
      const url = await onLogoUpload(file);
      if (url) onBrandKitChange({ ...brandKit, logo_url: url });
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function handleFaviconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onFaviconUpload || !brandKit || !onBrandKitChange) return;
    setFaviconUploading(true);
    try {
      const url = await onFaviconUpload(file);
      if (url) onBrandKitChange({ ...brandKit, favicon_url: url });
    } finally {
      setFaviconUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="tw-space-y-5">
      {/* Brand kit */}
      {brandKit && onBrandKitChange && (
        <div>
          <p className="tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide tw-mb-2">
            Brand
          </p>
          <div className="tw-space-y-3">
            {/* Logo */}
            <div className="tw-flex tw-items-center tw-gap-3">
              <div className="tw-h-10 tw-w-10 tw-rounded tw-border tw-border-border tw-bg-muted tw-flex tw-items-center tw-justify-center tw-overflow-hidden tw-shrink-0">
                {brandKit.logo_url
                  ? <img src={brandKit.logo_url} alt="Logo" className="tw-h-full tw-w-full tw-object-contain" />
                  : <ImageIcon className="tw-h-4 tw-w-4 tw-text-muted-foreground" />
                }
              </div>
              <div className="tw-flex-1">
                <p className="tw-text-xs tw-font-medium tw-text-foreground tw-mb-1">Logo</p>
                <label className="tw-flex tw-items-center tw-gap-1.5 tw-cursor-pointer tw-text-xs tw-text-muted-foreground hover:tw-text-foreground">
                  <Upload className="tw-h-3 tw-w-3" />
                  {logoUploading ? "Uploading…" : brandKit.logo_url ? "Replace logo" : "Upload logo"}
                  <input type="file" accept="image/*" className="tw-hidden" onChange={handleLogoFile} disabled={logoUploading} />
                </label>
              </div>
              {brandKit.logo_url && (
                <button
                  type="button"
                  onClick={() => onBrandKitChange({ ...brandKit, logo_url: null })}
                  className="tw-text-xs tw-text-muted-foreground hover:tw-text-foreground"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Favicon */}
            <div className="tw-flex tw-items-center tw-gap-3">
              <div className="tw-h-10 tw-w-10 tw-rounded tw-border tw-border-border tw-bg-muted tw-flex tw-items-center tw-justify-center tw-overflow-hidden tw-shrink-0">
                {brandKit.favicon_url
                  ? <img src={brandKit.favicon_url} alt="Favicon" className="tw-h-6 tw-w-6 tw-object-contain" />
                  : <ImageIcon className="tw-h-3 tw-w-3 tw-text-muted-foreground" />
                }
              </div>
              <div className="tw-flex-1">
                <p className="tw-text-xs tw-font-medium tw-text-foreground tw-mb-1">Favicon</p>
                <label className="tw-flex tw-items-center tw-gap-1.5 tw-cursor-pointer tw-text-xs tw-text-muted-foreground hover:tw-text-foreground">
                  <Upload className="tw-h-3 tw-w-3" />
                  {faviconUploading ? "Uploading…" : brandKit.favicon_url ? "Replace favicon" : "Upload favicon"}
                  <input type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg" className="tw-hidden" onChange={handleFaviconFile} disabled={faviconUploading} />
                </label>
              </div>
              {brandKit.favicon_url && (
                <button
                  type="button"
                  onClick={() => onBrandKitChange({ ...brandKit, favicon_url: null })}
                  className="tw-text-xs tw-text-muted-foreground hover:tw-text-foreground"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Brand colors */}
            {(["primary", "secondary", "background", "foreground", "accent"] as const).map(key => (
              <div key={key} className="tw-flex tw-items-center tw-gap-3">
                <input
                  type="color"
                  value={brandKit[key]}
                  onChange={e => setBrandColor(key, e.target.value)}
                  className="tw-h-7 tw-w-7 tw-rounded tw-border tw-border-border tw-cursor-pointer tw-p-0.5 tw-bg-transparent tw-shrink-0"
                />
                <span className="tw-flex-1 tw-text-xs tw-text-foreground tw-capitalize">{key.replace("_", " ")}</span>
                <span className="tw-text-xs tw-font-mono tw-text-muted-foreground">{brandKit[key]}</span>
              </div>
            ))}

            {/* Fonts */}
            <div className="tw-space-y-1.5">
              <Label className="tw-text-xs">Heading font</Label>
              <Input
                value={brandKit.heading_font}
                onChange={e => setBrandFont("heading_font", e.target.value)}
                placeholder="Inter"
                className="tw-h-8 tw-text-xs"
              />
            </div>
            <div className="tw-space-y-1.5">
              <Label className="tw-text-xs">Body font</Label>
              <Input
                value={brandKit.body_font}
                onChange={e => setBrandFont("body_font", e.target.value)}
                placeholder="Inter"
                className="tw-h-8 tw-text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Level 2: Reset all to preset */}
      {preset && hasPresetChanges && (
        <div className="tw-flex tw-items-center tw-justify-between tw-py-2 tw-px-3 tw-bg-warning/10 tw-border tw-border-warning/30 tw-rounded-md">
          <span className="tw-text-xs tw-text-warning-foreground">
            Theme customized
          </span>
          <button
            onClick={() => onChange(preset)}
            className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-warning-foreground hover:tw-underline"
          >
            <RotateCcw className="tw-h-3 tw-w-3" />
            Reset to {presetName ?? "preset"}
          </button>
        </div>
      )}

      {/* Colors */}
      <div>
        <p className="tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide tw-mb-2">
          Colors
        </p>
        <div className="tw-space-y-2">
          {(Object.keys(COLOR_LABELS) as (keyof Theme["colors"])[]).map((key) => {
            const isChanged = preset && colorToHex(theme.colors[key]) !== colorToHex(preset.colors[key]);
            return (
              <div key={key} className="tw-flex tw-items-center tw-gap-3">
                <input
                  type="color"
                  value={colorToHex(theme.colors[key])}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="tw-h-7 tw-w-7 tw-cursor-pointer tw-rounded tw-border tw-border-border tw-bg-transparent tw-p-0.5"
                  aria-label={COLOR_LABELS[key]}
                />
                <Label className="tw-text-sm tw-flex-1">{COLOR_LABELS[key]}</Label>
                <span className="tw-text-xs tw-text-muted-foreground tw-font-mono">
                  {colorToHex(theme.colors[key])}
                </span>
                {isChanged && (
                  <button
                    onClick={() => resetColor(key)}
                    title={`Reset to ${colorToHex(preset!.colors[key])}`}
                    className="tw-text-muted-foreground hover:tw-text-foreground tw-transition-colors"
                  >
                    <RotateCcw className="tw-h-3.5 tw-w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Typography */}
      <div>
        <p className="tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide tw-mb-2">
          Typography
        </p>
        <div className="tw-space-y-2">
          {(["heading_font", "body_font"] as const).map((key) => {
            const label = key === "heading_font" ? "Heading font" : "Body font";
            const isChanged = preset && theme.typography[key] !== preset.typography[key];
            return (
              <div key={key}>
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
                  <Label className="tw-text-sm">{label}</Label>
                  {isChanged && (
                    <button
                      onClick={() => resetTypography(key)}
                      title={`Reset to ${preset!.typography[key]}`}
                      className="tw-text-muted-foreground hover:tw-text-foreground tw-transition-colors"
                    >
                      <RotateCcw className="tw-h-3.5 tw-w-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  value={theme.typography[key]}
                  onChange={(e) => setTypography(key, e.target.value)}
                  className="tw-text-sm"
                />
              </div>
            );
          })}
          <div>
            <Label className="tw-text-sm">Heading weight</Label>
            <Select
              value={theme.typography.heading_weight}
              onValueChange={(v) => setTypography("heading_weight", v)}
            >
              <SelectTrigger className="tw-mt-1 tw-text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["400", "500", "600", "700", "800", "900"].map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="tw-text-sm">Heading transform</Label>
            <Select
              value={theme.typography.heading_transform}
              onValueChange={(v) => setTypography("heading_transform", v)}
            >
              <SelectTrigger className="tw-mt-1 tw-text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "none", label: "None" },
                  { value: "uppercase", label: "Uppercase" },
                  { value: "lowercase", label: "Lowercase" },
                  { value: "capitalize", label: "Capitalize" },
                ].map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="tw-text-sm">Heading tracking</Label>
            <Select
              value={theme.typography.heading_tracking}
              onValueChange={(v) => setTypography("heading_tracking", v)}
            >
              <SelectTrigger className="tw-mt-1 tw-text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "tight", label: "Tight" },
                  { value: "normal", label: "Normal" },
                  { value: "wide", label: "Wide" },
                ].map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Shape */}
      <div>
        <p className="tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide tw-mb-2">
          Shape
        </p>
        <div className="tw-flex tw-gap-1.5 tw-flex-wrap">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...theme, shape: { radius: opt.value } })}
              className={[
                "tw-px-3 tw-py-1.5 tw-rounded tw-text-sm tw-border tw-transition-colors",
                theme.shape.radius === opt.value
                  ? "tw-bg-primary tw-text-primary-foreground tw-border-primary"
                  : "tw-border-border tw-text-foreground hover:tw-bg-muted",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <p className="tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide tw-mb-2">
          Spacing
        </p>
        <div className="tw-flex tw-gap-1.5">
          {PADDING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...theme, spacing: { section_padding: opt.value } })}
              className={[
                "tw-px-3 tw-py-1.5 tw-rounded tw-text-sm tw-border tw-transition-colors",
                theme.spacing.section_padding === opt.value
                  ? "tw-bg-primary tw-text-primary-foreground tw-border-primary"
                  : "tw-border-border tw-text-foreground hover:tw-bg-muted",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Level 3: Restore published version */}
      {hasPublishedVersion && onRevertToPublished && (
        <div className="tw-pt-2 tw-border-t tw-border-border">
          <Button
            variant="outline"
            size="sm"
            className="tw-w-full"
            onClick={onRevertToPublished}
            disabled={isRevertingToPublished}
            isSubmitting={isRevertingToPublished}
          >
            <History className="tw-h-3.5 tw-w-3.5 tw-mr-1.5" />
            Restore published version
          </Button>
          <p className="tw-text-xs tw-text-muted-foreground tw-text-center tw-mt-1.5">
            Reverts theme to what was live when last published
          </p>
        </div>
      )}
    </div>
  );
}
