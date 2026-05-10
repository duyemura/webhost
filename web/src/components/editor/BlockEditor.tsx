import React, { useState, useEffect, useRef, type RefObject } from "react";
import { Button, Badge } from "@pushpress/pushpress-ui";
import { Plus, X, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { BlockList } from "./BlockList";
import { AddBlockDialog } from "./AddBlockDialog";
import { ThemeEditor } from "./ThemeEditor";
import { addPage, removePage } from "../../lib/spec";
import { updateSpec, updateTheme, revertThemeToPublished, getPresets, THEME_PRESET_LABELS, type ThemePreset, type SiteSpec, type Theme } from "../../api";

interface BlockEditorProps {
  siteId: string;
  initialSpec: SiteSpec;
  initialTheme: Theme;
  themePreset?: string | null;
  publishedTheme?: unknown;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLivePreviewChange?: (spec: SiteSpec, theme: Theme, activePage: string) => void;
}

export function BlockEditor({ siteId, initialSpec, initialTheme, themePreset, publishedTheme, iframeRef, onLivePreviewChange }: BlockEditorProps) {
  const queryClient = useQueryClient();

  const [localSpec, setLocalSpec] = useState<SiteSpec>(initialSpec);
  const [localTheme, setLocalTheme] = useState<Theme>(initialTheme);
  const [savedSpec, setSavedSpec] = useState<SiteSpec>(initialSpec);
  const [savedTheme, setSavedTheme] = useState<Theme>(initialTheme);

  const { data: presets, isError: presetsError } = useQuery({ queryKey: ["presets"], queryFn: getPresets, staleTime: Infinity });
  const activePreset = presets && themePreset ? presets[themePreset] : undefined;
  const presetLabel = themePreset ? (THEME_PRESET_LABELS[themePreset as ThemePreset] ?? themePreset) : undefined;
  const [activePage, setActivePage] = useState("index");
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  // Notify parent of current live state whenever it changes.
  // Use a ref so the inline arrow function passed by the parent doesn't re-trigger the effect.
  const onLivePreviewChangeRef = useRef(onLivePreviewChange);
  onLivePreviewChangeRef.current = onLivePreviewChange;
  useEffect(() => {
    onLivePreviewChangeRef.current?.(localSpec, localTheme, activePage);
  }, [localSpec, localTheme, activePage]);

  // spec/theme helpers always return new references on real changes — reference equality is sufficient
  const dirty = localSpec !== savedSpec || localTheme !== savedTheme;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const specChanged = localSpec !== savedSpec;
      const themeChanged = localTheme !== savedTheme;
      if (specChanged) await updateSpec(siteId, localSpec);
      if (themeChanged) await updateTheme(siteId, localTheme, themePreset ?? undefined);
    },
    onSuccess: () => {
      setSavedSpec(localSpec);
      setSavedTheme(localTheme);
      queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
      iframeRef.current?.contentWindow?.location.reload();
    },
  });

  const [revertError, setRevertError] = useState<string | null>(null);
  const revertToPublishedMutation = useMutation({
    mutationFn: () => revertThemeToPublished(siteId),
    onSuccess: (updated) => {
      const newTheme = updated.theme as Theme;
      setLocalTheme(newTheme);
      setSavedTheme(newTheme);
      setRevertError(null);
      queryClient.invalidateQueries({ queryKey: ["sites", siteId] });
      iframeRef.current?.contentWindow?.location.reload();
    },
    onError: (err) => setRevertError((err as Error).message),
  });

  function handleAddPage() {
    setPageError(null);
    try {
      const slug = newPageSlug.trim();
      const title = newPageTitle.trim();
      const newSpec = addPage(localSpec, slug, title);
      setLocalSpec(newSpec);
      setActivePage(slug);
      setAddingPage(false);
      setNewPageSlug("");
      setNewPageTitle("");
    } catch (e) {
      setPageError((e as Error).message);
    }
  }

  function handleRemovePage(slug: string) {
    try {
      const newSpec = removePage(localSpec, slug);
      setLocalSpec(newSpec);
      if (activePage === slug) setActivePage("index");
    } catch (e) {
      setPageError((e as Error).message);
    }
  }

  return (
    <div className="tw-space-y-4">
      {/* Page tabs */}
      <div className="tw-flex tw-items-center tw-gap-1 tw-flex-wrap">
        {localSpec.pages.map((page) => (
          <div key={page.slug} className="tw-flex tw-items-center">
            <button
              onClick={() => setActivePage(page.slug)}
              className={[
                "tw-px-3 tw-py-1.5 tw-text-sm tw-rounded-l tw-border tw-border-r-0 tw-transition-colors",
                activePage === page.slug
                  ? "tw-bg-primary tw-text-primary-foreground tw-border-primary"
                  : "tw-border-border tw-text-foreground hover:tw-bg-muted",
              ].join(" ")}
            >
              {page.title || page.slug}
            </button>
            {page.slug !== "index" && (
              <button
                onClick={() => handleRemovePage(page.slug)}
                className={[
                  "tw-px-1.5 tw-py-1.5 tw-text-sm tw-rounded-r tw-border tw-transition-colors",
                  activePage === page.slug
                    ? "tw-bg-primary tw-text-primary-foreground/70 hover:tw-text-primary-foreground tw-border-primary"
                    : "tw-border-border tw-text-muted-foreground hover:tw-text-error hover:tw-bg-muted",
                ].join(" ")}
                aria-label={`Remove ${page.slug} page`}
              >
                <X className="tw-h-3 tw-w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Add page */}
        {!addingPage && (
          <button
            onClick={() => setAddingPage(true)}
            className="tw-flex tw-items-center tw-gap-1 tw-px-2 tw-py-1.5 tw-text-sm tw-rounded tw-border tw-border-dashed tw-border-border tw-text-muted-foreground hover:tw-text-foreground hover:tw-border-foreground tw-transition-colors"
          >
            <Plus className="tw-h-3 tw-w-3" />
            Add page
          </button>
        )}

        {addingPage && (
          <div className="tw-flex tw-items-center tw-gap-1.5 tw-border tw-border-border tw-rounded tw-px-2 tw-py-1">
            <input
              autoFocus
              placeholder="Slug"
              value={newPageSlug}
              onChange={(e) => setNewPageSlug(e.target.value)}
              className="tw-text-sm tw-w-20 tw-bg-transparent tw-outline-none tw-text-foreground"
            />
            <span className="tw-text-muted-foreground">/</span>
            <input
              placeholder="Title"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddPage(); if (e.key === "Escape") setAddingPage(false); }}
              className="tw-text-sm tw-w-24 tw-bg-transparent tw-outline-none tw-text-foreground"
            />
            <button onClick={handleAddPage} className="tw-text-xs tw-text-primary hover:tw-underline">Add page</button>
            <button onClick={() => setAddingPage(false)} className="tw-text-xs tw-text-muted-foreground hover:tw-underline">Cancel</button>
          </div>
        )}
      </div>

      {pageError && (
        <p className="tw-text-xs tw-text-error">{pageError}</p>
      )}

      {/* Block list */}
      <BlockList siteId={siteId} spec={localSpec} pageSlug={activePage} onChange={setLocalSpec} />

      {/* Add block button */}
      <Button
        variant="outline"
        size="sm"
        className="tw-w-full"
        onClick={() => setAddBlockOpen(true)}
      >
        <Plus className="tw-h-4 tw-w-4 tw-mr-1.5" />
        Add block
      </Button>

      <AddBlockDialog
        open={addBlockOpen}
        onOpenChange={setAddBlockOpen}
        spec={localSpec}
        pageSlug={activePage}
        onAdd={setLocalSpec}
      />

      {presetsError && (
        <p className="tw-text-xs tw-text-error">Failed to load theme presets. Reset-to-preset will be unavailable.</p>
      )}

      {revertError && (
        <p className="tw-text-xs tw-text-error">{revertError}</p>
      )}

      {/* Theme panel (collapsible) */}
      <div className="tw-border tw-border-border tw-rounded-lg">
        <button
          className="tw-flex tw-items-center tw-justify-between tw-w-full tw-px-4 tw-py-3 tw-text-sm tw-font-medium tw-text-foreground"
          onClick={() => setThemeOpen((o) => !o)}
        >
          Theme
          {themeOpen ? <ChevronDown className="tw-h-4 tw-w-4" /> : <ChevronRight className="tw-h-4 tw-w-4" />}
        </button>

        {themeOpen && (
          <div className="tw-px-4 tw-pb-4 tw-border-t tw-border-border">
            <ThemeEditor
              theme={localTheme}
              onChange={setLocalTheme}
              preset={activePreset}
              presetName={presetLabel}
              publishedTheme={publishedTheme as Theme | null}
              onRevertToPublished={() => revertToPublishedMutation.mutate()}
              isRevertingToPublished={revertToPublishedMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="tw-flex tw-items-center tw-justify-between tw-py-3 tw-border-t tw-border-border">
        {dirty ? (
          <span className="tw-flex tw-items-center tw-gap-1.5 tw-text-sm tw-text-warning">
            <AlertCircle className="tw-h-4 tw-w-4" />
            Unsaved changes
          </span>
        ) : (
          <span className="tw-text-sm tw-text-muted-foreground">All changes saved</span>
        )}
        <Button
          size="sm"
          disabled={!dirty || saveMutation.isPending}
          isSubmitting={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save changes
        </Button>
      </div>

      {saveMutation.isError && (
        <p className="tw-text-xs tw-text-error">
          {(saveMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
