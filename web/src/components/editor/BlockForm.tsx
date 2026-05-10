import React, { useState, useEffect } from "react";
import { Input, Textarea, Switch, Label, Button } from "@pushpress/pushpress-ui";
import { FolderOpen } from "lucide-react";
import { inferFieldType, isMediaUrlKey } from "../../lib/editor";
import type { SiteSection } from "../../api";
import { AssetPicker } from "./AssetPicker";

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
  const fields = Object.entries(section).filter(([k]) => k !== "id" && k !== "type");

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

            {inputType === "url" && (
              <div className="tw-flex tw-gap-1.5">
                <Input
                  type="url"
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => setField(key, e.target.value)}
                  className="tw-text-sm tw-flex-1"
                  placeholder={isMedia ? "Paste URL or browse…" : undefined}
                />
                {isMedia && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Browse media library"
                    onClick={() => setPickerField({
                      key,
                      accept: key.includes("video") ? "video" : "image",
                    })}
                  >
                    <FolderOpen className="tw-h-4 tw-w-4" />
                  </Button>
                )}
              </div>
            )}

            {inputType === "textarea" && (
              <Textarea
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(key, e.target.value)}
                rows={3}
                className="tw-text-sm"
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
