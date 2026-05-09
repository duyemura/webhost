import { SidebarInset, SidebarProvider, SidebarTrigger } from "@pushpress/pushpress-ui";
import { AppSidebar } from "./AppSidebar";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="tw-flex tw-h-12 tw-items-center tw-gap-2 tw-border-b tw-border-border tw-px-4">
          <SidebarTrigger className="tw-h-8 tw-w-8" />
        </header>
        <main className="tw-flex-1 tw-p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
