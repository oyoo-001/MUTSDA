import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Church, Home } from "lucide-react";

export default function PageNotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-[#c8a951]/10 flex items-center justify-center mx-auto mb-6">
          <Church className="w-10 h-10 text-[#c8a951]" />
        </div>
        <h1 className="text-6xl font-bold text-[#1a2744] mb-2">404</h1>
        <p className="text-xl text-gray-500 mb-8">Page not found</p>
        <Link to={createPageUrl("Home")}>
          <Button className="bg-[#1a2744] hover:bg-[#2d5f8a] gap-2">
            <Home className="w-4 h-4" /> Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}