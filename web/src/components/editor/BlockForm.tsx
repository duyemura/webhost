import React, { useState, useEffect, useRef } from "react";
import { Input, Textarea, Switch, Label, Button } from "@pushpress/pushpress-ui";
import { FolderOpen, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inferFieldType, isMediaUrlKey, sortFields } from "../../lib/editor";
import type { SiteSection } from "../../api";
import { uploadAsset } from "../../api";
import { AssetPicker } from "./AssetPicker";
import { BLOCK_CATALOG } from "../../lib/spec";

const ACRONYMS = new Set(["url", "html", "api", "sms", "csv", "id"]);

function toFieldLabel(key: string): string {
  const words = key.split("_");
  return words
    .map((word, i) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(word)) return upper;
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

interface BlockFormProps {
  siteId: string;
  section: SiteSection;
  onChange: (fields: Record<string, unknown>) => void;
}

export function BlockForm({ siteId, section, onChange }: BlockFormProps) {
  const catalogEntry = BLOCK_CATALOG.find(b => b.type === section.type);
  const itemTemplates = catalogEntry?.itemTemplates ?? {};

  const fieldKeys = sortFields(
    Object.keys(section).filter((k) => k !== "id" && k !== "type")
  );
  const fields = fieldKeys.map((k) => [k, section[k as keyof typeof section]] as [string, unknown]);

  const [draft, setDraft] = useState<Record<string, unknown>>(() => Object.fromEntries(fields));
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [pickerField, setPickerField] = useState<{ key: string; accept: "image" | "video" | "any" } | null>(null);

  useEffect(() => {
    setDraft(Object.fromEntries(Object.entries(section).filter(([k]) => k !== "id" && k !== "type")));
    setJsonErrors({});
  }, [section]);

  function setField(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setJsonError(key: string, err: string | null) {
    setJsonErrors((e) => {
      const next = { ...e };
      if (err == null) delete next[key];
      else next[key] = err;
      return next;
    });
  }

  const hasErrors = Object.keys(jsonErrors).length > 0;

  return (
    <div className="tw-space-y-3 tw-pt-3 tw-border-t tw-border-border">
      {fields.map(([key]) => {
        const value = draft[key];
        const inputType = inferFieldType(key, section[key]);
        const label = toFieldLabel(key);
        const isMedia = isMediaUrlKey(key);

        return (
          <div key={key} className="tw-space-y-1">
            <Label className="tw-text-xs tw-font-medium tw-text-muted-foreground">{label}</Label>

            {inputType === "switch" && (
              <Switch
                checked={!!value}
                onCheckedChange={(checked) => setField(key, checked)}
              />
            )}

            {inputType === "text" && (
              <Input
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(key, e.target.value)}
                className="tw-text-sm"
              />
            )}

            {inputType === "url" && !isMedia && (
              <Input
                type="url"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(key, e.target.value)}
                className="tw-text-sm"
              />
            )}

            {inputType === "url" && isMedia && (
              <InlineMediaField
                siteId={siteId}
                fieldKey={key}
                value={typeof value === "string" ? value : ""}
                accept={key.includes("video") ? "video" : "image"}
                onChange={(url) => setField(key, url)}
                onBrowse={() => setPickerField({
                  key,
                  accept: key.includes("video") ? "video" : "image",
                })}
              />
            )}

            {inputType === "textarea" && (
              <Textarea
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(key, e.target.value)}
                rows={3}
                className="tw-text-sm"
              />
            )}

            {inputType === "cta" && (
              <CtaField
                value={value as { text?: string; url?: string }}
                onChange={(v) => setField(key, v)}
              />
            )}

            {inputType === "string-array" && (
              <StringArrayField
                value={Array.isArray(value) ? (value as string[]) : []}
                onChange={(v) => setField(key, v)}
              />
            )}

            {inputType === "item-list" && (
              <ItemListField
                fieldKey={key}
                value={Array.isArray(value) ? (value as Record<string, string>[]) : []}
                itemTemplate={itemTemplates[key]}
                onChange={(v) => setField(key, v)}
              />
            )}

            {inputType === "json" && (
              <JsonField
                fieldKey={key}
                value={value}
                error={jsonErrors[key]}
                onChange={(parsed) => { setField(key, parsed); setJsonError(key, null); }}
                onError={(err) => setJsonError(key, err)}
              />
            )}
          </div>
        );
      })}

      <Button
        size="sm"
        disabled={hasErrors}
        onClick={() => onChange(draft)}
        className="tw-w-full"
      >
        Apply
      </Button>

      {pickerField && (
        <AssetPicker
          siteId={siteId}
          open
          accept={pickerField.accept}
          onSelect={(url) => setField(pickerField.key, url)}
          onClose={() => setPickerField(null)}
        />
      )}
    </div>
  );
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const VIDEO_ACCEPT = "video/mp4,video/webm";

