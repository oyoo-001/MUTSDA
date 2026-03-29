import React, { useState, useEffect, useCallback } from "react";
import { Download, X, Share, Smartphone } from "lucide-react";

/**
 * PWAInstallPrompt
 * ─────────────────────────────────────────────────────────────────
 * Shows a "Install App" banner in three scenarios:
 *   1. Android / Windows Chrome/Edge → intercepts `beforeinstallprompt`
 *   2. iOS Safari                    → manual "Share → Add to Home Screen"
 *   3. Already installed             → hidden
 *
 * Dismissed state is persisted in localStorage so it doesn't re-appear
 * every visit. It will re-appear after 7 days.
 */

const DISMISS_KEY = "mutsda_pwa_prompt_dismissed";
const DISMISS_DAYS = 7;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function wasDismissedRecently() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed or dismissed recently → do nothing
    if (isInStandaloneMode() || wasDismissedRecently()) return;

    // iOS: no beforeinstallprompt, show manual instructions
    if (isIos()) {
      setTimeout(() => {
        setShowIos(true);
        setVisible(true);
      }, 3000); // slight delay so it doesn't compete with page load
      return;
    }

    // Android / Windows: listen for the native install event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroid(true);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  if (!visible) return null;

  // ── iOS banner ──────────────────────────────────────────────────
  if (showIos) {
    return (
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm
          bg-white rounded-2xl shadow-2xl border border-gray-100
          transition-all duration-500 ease-out
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        role="dialog"
        aria-label="Install MUTSDA App"
      >
        {/* Notch / pointer */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100" />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#1a2744] flex items-center justify-center">
                <img
                  src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png"
                  alt="MUTSDA"
                  className="w-9 h-9 object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-[#1a2744] text-sm leading-tight">Install MUTSDA</p>
                <p className="text-xs text-gray-400">Add to your home screen</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-300 hover:text-gray-500 transition-colors p-1 -mt-1 -mr-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* iOS steps */}
          <ol className="space-y-2 text-xs text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#c8a951]/20 text-[#c8a951] font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
              Tap the <Share className="w-3 h-3 mx-1 text-blue-500" /> <strong>Share</strong> button in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#c8a951]/20 text-[#c8a951] font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
              Scroll down and tap <strong>"Add to Home Screen"</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#c8a951]/20 text-[#c8a951] font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
              Tap <strong>"Add"</strong> to install
            </li>
          </ol>
        </div>
      </div>
    );
  }

  // ── Android / Windows banner ──────────────────────────────────
  if (showAndroid) {
    return (
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm
          bg-white rounded-2xl shadow-2xl border border-gray-100
          transition-all duration-500 ease-out
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        role="dialog"
        aria-label="Install MUTSDA App"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#1a2744] flex items-center justify-center">
              <img
                src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png"
                alt="MUTSDA"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1a2744] text-sm leading-tight">Install MUTSDA Church</p>
              <p className="text-xs text-gray-400 mt-0.5">Sermons, events & prayers — even offline</p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-300 hover:text-gray-500 transition-colors p-1 -mt-1 -mr-1 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feature pills */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {["📵 Works offline", "🔔 Push alerts", "⚡ Fast & native"].map((f) => (
              <span
                key={f}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2744]/5 text-[#1a2744]/70 font-medium"
              >
                {f}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 text-sm py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors font-medium"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              id="pwa-install-btn"
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl bg-[#1a2744] text-white hover:bg-[#2d5f8a] transition-colors font-semibold shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
