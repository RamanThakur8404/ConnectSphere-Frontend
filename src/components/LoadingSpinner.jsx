import { Loader2 } from "lucide-react";

export function LoadingSpinner({ message = "Loading...", size = "md" }) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