function InlineMediaField({
  siteId,
  fieldKey,
  value,
  accept,
  onChange,
  onBrowse,
}: {
  siteId: string;
  fieldKey: string;
  value: string;
  accept: "image" | "video";
  onChange: (url: string) => void;
  onBrowse: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAsset(siteId, file),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "assets"] });
      onChange(asset.url);
      setUploadError(null);
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="tw-space-y-1">
      <div className="tw-flex tw-gap-1.5">
        <Input
          type="url"
          value={value}
          onChange={(e) => { onChange(e.target.value); setUploadError(null); }}
          className="tw-text-sm tw-flex-1"
          placeholder="Paste URL, upload, or browse…"
          aria-label={fieldKey}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Upload file"
          disabled={uploadMutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploadMutation.isPending
            ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" />
            : <Upload className="tw-h-4 tw-w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Browse media library"
          onClick={onBrowse}
        >
          <FolderOpen className="tw-h-4 tw-w-4" />
        </Button>
      </div>
      {uploadError && (
        <p className="tw-text-xs tw-text-error">{uploadError}</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={accept === "video" ? VIDEO_ACCEPT : IMAGE_ACCEPT}
        className="tw-hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function CtaField({
  value,
  onChange,
}: {
  value: { text?: string; url?: string };
  onChange: (v: { text: string; url: string }) => void;
}) {
  return (
    <div className="tw-space-y-1.5 tw-pl-2 tw-border-l-2 tw-border-border">
      <div className="tw-space-y-1">
        <Label className="tw-text-xs tw-text-muted-foreground">Button text</Label>
        <Input
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value, url: value?.url ?? "" })}
          className="tw-text-sm"
          placeholder="Get started"
        />
      </div>
      <div className="tw-space-y-1">
        <Label className="tw-text-xs tw-text-muted-foreground">Link URL</Label>
        <Input
          type="url"
          value={value?.url ?? ""}
          onChange={(e) => onChange({ text: value?.text ?? "", url: e.target.value })}
          className="tw-text-sm"
          placeholder="#contact"
        />
      </div>
    </div>
  );
}

function StringArrayField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function updateItem(i: number, text: string) {
    const next = [...value];
    next[i] = text;
    onChange(next);
  }

  function removeItem(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function addItem() {
    onChange([...value, ""]);
  }

  return (
    <div className="tw-space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="tw-flex tw-gap-1.5">
          <Input
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            className="tw-text-sm tw-flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => removeItem(i)}
            className="tw-shrink-0 tw-text-muted-foreground hover:tw-text-error"
          >
            <Trash2 className="tw-h-3.5 tw-w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="tw-w-full tw-gap-1"
      >
        <Plus className="tw-h-3.5 tw-w-3.5" />
        Add
      </Button>
    </div>
  );
}

// First string-typed value in an item to use as a label (name > title > question > first key)
const LABEL_KEY_PRIORITY = ["name", "title", "question", "author", "value", "label"];

function itemLabel(item: Record<string, string>, index: number): string {
  for (const k of LABEL_KEY_PRIORITY) {
    if (item[k]) return String(item[k]);
  }
  const first = Object.values(item).find(v => typeof v === "string" && v.trim());
  return first ? String(first) : `Item ${index + 1}`;
}

