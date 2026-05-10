import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from "@pushpress/pushpress-ui";
import { BLOCK_CATALOG } from "../../lib/spec";
import type { SiteSpec } from "../../api";
import { addSection } from "../../lib/spec";

interface AddBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: SiteSpec;
  pageSlug: string;
  onAdd: (spec: SiteSpec) => void;
}

export function AddBlockDialog({ open, onOpenChange, spec, pageSlug, onAdd }: AddBlockDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(type: string) {
    setSelected(type);
    const entry = BLOCK_CATALOG.find((e) => e.type === type);
    if (!entry) return;
    const newSpec = addSection(spec, pageSlug, entry.defaultSection());
    onAdd(newSpec);
    onOpenChange(false);
    setSelected(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw-max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
        </DialogHeader>

        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-4 tw-gap-3 tw-mt-2 tw-max-h-[60vh] tw-overflow-y-auto tw-pr-1">
          {BLOCK_CATALOG.map((entry) => (
            <button
              key={entry.type}
              onClick={() => handleSelect(entry.type)}
              disabled={selected === entry.type}
              className={[
                "tw-flex tw-flex-col tw-items-start tw-gap-1 tw-rounded-lg tw-border tw-border-border tw-p-3 tw-text-left tw-transition-colors",
                "hover:tw-bg-muted hover:tw-border-primary/40",
                "focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-primary",
              ].join(" ")}
            >
              <span className="tw-text-sm tw-font-medium tw-text-foreground">{entry.label}</span>
              <span className="tw-text-xs tw-text-muted-foreground tw-leading-snug">{entry.description}</span>
            </button>
          ))}
        </div>

        <div className="tw-flex tw-justify-end tw-mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
