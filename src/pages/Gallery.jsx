import React, { useState, useMemo, useEffect } from "react";
import { apiClient } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Film, FileText, X, AlertTriangle, Play, ChevronLeft, ChevronRight, Download, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Gallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [albumFilter, setAlbumFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [pendingAuthItem, setPendingAuthItem] = useState(null);
  const [loginAlertOpen, setLoginAlertOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) setUser(await apiClient.auth.me());
      } catch (e) {
        console.error("Auth load failed", e);
      }
    };
    loadUser();
  }, []);

  // 1. Defensively fetch gallery items
  const { data: mediaData, isLoading, isError, refetch } = useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const response = await apiClient.entities.MediaItem.filter({}, "-created_date");
      // Safety check: ensure we always return an array even if API wraps it in an object
      return Array.isArray(response) ? response : (response?.data || response?.items || []);
    },
    initialData: [],
  });

  useEffect(() => {
    const watchId = searchParams.get("watch");
    if (watchId && mediaData.length > 0) {
      const index = mediaData.findIndex(m => m.id.toString() === watchId);
      if (index !== -1) setSelectedIndex(index);
    }
  }, [mediaData, searchParams]);

  // 2. Safeguard filtering and album logic
  const media = Array.isArray(mediaData) ? mediaData : [];

  const filtered = useMemo(() => {
    let result = media;
    if (filter !== "all") {
      result = result.filter(m => m.media_type === filter);
    }
    if (albumFilter !== "all") {
      result = result.filter(m => m.album === albumFilter);
    }
    return result;
  }, [media, filter, albumFilter]);

  // Derived data with optional chaining safety
  const albums = useMemo(() => {
    // Only show albums relevant to the current media type filter
    const relevantMedia = filter === 'all' ? media : media.filter(m => m.media_type === filter);
    return [...new Set(relevantMedia.map(m => m?.album).filter(Boolean))];
  }, [media, filter]);

  const selected = selectedIndex !== null ? filtered[selectedIndex] : null;

  const handleClose = () => setSelectedIndex(null);

  const handleNext = (e) => {
    e.stopPropagation();
    if (selectedIndex === null) return;
    setSelectedIndex((prevIndex) => (prevIndex + 1) % filtered.length);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (selectedIndex === null) return;
    setSelectedIndex((prevIndex) => (prevIndex - 1 + filtered.length) % filtered.length);
  };

  const handleItemClick = (index, item) => {
    if (item.media_type === 'video' && !user) {
      setPendingAuthItem(item);
      setLoginAlertOpen(true);
    } else {
      setSelectedIndex(index);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f2]">
      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Our Memories</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Media Gallery</h1>
        </div>
      </section>

      <AlertDialog open={loginAlertOpen} onOpenChange={setLoginAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign in Required</AlertDialogTitle>
            <AlertDialogDescription>You need to be signed in to watch videos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/auth", { state: { from: { pathname: location.pathname, search: `?watch=${pendingAuthItem?.id}` } } })}>Sign In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters */}
      <section className="py-8 px-4 lg:px-8 border-b bg-white sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <Tabs value={filter} onValueChange={(v) => {
            setFilter(v);
            setAlbumFilter("all"); // Reset album filter when media type changes
          }}>
            <TabsList className="bg-[#faf8f2]">
              <TabsTrigger value="all">All Items</TabsTrigger>
              <TabsTrigger value="photo" className="gap-2">
                <ImageIcon className="w-4 h-4" /> Photos
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Film className="w-4 h-4" /> Videos
              </TabsTrigger>
              <TabsTrigger value="audio" className="gap-2">
                <Music className="w-4 h-4" /> Audio
              </TabsTrigger>
              <TabsTrigger value="document" className="gap-2">
                <FileText className="w-4 h-4" /> Docs
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {albums.length > 0 && (
            <Tabs value={albumFilter} onValueChange={setAlbumFilter}>
              <TabsList className="bg-[#faf8f2] flex-wrap h-auto">
                <TabsTrigger value="all">All Albums</TabsTrigger>
                {albums.map(album => <TabsTrigger key={album} value={album}>{album}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          )}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-12 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {isError ? (
            <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900">Failed to load gallery</h3>
              <Button onClick={() => refetch()} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">No media found</h3>
              <p className="text-sm text-gray-400 mt-1">Try changing your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleItemClick(i, item)}
                  className="group cursor-pointer relative"
                >
                  <div className="aspect-square rounded-xl overflow-hidden relative bg-gray-100 shadow-sm">
                    {item.media_type === 'photo' && (
                      <img 
                        src={item.file_url} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                    )}
                    {item.media_type === 'video' && (
                      <video src={item.file_url} className="w-full h-full object-cover" />
                    )}
                    {item.media_type === 'audio' && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 relative">
                        {item.cover_image_url ? (
                          <img src={item.cover_image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                        ) : (
                          <Music className="w-16 h-16 text-slate-400 z-10" />
                        )}
                      </div>
                    )}
                    {item.media_type === 'document' && (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-50 group-hover:bg-slate-100 transition-colors">
                        <FileText className="w-16 h-16 text-slate-300 group-hover:text-[#c8a951] transition-colors" />
                        <p className="mt-2 text-xs text-slate-500 font-medium truncate w-full text-center">{item.title}</p>
                      </div>
                    )}
                    
                    {/* Play Icon for Videos */}
                    {(item.media_type === "video" || item.media_type === "audio") && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="bg-white/90 p-2 rounded-full shadow-lg">
                          <Play className="w-5 h-5 text-[#1a2744] fill-current" />
                        </div>
                      </div>
                    )}

                    {/* Hover Info Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white text-sm font-bold truncate">{item.title}</p>
                        {item.album && <p className="text-[#c8a951] text-[10px] font-semibold uppercase">{item.album}</p>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox / Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <button 
              className="absolute top-6 right-6 text-white hover:text-[#c8a951] transition-colors z-[110]" 
              onClick={handleClose}
            >
              <X className="w-10 h-10" />
            </button>

            {/* Prev Button */}
            <button onClick={handlePrev} className="absolute left-4 md:left-10 text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-[110]">
              <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Next Button */}
            <button onClick={handleNext} className="absolute right-4 md:right-10 text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-[110]">
              <ChevronRight className="w-8 h-8" />
            </button>

            <motion.div
              key={selectedIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              {selected.media_type === "video" ? (
                <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
                  <video 
                    src={selected.file_url}
                    controls 
                    autoPlay 
                    className="w-full h-full"
                  />
                </div>
              ) : selected.media_type === "audio" ? (
                <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                  {selected.cover_image_url ? (
                    <img src={selected.cover_image_url} alt={selected.title} className="w-64 h-64 object-cover rounded-xl shadow-md mb-6" />
                  ) : (
                    <div className="w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center mb-6"><Music className="w-24 h-24 text-slate-300" /></div>
                  )}
                  <audio src={selected.file_url} controls autoPlay className="w-full" />
                </div>
              ) : selected.media_type === "document" ? (
                <div className="w-full h-[80vh] bg-white rounded-lg overflow-hidden">
                  <iframe src={selected.file_url} className="w-full h-full" title={selected.title}></iframe>
                </div>
              ) : (
                <img 
                  src={selected.file_url} 
                  alt={selected.title} 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" 
                />
              )}
              
              <div className="text-center mt-6 px-4">
                <h3 className="text-[#c8a951] text-xl font-serif font-bold">{selected.title}</h3>
                {selected.description && (
                  <p className="text-white/70 text-sm mt-2 max-w-2xl mx-auto">{selected.description}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                  {selected.album && (
                    <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs text-white/50">
                      Album: {selected.album}
                    </span>
                  )}
                  <a href={selected.file_url} download={selected.title || 'download'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 px-4 py-2 bg-[#c8a951] text-[#1a2744] font-semibold rounded-lg hover:bg-[#b89941] transition-colors text-sm">
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}