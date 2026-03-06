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
      if (typeof tickerState === 'object' && tickerState !== null) {
        setTicker(tickerState);
        setIsVisible(!!tickerState.message);
      } else { // Fallback for old string-based message
        setTicker({ message: tickerState, textColor: "#1a2744", backgroundColor: "#c8a951" });
        setIsVisible(!!tickerState);
      }
    });
    return () => socket.disconnect();
  }, []);

  if (!ticker.message || !isVisible) return null;

  return (
    <div 
      className="text-[#1a2744] relative overflow-hidden h-10 flex items-center border-b border-[#b89941]"
      style={{ backgroundColor: ticker.backgroundColor || '#c8a951' }}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 z-20 px-4 flex items-center shadow-[4px_0_10px_rgba(0,0,0,0.1)]"
        style={{ backgroundColor: ticker.backgroundColor || '#c8a951' }}
      >
        <Megaphone className="w-4 h-4 mr-2 animate-pulse" />
        <span className="font-bold text-xs uppercase tracking-wider">News</span>
      </div>
      
      <div className="flex items-center w-full overflow-hidden">
        <div className="whitespace-nowrap animate-marquee pl-[100%]">
          <span 
            className="mx-4 text-sm font-medium inline-block"
            style={{ color: ticker.textColor || '#1a2744' }}
          >{ticker.message}</span>
        </div>
      </div>

      <button 
        onClick={() => setIsVisible(false)}
        className="absolute right-0 top-0 bottom-0 z-20 px-3 flex items-center hover:brightness-90 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.1)]"
        style={{ backgroundColor: ticker.backgroundColor || '#c8a951' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}