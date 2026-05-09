import { Link, useLocation } from "react-router-dom";
import { Globe, LayoutDashboard, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Avatar,
  AvatarFallback,
  Button,
} from "@pushpress/pushpress-ui";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Sites", href: "/", icon: LayoutDashboard },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="tw-px-4 tw-py-4">
        <div className="tw-flex tw-items-center tw-gap-2">
          <Globe className="tw-h-5 tw-w-5 tw-text-primary tw-shrink-0" />
          <span className="tw-font-semibold tw-text-foreground tw-text-sm group-data-[collapsible=icon]:tw-hidden">
            Webhost
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navItems.map(({ label, href, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === href}
                tooltip={label}
              >
                <Link to={href}>
                  <Icon className="tw-h-4 tw-w-4" />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="tw-p-3">
        <div className="tw-flex tw-items-center tw-gap-3 tw-min-w-0">
          <Avatar className="tw-h-8 tw-w-8 tw-shrink-0">
            <AvatarFallback className="tw-text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="tw-flex-1 tw-min-w-0 group-data-[collapsible=icon]:tw-hidden">
            <p className="tw-text-sm tw-font-medium tw-text-foreground tw-truncate">
              {user?.name}
            </p>
            <p className="tw-text-xs tw-text-muted-foreground tw-truncate">
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={logout}
            className="tw-shrink-0 group-data-[collapsible=icon]:tw-hidden"
            title="Sign out"
          >
            <LogOut className="tw-h-4 tw-w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
