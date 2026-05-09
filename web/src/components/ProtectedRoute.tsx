import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Skeleton } from "@pushpress/pushpress-ui";
import type { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="tw-min-h-screen tw-flex tw-items-center tw-justify-center">
        <div className="tw-space-y-3 tw-w-64">
          <Skeleton className="tw-h-8 tw-w-full" />
          <Skeleton className="tw-h-8 tw-w-3/4" />
          <Skeleton className="tw-h-8 tw-w-1/2" />
        </div>
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
