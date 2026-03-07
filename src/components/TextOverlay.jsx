import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/api/base44Client';
import { motion, AnimatePresence } from "framer-motion";

const hexToRgba = (hex, alpha = 1) => {
  if (!hex || !/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    if (typeof hex === 'string' && hex.startsWith('rgb')) return hex;
    return 'transparent';
  }
  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = '0x' + c.join('');
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${alpha})`;
};

export default function TextOverlay() {
  const [state, setState] = useState({ text: "", fontSize: 32, isVisible: false, isFullScreen: false, backgroundImage: "", backgroundColor: "", backgroundOpacity: 1 });

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('text_overlay_update', (newState) => {
      setState(prev => ({ ...prev, ...newState }));
    });
    return () => socket.disconnect();
  }, []);

  if (!state.isVisible || !state.text) return null;

  const getFontSizeClass = (text) => {
    const len = text.length;
    if (len < 50) return "text-4xl md:text-6xl lg:text-7xl";
    if (len < 100) return "text-3xl md:text-5xl lg:text-6xl";
    if (len < 200) return "text-2xl md:text-4xl lg:text-5xl";
    return "text-xl md:text-3xl lg:text-4xl";
  };

  const finalBackgroundColor = hexToRgba(state.backgroundColor, state.backgroundOpacity ?? 1);

  return (
    <div 
      className="absolute inset-0 z-40 flex items-center justify-center text-center transition-all duration-500 p-12"
      style={{ backgroundColor: state.backgroundImage ? 'transparent' : finalBackgroundColor }}
    >
      <AnimatePresence>
        {state.backgroundImage && (
          <motion.div
            key={state.backgroundImage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[-2] bg-cover bg-center"
            style={{ backgroundImage: `url(${state.backgroundImage})` }}
          />
        )}
      </AnimatePresence>
      {state.backgroundImage && (
        <div className="absolute inset-0 z-[-1]" style={{ backgroundColor: finalBackgroundColor }} />
      )}
      <AnimatePresence mode="wait">
      <motion.p 
        key={state.text}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }} 
        className={`font-serif font-medium text-white drop-shadow-lg max-w-6xl mx-auto ${getFontSizeClass(state.text)}`}
      >
        {state.text}
      </motion.p>
      </AnimatePresence>
    </div>
  );
}