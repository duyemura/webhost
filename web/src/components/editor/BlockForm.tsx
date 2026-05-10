import React, { useState, useEffect } from "react";
import { Input, Textarea, Switch, Label, Button } from "@pushpress/pushpress-ui";
import { inferFieldType } from "../../lib/editor";
import type { SiteSection } from "../../api";

interface BlockFormProps {
  section: SiteSection;
  onChange: (fields: Record<string, unknown>) => void;
}

export function BlockForm({ section, onChange }: BlockFormProps) {
  const fields = Object.entries(section).filter(([k]) => k !== "id" && k !== "type");

  // Local draft state
  const [draft, setDraft] = useState<Record<string, unknown>>(() => Object.fromEntries(fields));
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  // Sync when section changes externally
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
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
              <Input
                type="url"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setField(key, e.target.value)}
                className="tw-text-sm"
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
