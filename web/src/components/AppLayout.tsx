import { SidebarInset, SidebarProvider, SidebarTrigger } from "@pushpress/pushpress-ui";
import { AppSidebar } from "./AppSidebar";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const SetHeaderCtx = createContext<(n: ReactNode) => void>(() => {});
const HeaderCtx = createContext<ReactNode>(null);

export function useSetHeader(content: ReactNode) {
  const set = useContext(SetHeaderCtx);
  // Update header on every render (no dep array is intentional — content is JSX so identity
  // changes every render; we want the header to stay in sync without causing null flicker).
  useEffect(() => { set(content); });
  // Clear only on unmount, not between re-renders
  useEffect(() => () => set(null), [set]);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode>(null);

  return (
    <SetHeaderCtx.Provider value={setHeaderContent}>
      <HeaderCtx.Provider value={headerContent}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="tw-flex tw-h-12 tw-items-center tw-gap-2 tw-border-b tw-border-border tw-px-4">
              <SidebarTrigger className="tw-h-8 tw-w-8" />
              {headerContent}
            </header>
            <main className="tw-flex-1 tw-p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </HeaderCtx.Provider>
    </SetHeaderCtx.Provider>
  );
}
