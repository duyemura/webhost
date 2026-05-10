import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, ExternalLink } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Skeleton,
} from "@pushpress/pushpress-ui";
import { getSites, createSite, slugify, type Site } from "../api";
import { useAuth } from "../context/AuthContext";

function SiteCard({ site }: { site: Site }) {
  const navigate = useNavigate();
  const isPublished = !!site.published_at;
  const siteUrl = `http://${site.slug}.localhost:3000`;

  return (
    <Card className="tw-flex tw-flex-col">
      <CardHeader className="tw-pb-2">
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
          <CardTitle className="tw-text-base tw-font-semibold tw-leading-tight">
            {site.name}
          </CardTitle>
          <Badge variant={isPublished ? "success" : "outline"} className="tw-shrink-0">
            {isPublished ? "Published" : "No files yet"}
          </Badge>
        </div>
        <p className="tw-text-xs tw-text-muted-foreground tw-font-mono">
          {site.slug}
        </p>
      </CardHeader>

      <CardContent className="tw-flex-1">
        {isPublished && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-primary hover:tw-underline"
          >
            <Globe className="tw-h-3 tw-w-3" />
            {site.slug}.localhost:3000
            <ExternalLink className="tw-h-3 tw-w-3" />
          </a>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          className="tw-w-full"
          onClick={() => navigate(`/sites/${site.id}`)}
        >
          Manage site
        </Button>
      </CardFooter>
    </Card>
  );
}

function CreateSiteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const queryClient = useQueryClient();

  const slug = customSlug || slugify(name);

  const mutation = useMutation({
    mutationFn: () =>
      createSite({ name, ...(customSlug ? { slug: customSlug } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      onOpenChange(false);
      setName("");
      setCustomSlug("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new site</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="tw-space-y-4">
          <div className="tw-space-y-1.5">
            <label className="tw-text-sm tw-font-medium tw-text-foreground">
              Site name
            </label>
            <Input
              placeholder="My Gym Website"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="tw-space-y-1.5">
            <label className="tw-text-sm tw-font-medium tw-text-foreground">
              Slug{" "}
              <span className="tw-text-muted-foreground tw-font-normal">
                (optional)
              </span>
            </label>
            <Input
              placeholder={slug || "auto-generated"}
              value={customSlug}
              onChange={(e) => setCustomSlug(slugify(e.target.value))}
            />
            {slug && (
              <p className="tw-text-xs tw-text-muted-foreground">
                Your site will be at{" "}
                <span className="tw-font-mono tw-text-foreground">
                  {slug}.localhost:3000
                </span>
              </p>
            )}
          </div>
          {mutation.error && (
            <p className="tw-text-sm tw-text-error">
              {(mutation.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isSubmitting={mutation.isPending} disabled={!name.trim()}>
              Create site
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: getSites,
  });

  return (
    <div className="tw-max-w-5xl">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <div>
          <h1 className="tw-text-2xl tw-font-semibold tw-text-foreground">
            {user?.name ? `${user.name.split(" ")[0]}'s sites` : "Your sites"}
          </h1>
          <p className="tw-text-sm tw-text-muted-foreground tw-mt-0.5">
            Build an AI-generated site and get a live URL instantly.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="tw-h-4 tw-w-4 tw-mr-1.5" />
          New site
        </Button>
      </div>

      {isLoading ? (
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="tw-h-5 tw-w-32" />
                <Skeleton className="tw-h-3 tw-w-20 tw-mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="tw-h-3 tw-w-40" />
              </CardContent>
              <CardFooter>
                <Skeleton className="tw-h-8 tw-w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : sites?.length === 0 ? (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-dashed tw-border-border tw-py-16 tw-text-center">
          <Globe className="tw-h-10 tw-w-10 tw-text-muted-foreground tw-mb-3" />
          <h3 className="tw-font-medium tw-text-foreground">No sites yet</h3>
          <p className="tw-text-sm tw-text-muted-foreground tw-mt-1 tw-mb-4">
            Create your first site and generate it with AI to get started.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="tw-h-4 tw-w-4 tw-mr-1.5" />
            Create your first site
          </Button>
        </div>
      ) : (
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
          {sites?.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}

      <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
