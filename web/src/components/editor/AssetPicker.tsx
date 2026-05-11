import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Skeleton,
} from "@pushpress/pushpress-ui";
import { getAssets, uploadAsset, deleteAsset, type SiteAsset } from "../../api";

type AcceptKind = "image" | "video" | "any";

const IMAGE_MIMES = "image/jpeg,image/png,image/webp,image/gif";
const VIDEO_MIMES = "video/mp4,video/webm";

const ACCEPT_ATTR: Record<AcceptKind, string> = {
  image: IMAGE_MIMES,
  video: VIDEO_MIMES,
  any: `${IMAGE_MIMES},${VIDEO_MIMES}`,
};

const ACCEPT_HINT: Record<AcceptKind, string> = {
  image: "JPEG, PNG, WebP, GIF, SVG",
  video: "MP4, WebM",
  any: "JPEG, PNG, WebP, GIF, SVG, MP4, WebM",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isVideo(mime: string): boolean {
  return mime.startsWith("video/");
}

function matchesAccept(mime: string, accept: AcceptKind): boolean {
  if (accept === "image") return !isVideo(mime);
  if (accept === "video") return isVideo(mime);
  return true;
}

interface AssetPickerProps {
  siteId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  accept?: AcceptKind;
}

export function AssetPicker({ siteId, open, onClose, onSelect, accept = "any" }: AssetPickerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["sites", siteId, "assets"],
    queryFn: () => getAssets(siteId),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAsset(siteId, file),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["sites", siteId, "assets"] });
      setUploadError(null);
      onSelect(asset.url);
      onClose();
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => deleteAsset(siteId, assetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sites", siteId, "assets"] }),
    onError: (err: Error) => setUploadError(err.message),
  });

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    uploadMutation.mutate(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  const visibleAssets = assets?.filter((a) => matchesAccept(a.mime_type, accept)) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="tw-max-w-2xl tw-max-h-[80vh] tw-flex tw-flex-col">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
        </DialogHeader>

        {/* Upload zone */}
        <div
          className={`tw-border-2 tw-border-dashed tw-rounded-lg tw-p-6 tw-text-center tw-transition-colors tw-cursor-pointer ${
            dragOver
              ? "tw-border-primary tw-bg-primary/5"
              : "tw-border-border hover:tw-border-primary/50 hover:tw-bg-muted/50"
          } ${uploadMutation.isPending ? "tw-opacity-60 tw-pointer-events-none" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="tw-h-6 tw-w-6 tw-mx-auto tw-mb-2 tw-text-muted-foreground" />
          {uploadMutation.isPending ? (
            <p className="tw-text-sm tw-text-muted-foreground">Uploading…</p>
          ) : (
            <>
              <p className="tw-text-sm tw-font-medium tw-text-foreground">
                Drop a file or click to browse
              </p>
              <p className="tw-text-xs tw-text-muted-foreground tw-mt-1">
                {ACCEPT_HINT[accept]} · Max 50 MB
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR[accept]}
          className="tw-hidden"
          onChange={e => handleFiles(e.target.files)}
        />

        {uploadError && (
          <p className="tw-text-sm tw-text-error tw-mt-1">{uploadError}</p>
        )}

        {/* Asset grid */}
        <div className="tw-flex-1 tw-overflow-y-auto tw-mt-2">
          {isLoading ? (
            <div className="tw-grid tw-grid-cols-3 tw-gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="tw-aspect-square tw-rounded-lg" />)}
            </div>
          ) : visibleAssets.length === 0 ? (
            <div className="tw-text-center tw-py-8 tw-text-muted-foreground">
              <p className="tw-text-sm">No assets yet. Upload one above.</p>
            </div>
          ) : (
            <div className="tw-grid tw-grid-cols-3 tw-gap-3">
              {visibleAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onSelect={() => { onSelect(asset.url); onClose(); }}
                  onDelete={() => deleteMutation.mutate(asset.id)}
                  deleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetCard({
  asset,
  onSelect,
  onDelete,
  deleting,
}: {
  asset: SiteAsset;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const video = isVideo(asset.mime_type);

  return (
    <div className="tw-group tw-relative tw-rounded-lg tw-border tw-border-border tw-overflow-hidden tw-bg-muted/40 tw-aspect-square tw-cursor-pointer hover:tw-border-primary tw-transition-colors">
      <button
        type="button"
        className="tw-absolute tw-inset-0 tw-w-full tw-h-full"
        onClick={onSelect}
        aria-label={`Select ${asset.original_name}`}
      >
        {video ? (
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-h-full tw-gap-2">
            <Film className="tw-h-8 tw-w-8 tw-text-muted-foreground" />
            <span className="tw-text-xs tw-text-muted-foreground tw-px-2 tw-truncate tw-max-w-full">
              {asset.original_name}
            </span>
          </div>
        ) : (
          <img
            src={asset.url}
            alt={asset.original_name}
            className="tw-w-full tw-h-full tw-object-cover"
          />
        )}
      </button>

      {/* Hover overlay with info + delete */}
      <div className="tw-absolute tw-inset-x-0 tw-bottom-0 tw-bg-gradient-to-t tw-from-black/70 tw-to-transparent tw-p-2 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
        <p className="tw-text-xs tw-text-white tw-truncate">{asset.original_name}</p>
        <p className="tw-text-xs tw-text-white/60">{formatBytes(asset.size)}</p>
      </div>

      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        className="tw-absolute tw-top-1.5 tw-right-1.5 tw-rounded tw-bg-black/50 tw-p-1 tw-text-white tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity hover:tw-bg-error/80"
        aria-label="Delete asset"
      >
        <Trash2 className="tw-h-3 tw-w-3" />
      </button>
    </div>
  );
}
