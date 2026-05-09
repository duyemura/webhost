import { Globe } from "lucide-react";
import { Button } from "@pushpress/pushpress-ui";

export function Login() {
  return (
    <div className="tw-min-h-screen tw-bg-muted tw-flex tw-items-center tw-justify-center tw-p-4">
      <div className="tw-w-full tw-max-w-sm">
        <div className="tw-bg-background tw-rounded-lg tw-border tw-border-border tw-p-8 tw-shadow-sm">
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-6">
            <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-xl tw-bg-primary/10">
                <Globe className="tw-h-6 tw-w-6 tw-text-primary" />
              </div>
              <h1 className="tw-text-xl tw-font-semibold tw-text-foreground">
                Webhost
              </h1>
              <p className="tw-text-sm tw-text-muted-foreground tw-text-center">
                Upload your AI-generated site and get a live URL instantly.
              </p>
            </div>

            <Button asChild variant="outline" className="tw-w-full" size="lg">
              <a href="/api/auth/google">
                <svg
                  className="tw-mr-2 tw-h-4 tw-w-4 tw-shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
