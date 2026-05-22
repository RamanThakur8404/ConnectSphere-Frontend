import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

export function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (user?.role !== "ADMIN" && user?.role !== "MODERATOR") {
    return <Navigate to="/feed" replace />;
  }

  return <Outlet />;
}
