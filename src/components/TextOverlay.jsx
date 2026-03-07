import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/api/base44Client';
import { motion, AnimatePresence } from "framer-motion";

export default function TextOverlay() {
  const [state, setState] = useState({ text: "", fontSize: 32, isVisible: false, isFullScreen: false, backgroundImage: "", backgroundColor: "" });

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('text_overlay_update', (newState) => {
      setState(prev => ({ ...prev, ...newState }));
    });
    return () => socket.disconnect();
  }, []);

  if (!state.isVisible || !state.text) return null;

  return (
    <div 
      className={`absolute inset-0 z-40 flex items-center justify-center text-center transition-all duration-500 ${
        state.isFullScreen 
          ? 'p-12' 
          : 'top-auto bottom-12 bg-black/60 p-6 backdrop-blur-sm'
      }`}
      style={state.isFullScreen ? { backgroundColor: state.backgroundColor || (state.backgroundImage ? 'transparent' : '#1a2744') } : {}}
    >
      <AnimatePresence>
        {state.isFullScreen && state.backgroundImage && (
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
      {state.isFullScreen && state.backgroundImage && (
        <div className="absolute inset-0 bg-black/50 z-[-1]" />
      )}
      <AnimatePresence mode="wait">
      <motion.p 
        key={state.text}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        style={{ fontSize: `${state.fontSize}px`, lineHeight: 1.5, whiteSpace: 'pre-wrap' }} 
        className="font-serif font-medium text-white drop-shadow-lg max-w-4xl mx-auto"
      >
        {state.text}
      </motion.p>
      </AnimatePresence>
    </div>
  );
}