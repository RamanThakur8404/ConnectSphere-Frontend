import { CheckCircle } from "lucide-react";
import React from "react";

export function VerifiedBadge({ className = "w-4 h-4 text-primary", title = "Verified Premium User" }) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={title}
      aria-label="Verified Premium User"
    >
      <CheckCircle className="w-full h-full fill-primary text-white" />
    </span>
  );
}
