import React, { useState } from "react";
import { Badge, Button } from "@pushpress/pushpress-ui";
import { ChevronUp, ChevronDown, Trash2, ChevronRight } from "lucide-react";
import { BlockForm } from "./BlockForm";
import { moveSection, removeSection, updateSection } from "../../lib/spec";
import type { SiteSection, SiteSpec } from "../../api";

// Fields that should always appear for a block type, even if missing from an older spec
const BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
  hero: { eyebrow: "", image_url: "", background_video_url: "" },
};

function withDefaults(section: SiteSection): SiteSection {
  const defaults = BLOCK_DEFAULTS[section.type];
  if (!defaults) return section;
  const merged: SiteSection = { ...section };
  for (const [key, val] of Object.entries(defaults)) {
    if (!(key in merged)) merged[key as keyof SiteSection] = val as never;
  }
  return merged;
}

interface BlockListProps {
  siteId: string;
  spec: SiteSpec;
  pageSlug: string;
  onChange: (spec: SiteSpec) => void;
}

export function BlockList({ siteId, spec, pageSlug, onChange }: BlockListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const page = spec.pages.find((p) => p.slug === pageSlug);
  const sections = page?.sections ?? [];

  function summary(section: SiteSection): string {
    const first = Object.entries(section)
      .find(([k, v]) => k !== "id" && k !== "type" && typeof v === "string");
    if (!first) return "";
    const val = String(first[1]);
    return val.length > 40 ? val.slice(0, 40) + "…" : val;
  }

  return (
    <div className="tw-space-y-2">
      {sections.length === 0 && (
        <p className="tw-text-sm tw-text-muted-foreground tw-text-center tw-py-4">
          No blocks yet. Add one below.
        </p>
      )}

      {sections.map((section, idx) => {
        const isExpanded = expandedId === section.id;
        const isFirst = idx === 0;
        const isLast = idx === sections.length - 1;

        return (
          <div
            key={section.id}
            className="tw-rounded-lg tw-border tw-border-border tw-bg-background"
          >
            {/* Row header */}
            <div className="tw-flex tw-items-center tw-gap-2 tw-p-3">
              {/* Move buttons */}
              <div className="tw-flex tw-flex-col tw-gap-0.5">
                <button
                  disabled={isFirst}
                  onClick={() => onChange(moveSection(spec, pageSlug, section.id, "up"))}
                  className="tw-text-muted-foreground hover:tw-text-foreground disabled:tw-opacity-30 disabled:tw-cursor-not-allowed"
                  aria-label="Move up"
                >
                  <ChevronUp className="tw-h-3.5 tw-w-3.5" />
                </button>
                <button
                  disabled={isLast}
                  onClick={() => onChange(moveSection(spec, pageSlug, section.id, "down"))}
                  className="tw-text-muted-foreground hover:tw-text-foreground disabled:tw-opacity-30 disabled:tw-cursor-not-allowed"
                  aria-label="Move down"
                >
                  <ChevronDown className="tw-h-3.5 tw-w-3.5" />
                </button>
              </div>

              {/* Type badge + summary — clickable to expand */}
              <button
                className="tw-flex tw-flex-1 tw-items-center tw-gap-2 tw-min-w-0 tw-text-left"
                onClick={() => setExpandedId(isExpanded ? null : section.id)}
              >
                <Badge variant="outline" className="tw-shrink-0 tw-text-xs">
                  {section.type}
                </Badge>
                <span className="tw-text-sm tw-text-muted-foreground tw-truncate">
                  {summary(section)}
                </span>
                <ChevronRight
                  className={`tw-ml-auto tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-muted-foreground tw-transition-transform ${isExpanded ? "tw-rotate-90" : ""}`}
                />
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  onChange(removeSection(spec, pageSlug, section.id));
                  if (expandedId === section.id) setExpandedId(null);
                }}
                className="tw-text-muted-foreground hover:tw-text-error tw-shrink-0"
                aria-label="Delete block"
              >
                <Trash2 className="tw-h-3.5 tw-w-3.5" />
              </button>
            </div>

            {/* Inline form */}
            {isExpanded && (
              <div className="tw-px-3 tw-pb-3">
                <BlockForm
                  siteId={siteId}
                  section={withDefaults(section)}
                  onChange={(fields) =>
                    onChange(updateSection(spec, pageSlug, section.id, fields))
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
