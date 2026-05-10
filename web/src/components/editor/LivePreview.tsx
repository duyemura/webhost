import React, { useMemo } from "react";
import { buildPreviewHtml } from "../../lib/preview";
import type { SiteSpec, Theme } from "../../api";

interface LivePreviewProps {
  spec: SiteSpec;
  theme: Theme;
  activePage: string;
  viewport: "desktop" | "mobile";
}

export function LivePreview({ spec, theme, activePage, viewport }: LivePreviewProps) {
  const page = spec.pages.find((p) => p.slug === activePage);
  const sections = page?.sections ?? [];

  const srcdoc = useMemo(
    () => buildPreviewHtml(sections, theme),
    // sections reference is stable between renders when unchanged (immutable spec updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, theme]
  );

  if (viewport === "mobile") {
    return (
      <div className="tw-flex-1 tw-flex tw-items-start tw-justify-center tw-overflow-auto tw-bg-muted/40 tw-p-4">
        <div
          className="tw-flex tw-flex-col tw-rounded-xl tw-border-2 tw-border-border tw-overflow-hidden tw-shadow-md"
          style={{ width: 390 }}
        >
          <iframe
            srcDoc={srcdoc}
            style={{ width: 390, height: 844, border: 0 }}
            title="Live preview — mobile"
          />
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={srcdoc}
      className="tw-flex-1 tw-w-full tw-border-0 tw-bg-white"
      title="Live preview — desktop"
    />
  );
}
