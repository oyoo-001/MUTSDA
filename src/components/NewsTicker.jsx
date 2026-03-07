import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/api/base44Client';
import { Megaphone, X } from 'lucide-react';

export default function NewsTicker() {
  const [ticker, setTicker] = useState({ message: "", textColor: "#1a2744", backgroundColor: "#c8a951" });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('ticker_update', (tickerState) => {
      if (tickerState && typeof tickerState === 'object') {
        setTicker(tickerState);
        setIsVisible(!!tickerState.message);
      } else {
        setTicker({ message: tickerState, textColor: "#1a2744", backgroundColor: "#c8a951" });
        setIsVisible(!!tickerState);
      }
    });
    return () => socket.disconnect();
  }, []);

  if (!ticker.message || !isVisible) return null;

  return (
    <>
      <style>
        {`
          @keyframes snakeWalk {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-track {
            display: inline-flex;
            white-space: nowrap;
            animation: snakeWalk 95s linear infinite;
            will-change: transform;
          }
          .ticker-container:hover .ticker-track {
            animation-play-state: paused;
          }
        `}
      </style>
      
      <div 
        className="ticker-container relative overflow-hidden h-10 flex items-center border-b border-black/10 shadow-sm z-50"
        style={{ backgroundColor: ticker.backgroundColor || '#c8a951' }}
      >
        {/* Left Badge: Stationary */}
        <div 
          className="absolute left-0 top-0 bottom-0 z-30 px-4 flex items-center shadow-[4px_0_10px_rgba(0,0,0,0.1)]"
          style={{ backgroundColor: ticker.backgroundColor || '#c8a951' }}
        >
          <div className="bg-red-600 flex items-center px-2 py-0.5 rounded text-white mr-2">
             <Megaphone className="w-3 h-3 mr-1 animate-pulse" />
             <span className="font-bold text-[10px] uppercase tracking-tighter">Live</span>
          </div>
        </div>
        
        {/* The "Snake" Track */}
        <div className="flex items-center w-full overflow-hidden h-full">
          <div className="ticker-track">
            {/* Component for the message block */}
            <TickerMessage ticker={ticker} />
            {/* Identical copy for seamless looping */}
            <TickerMessage ticker={ticker} />
          </div>
        </div>

        {/* Close Button: Stationary */}
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute right-0 top-0 bottom-0 z-30 px-3 flex items-center hover:brightness-90 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.1)]"
          style={{ backgroundColor: ticker.backgroundColor || '#c8a951' }}
        >
          <X className="w-4 h-4 text-[#1a2744]" />
        </button>
      </div>
    </>
  );
}

// Sub-component to keep the message consistent
function TickerMessage({ ticker }) {
  return (
    <span 
      className="text-sm font-bold uppercase tracking-wide flex items-center"
      style={{ color: ticker.textColor || '#1a2744' }}
    >
      <span className="px-8">{ticker.message}</span>
      {/* Decorative separator between loops */}
      <span className="opacity-30">•</span>
    </span>
  );
}