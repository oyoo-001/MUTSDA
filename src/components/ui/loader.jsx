import React from 'react';
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils"; // Assumes you have the cn utility from shadcn/ui setup

export function Loader({ className }) {
  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-[#1a2744]" />
      <span className="sr-only">Loading...</span>
    </div>
  )
}