function ItemListField({
  fieldKey,
  value,
  itemTemplate,
  onChange,
}: {
  fieldKey: string;
  value: Record<string, string>[];
  itemTemplate?: Record<string, string>;
  onChange: (v: Record<string, string>[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const keys = value.length > 0
    ? Object.keys(value[0])
    : itemTemplate ? Object.keys(itemTemplate) : [];

  function toggle(i: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function updateItem(i: number, field: string, text: string) {
    const next = value.map((item, idx) => idx === i ? { ...item, [field]: text } : item);
    onChange(next);
  }

  function removeItem(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
    setExpanded(prev => {
      const next = new Set<number>();
      for (const n of prev) { if (n < i) next.add(n); else if (n > i) next.add(n - 1); }
      return next;
    });
  }

  function addItem() {
    const template = itemTemplate ?? (keys.length > 0 ? Object.fromEntries(keys.map(k => [k, ""])) : { [fieldKey]: "" });
    const blank = Object.fromEntries(Object.entries(template).map(([k, v]) => [k, v]));
    const newIndex = value.length;
    onChange([...value, blank]);
    setExpanded(prev => new Set([...prev, newIndex]));
  }

  return (
    <div className="tw-space-y-2">
      {value.map((item, i) => (
        <div key={i} className="tw-rounded tw-border tw-border-border tw-overflow-hidden">
          <button
            type="button"
            className="tw-w-full tw-flex tw-items-center tw-justify-between tw-px-3 tw-py-2 tw-text-left hover:tw-bg-muted/40 tw-transition-colors"
            onClick={() => toggle(i)}
          >
            <span className="tw-text-sm tw-font-medium tw-truncate tw-flex-1">{itemLabel(item, i)}</span>
            <div className="tw-flex tw-items-center tw-gap-1 tw-ml-2">
              <span className="tw-text-xs tw-text-muted-foreground">{expanded.has(i) ? "▲" : "▼"}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                className="tw-text-muted-foreground hover:tw-text-error"
              >
                <Trash2 className="tw-h-3.5 tw-w-3.5" />
              </Button>
            </div>
          </button>
          {expanded.has(i) && (
            <div className="tw-space-y-2 tw-p-3 tw-border-t tw-border-border tw-bg-background">
              {keys.map((field) => (
                <div key={field} className="tw-space-y-0.5">
                  <Label className="tw-text-xs tw-text-muted-foreground">{toFieldLabel(field)}</Label>
                  {field.endsWith("_url") ? (
                    <Input
                      type="url"
                      value={item[field] ?? ""}
                      onChange={(e) => updateItem(i, field, e.target.value)}
                      className="tw-text-sm"
                      placeholder="https://…"
                    />
                  ) : (field === "bio" || field === "description" || field === "answer" || field === "quote") ? (
                    <Textarea
                      value={item[field] ?? ""}
                      onChange={(e) => updateItem(i, field, e.target.value)}
                      rows={3}
                      className="tw-text-sm"
                    />
                  ) : (
                    <Input
                      value={item[field] ?? ""}
                      onChange={(e) => updateItem(i, field, e.target.value)}
                      className="tw-text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="tw-w-full tw-gap-1"
        disabled={keys.length === 0}
      >
        <Plus className="tw-h-3.5 tw-w-3.5" />
        Add item
      </Button>
    </div>
  );
}

function JsonField({
  fieldKey,
  value,
  error,
  onChange,
  onError,
}: {
  fieldKey: string;
  value: unknown;
  error: string | undefined;
  onChange: (v: unknown) => void;
  onError: (err: string) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  function handleBlur() {
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div>
      <Textarea
        value={text}
        rows={5}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        className={`tw-text-xs tw-font-mono ${error ? "tw-border-error" : ""}`}
        aria-label={`${fieldKey} JSON`}
      />
      {error && <p className="tw-text-xs tw-text-error tw-mt-1">{error}</p>}
    </div>
  );
}
