import React, { useState, useEffect } from "react";
import { X, ChevronRight, AlertCircle, BellRing } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/base44Client";

export default function ProfileCompletionBanner() {
  const [dismissedProfile, setDismissedProfile] = useState(false);
  const [dismissedPush, setDismissedPush] = useState(false);

  useEffect(() => {
    setDismissedProfile(sessionStorage.getItem("mutsda_profile_banner_dismissed") === "true");
    setDismissedPush(sessionStorage.getItem("mutsda_push_banner_dismissed") === "true");
  }, []);

  const { data: user } = useQuery({
    queryKey: ["auth-user-profile-check"],
    queryFn: async () => {
      const isAuth = await apiClient.auth.isAuthenticated();
      if (!isAuth) return null;
      return await apiClient.auth.me();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!user) return null;

  // Checks
  const isProfileIncomplete = !user.phone || !user.address || !user.emergency_contact;
  const isPushDisabled = user.push_notifications_enabled === false || !user.push_subscription;

  // Decide what to show
  let showType = null;
  if (isProfileIncomplete && !dismissedProfile) {
    showType = "profile";
  } else if (isPushDisabled && !dismissedPush) {
    showType = "push";
  }

  if (!showType) return null;

  const handleDismiss = () => {
    if (showType === "profile") {
      setDismissedProfile(true);
      sessionStorage.setItem("mutsda_profile_banner_dismissed", "true");
    } else {
      setDismissedPush(true);
      sessionStorage.setItem("mutsda_push_banner_dismissed", "true");
    }
  };

  const bannerContent = showType === "profile" ? {
    icon: <AlertCircle className="w-5 h-5" />,
    title: "Complete Your Profile",
    desc: "Add your phone, address & emergency contact so the church can serve you better and reach you in times of need.",
    linkText: "Update Profile",
    url: "/memberprofile"
  } : {
    icon: <BellRing className="w-5 h-5" />,
    title: "Enable Notifications",
    desc: "You are currently missing out on instant church alerts for sermons, events, and important announcements.",
    linkText: "Enable Alerts",
    url: "/memberprofile"
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg transition-all duration-500 ease-out animate-in slide-in-from-bottom-5">
      <div className="bg-[#1a2744] text-white rounded-2xl shadow-2xl p-4 border border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Icon and Text */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="bg-[#c8a951]/20 p-2.5 rounded-xl text-[#c8a951] shrink-0 mt-1 sm:mt-0">
            {bannerContent.icon}
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight">{bannerContent.title}</h4>
            <p className="text-xs text-blue-200/80 mt-1 leading-snug pr-4">
              {bannerContent.desc}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end sm:justify-start">
          <Link 
            to={bannerContent.url} 
            className="flex-1 sm:flex-none whitespace-nowrap bg-[#c8a951] text-[#1a2744] hover:bg-[#b09440] font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            {bannerContent.linkText} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button 
            onClick={handleDismiss} 
            className="p-2.5 text-blue-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
