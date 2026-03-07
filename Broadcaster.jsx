import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Radio, Video, VideoOff, Mic, MicOff, Settings, MonitorPlay, RefreshCw, Camera, Users, Disc, Square, AlertTriangle, Monitor, ZoomIn, Type, Maximize, Minimize, Eye, EyeOff, Send, X, Zap, ZapOff, Upload, Palette, Search, Loader2 } from 'lucide-react';
import { SOCKET_URL } from './src/api/base44Client';
import Viewer from './src/components/Viewer';
import NewsTicker from './src/components/NewsTicker';
import TextOverlay from './src/components/TextOverlay';
import { apiClient } from './src/api/base44Client';
import { toast } from "sonner";

const PRESET_VERSES = [
  { label: "Select a preset...", text: "" },
  { label: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life." },
  { label: "Psalm 23:1", text: "The Lord is my shepherd, I lack nothing." },
  { label: "Philippians 4:13", text: "I can do all this through him who gives me strength." },
  { label: "Jeremiah 29:11", text: "\"For I know the plans I have for you,\" declares the Lord, \"plans to prosper you and not to harm you, plans to give you hope and a future.\"" },
  { label: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose." },
  { label: "Welcome", text: "Welcome to our Live Service! We are glad you are here." },
  { label: "Starting Soon", text: "The service will begin shortly. Please stay tuned." },
  { label: "Benediction", text: "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you." }
];

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const Broadcaster = ({ streamId = 'default' }) => {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [permissionError, setPermissionError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [zoomSettings, setZoomSettings] = useState(null);
  const [textOverlay, setTextOverlay] = useState({ text: "", fontSize: 32, isVisible: false, isFullScreen: false, backgroundImage: "", backgroundColor: "#1a2744" });
  const [draftOverlay, setDraftOverlay] = useState({ text: "", fontSize: 32, isVisible: false, isFullScreen: false, backgroundImage: "", backgroundColor: "#1a2744" });
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [verseQuery, setVerseQuery] = useState("");
  const [isFetchingVerse, setIsFetchingVerse] = useState(false);
  const [verseTranslation, setVerseTranslation] = useState("kjv");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnections = useRef({});
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      
      // Select the first camera if none is selected, or if the selected one is no longer available
      if (videoDevices.length > 0) {
        const currentExists = videoDevices.find(d => d.deviceId === selectedCamera);
        if (!selectedCamera || !currentExists) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      }
    } catch (error) {
      console.error("Error enumerating devices:", error);
    }
  };

  useEffect(() => {
    getCameras();

    // Listen for external camera connections/disconnections
    navigator.mediaDevices.addEventListener('devicechange', getCameras);

    // Cleanup on unmount
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getCameras);
      stopStream();
    };
  }, []);

  // Check for existing streams on mount and updates
  useEffect(() => {
    const statusSocket = io(SOCKET_URL);
    
    statusSocket.on('connect', () => {
      statusSocket.emit('get_live_streams');
    });

    statusSocket.on('live_streams_update', (streams) => {
      // If streamId is active but WE are not streaming, then someone else is.
      if (streams.includes(streamId) && !isStreaming) {
        setRemoteStreamActive(true);
      } else if (!isStreaming) {
        setRemoteStreamActive(false);
      }
    });

    // Sync initial text overlay state
    statusSocket.on('text_overlay_update', (state) => {
      // Only update if we are not the ones actively editing (simple check)
      // For a single admin broadcaster, this ensures we start with server state
      setTextOverlay(prev => ({ ...prev, ...state }));
      setDraftOverlay(prev => {
        if (!prev.text && !prev.isVisible) return { ...prev, ...state };
        return prev;
      });
    });

    return () => statusSocket.disconnect();
  }, [streamId, isStreaming]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const checkTorchCapability = (stream) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    // Check if torch is supported
    if (capabilities.torch) {
      setHasTorch(true);
    }
  };

  const updateZoomCapabilities = (stream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const capabilities = videoTrack.getCapabilities();
    const settings = videoTrack.getSettings();

    if (capabilities.zoom) {
      setZoomSettings({
        min: capabilities.zoom.min,
        max: capabilities.zoom.max,
        step: capabilities.zoom.step,
        value: settings.zoom || capabilities.zoom.min
      });
    } else {
      setZoomSettings(null);
    }
  };

  const enableCamera = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      updateZoomCapabilities(stream);
      checkTorchCapability(stream);
      setIsCameraActive(true);
      setAudioEnabled(true);
      setVideoEnabled(true);
      
      // Refresh devices to get labels now that permissions are granted
      getCameras();
    } catch (error) {
      console.error("Error accessing camera:", error);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setPermissionError("Camera and microphone access was denied. Please allow permissions in your browser settings to continue.");
      } else {
        setPermissionError("Could not access camera. Please ensure it is not in use by another application and that permissions are granted.");
      }
    }
  };

  const startStream = () => {
    if (!streamRef.current) return;

    try {

      // Connect to signaling server
      socketRef.current = io(SOCKET_URL);
      socketRef.current.emit('broadcaster', streamId);

      socketRef.current.on('viewer_count', (count) => {
        setViewerCount(count);
      });

      socketRef.current.on('watcher', (id) => {
        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnections.current[id] = peerConnection;

        streamRef.current.getTracks().forEach(track => peerConnection.addTrack(track, streamRef.current));

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit('candidate', id, event.candidate);
          }
        };

        peerConnection.createOffer()
          .then(sdp => peerConnection.setLocalDescription(sdp))
          .then(() => {
            socketRef.current.emit('offer', id, peerConnection.localDescription);
          });
      });

      socketRef.current.on('answer', (id, description) => {
        if (peerConnections.current[id]) {
          peerConnections.current[id].setRemoteDescription(description);
        }
      });

      socketRef.current.on('candidate', (id, candidate) => {
        if (peerConnections.current[id]) {
          peerConnections.current[id].addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socketRef.current.on('disconnectPeer', (id) => {
        if (peerConnections.current[id]) {
          peerConnections.current[id].close();
          delete peerConnections.current[id];
        }
      });

      setIsStreaming(true);
    } catch (error) {
      console.error("Error starting stream:", error);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    
    setIsStreaming(false);
    setIsCameraActive(false);
    setViewerCount(0);
    setPermissionError(null);
    if (isRecording) stopRecording();
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    try {
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? { mimeType: 'video/webm;codecs=vp9' } 
        : { mimeType: 'video/webm' };

      const recorder = new MediaRecorder(streamRef.current, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = `mutsda-stream-${new Date().toISOString()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
      };

      recorder.start();
      setIsRecording(true);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not start recording. Browser might not support it.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && hasTorch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !isTorchOn }]
          });
          setIsTorchOn(!isTorchOn);
        } catch (err) {
          console.error("Torch toggle failed", err);
          toast.error("Failed to toggle flashlight");
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      
      screenTrack.onended = () => {
        if (isScreenSharing) stopScreenShare();
      };

      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.stop();
            streamRef.current.removeTrack(videoTrack);
        }
        streamRef.current.addTrack(screenTrack);
        
        if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });
      }
      setIsScreenSharing(true);
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined }
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      if (streamRef.current) {
        const screenTrack = streamRef.current.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            streamRef.current.removeTrack(screenTrack);
        }
        streamRef.current.addTrack(cameraTrack);

        if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });
      }
      setIsScreenSharing(false);
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const handleCameraChange = async (e) => {
    const deviceId = e.target.value;
    setSelectedCamera(deviceId);

    if (isCameraActive && streamRef.current) {
      try {
        // Stop the old track first to release hardware resources (crucial for mobile)
        const oldVideoTrack = streamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          streamRef.current.removeTrack(oldVideoTrack);
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { deviceId: { exact: deviceId } }
        });
        const newVideoTrack = newStream.getVideoTracks()[0];

        streamRef.current.addTrack(newVideoTrack);
        
        if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
        updateZoomCapabilities(newStream);
        setHasTorch(false); // Reset and check again
        checkTorchCapability(newStream);

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }
        });

        setIsScreenSharing(false);
        setVideoEnabled(true);
      } catch (err) {
        console.error("Failed to switch camera", err);
        toast.error("Failed to switch camera");
      }
    }
  };

  const handleZoom = async (e) => {
    const value = parseFloat(e.target.value);
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && zoomSettings) {
        try {
          await videoTrack.applyConstraints({ advanced: [{ zoom: value }] });
          setZoomSettings(prev => ({ ...prev, value }));
        } catch (err) {
          console.error("Zoom failed", err);
        }
      }
    }
  };

  const updateDraftOverlay = (updates) => {
    setDraftOverlay(prev => ({ ...prev, ...updates }));
  };

  const handleGoLive = () => {
    setTextOverlay(draftOverlay);
    const socket = socketRef.current || io(SOCKET_URL);
    socket.emit('admin_update_text_overlay', draftOverlay);
    if (!socketRef.current) socket.disconnect();
    toast.success("Text overlay updated live!");
  };

  const handleSyncFromLive = () => {
    setDraftOverlay(textOverlay);
    toast.info("Draft synced from live settings");
  };

  const handleClearOverlay = () => {
    const clearedState = { ...draftOverlay, text: "", isVisible: false };
    setDraftOverlay(clearedState);
    setTextOverlay(clearedState);
    
    const socket = socketRef.current || io(SOCKET_URL);
    socket.emit('admin_update_text_overlay', clearedState);
    if (!socketRef.current) socket.disconnect();
    toast.success("Overlay cleared!");
  };

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      toast.info("Uploading background...");
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
      updateDraftOverlay({ backgroundImage: file_url });
      toast.success("Background uploaded!");
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload background");
    }
  };

  const handleFetchVerse = async () => {
    if (!verseQuery) return;
    setIsFetchingVerse(true);
    try {
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(verseQuery)}?translation=${verseTranslation}`);
      const data = await response.json();
      if (data.error || !data.text) {
        toast.error("Verse not found.");
      } else {
        updateDraftOverlay({ text: `${data.text.trim()}\n\n(${data.reference} ${verseTranslation.toUpperCase()})` });
        toast.success("Verse loaded!");
      }
    } catch (error) {
      toast.error("Failed to fetch verse.");
    } finally {
      setIsFetchingVerse(false);
    }
  };

  const handleVerseQueryChange = (e) => {
    const value = e.target.value;
    setVerseQuery(value);

    if (value) {
      const filtered = BIBLE_BOOKS.filter(book => 
        book.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (book) => {
    setVerseQuery(book + " ");
    setShowSuggestions(false);
  };

  if (remoteStreamActive) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-3xl mx-auto">
        <div className="p-4 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Stream in Progress
          </h2>
          <span className="text-xs text-amber-700 font-medium">Another admin is currently streaming. You can watch below.</span>
        </div>
        <div className="p-6">
          <Viewer streamId={streamId} isBroadcasting={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {/* LEFT COLUMN: Stream Manager */}
      <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1a2744] flex items-center gap-2">
            <Radio className={`w-5 h-5 ${isStreaming ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
            Live Stream Manager
          </h2>
        {isStreaming && (
          <div className="flex items-center gap-3">
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-blue-200">
              <Users className="w-3 h-3" />
              {viewerCount} Watching
            </span>
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-red-200">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> LIVE
            </span>
            <button 
              onClick={toggleAudio}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${audioEnabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
            >
              {audioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {audioEnabled ? 'Mic On' : 'Mic Muted'}
            </button>
          </div>
        )}
        </div>
        <div className="p-6">
        {/* Camera Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Source Camera
          </label>
          <div className="flex gap-2">
            <select 
              className="flex-1 block w-full py-2.5 px-3 border border-slate-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c8a951] focus:border-[#c8a951] sm:text-sm transition-all"
              value={selectedCamera} 
              onChange={handleCameraChange}
            >
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Camera ${cam.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
            <button 
              onClick={getCameras} 
              className="p-2.5 text-slate-500 hover:text-[#1a2744] hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh Devices"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Preview */}
        <div ref={containerRef} className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-inner mb-6 group">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className={`w-full h-full object-cover ${!isCameraActive && 'opacity-50'}`}
          ></video>
          
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <NewsTicker />
            <TextOverlay />
          </div>

          {!isCameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-slate-500 flex flex-col items-center">
                <MonitorPlay className="w-12 h-12 mb-2 opacity-50" />
                <span className="text-sm font-medium">Camera Offline</span>
              </div>
            </div>
          )}

          {/* Controls Overlay */}
          {isCameraActive && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-sm p-2 rounded-full border border-white/10 z-20">
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Disc className="w-5 h-5" />}
              </button>
              {hasTorch && (
                <button 
                  onClick={toggleTorch}
                  className={`p-3 rounded-full transition-all ${isTorchOn ? 'bg-yellow-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                  title="Toggle Flashlight"
                >
                  {isTorchOn ? <ZapOff className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </button>
              )}
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button 
                onClick={toggleScreenShare}
                className={`p-3 rounded-full transition-all ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              >
                <Monitor className="w-5 h-5" />
              </button>
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-all ${videoEnabled ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500/80 hover:bg-red-600/80 text-white'}`}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              <button 
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-all ${audioEnabled ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500/80 hover:bg-red-600/80 text-white'}`}
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button 
                onClick={toggleFullscreen}
                className="p-3 rounded-full transition-all bg-white/20 hover:bg-white/30 text-white"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>

        {/* Zoom Control (Moved Outside) */}
        {isCameraActive && zoomSettings && (
          <div className="mb-6 flex items-center justify-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <ZoomIn className="w-5 h-5 text-[#c8a951]" />
              <span>Camera Zoom</span>
            </div>
            <input 
              type="range" 
              min={zoomSettings.min} 
              max={zoomSettings.max} 
              step={zoomSettings.step} 
              value={zoomSettings.value} 
              onChange={handleZoom}
              className="w-full max-w-xs h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#c8a951]"
            />
            <span className="text-sm font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 min-w-[3rem] text-center">{zoomSettings.value.toFixed(1)}x</span>
          </div>
        )}

        {/* Main Action Button */}
        {!isCameraActive ? (
          <button 
            onClick={enableCamera} 
            className="w-full bg-[#1a2744] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#1a2744]/90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" /> Enable Camera & Microphone
          </button>
        ) : !isStreaming ? (
          <button 
            onClick={startStream} 
            className="w-full bg-[#c8a951] text-[#1a2744] font-bold py-3 px-4 rounded-lg hover:bg-[#b89941] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Radio className="w-5 h-5" /> Start Live Broadcast
          </button>
        ) : (
          <button 
            onClick={stopStream} 
            className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Radio className="w-5 h-5" /> End Broadcast
          </button>
        )}
        </div>
      </div>

      {/* RIGHT COLUMN: Text Overlay Manager */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1a2744] flex items-center gap-2">
            <Type className="w-5 h-5" /> Text Overlay
          </h3>
          <button onClick={handleSyncFromLive} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Sync
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <select 
              value={verseTranslation}
              onChange={(e) => setVerseTranslation(e.target.value)}
              className="w-32 p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#c8a951] focus:border-transparent bg-slate-50"
            >
              <option value="kjv">English</option>
              <option value="swahili">Swahili</option>
              <option value="luo">Luo</option>
            </select>
            <div className="relative flex-1">
              <input 
                type="text" 
                value={verseQuery}
                onChange={handleVerseQueryChange}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchVerse()}
                placeholder="Search verse (e.g. John 3:16)"
                className="w-full p-2 pr-8 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#c8a951] focus:border-transparent"
              />
              {verseQuery && (
                <button 
                  onClick={() => { setVerseQuery(""); setShowSuggestions(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {showSuggestions && (
                <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {suggestions.map(book => (
                    <li key={book} onClick={() => selectSuggestion(book)} className="p-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700">
                      {book}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <button onClick={handleFetchVerse} disabled={isFetchingVerse} className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors">
              {isFetchingVerse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          <select 
            className="w-full p-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#c8a951] focus:border-transparent"
            onChange={(e) => {
              const val = e.target.value;
              if (val) updateDraftOverlay({ text: val });
            }}
          >
            {PRESET_VERSES.map((p, i) => (
              <option key={i} value={p.text}>{p.label}</option>
            ))}
          </select>
          
          <textarea
            value={draftOverlay.text}
            onChange={(e) => updateDraftOverlay({ text: e.target.value })}
            placeholder="Enter Bible verse or song lyrics here..."
            className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#c8a951] focus:border-transparent min-h-[120px]"
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium w-12">Size</span>
              <input 
                type="range" 
                min="16" 
                max="72" 
                value={draftOverlay.fontSize} 
                onChange={(e) => updateDraftOverlay({ fontSize: parseInt(e.target.value) })}
                className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#c8a951]"
              />
              <span className="text-xs text-slate-500 w-8 text-right">{draftOverlay.fontSize}px</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateDraftOverlay({ isFullScreen: !draftOverlay.isFullScreen })}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${draftOverlay.isFullScreen ? 'bg-[#1a2744] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {draftOverlay.isFullScreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />} Full Screen
              </button>
              <button
                onClick={() => updateDraftOverlay({ isVisible: !draftOverlay.isVisible })}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${draftOverlay.isVisible ? 'bg-green-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {draftOverlay.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} {draftOverlay.isVisible ? 'Showing' : 'Hidden'}
              </button>
            </div>

            {draftOverlay.isFullScreen && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Background Color</span>
                  <input type="color" value={draftOverlay.backgroundColor || "#1a2744"} onChange={(e) => updateDraftOverlay({ backgroundColor: e.target.value })} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Background Image</span>
                  <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#c8a951]/10 file:text-[#c8a951] hover:file:bg-[#c8a951]/20" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              onClick={handleClearOverlay}
              className="flex-1 bg-red-50 text-red-600 font-bold py-2.5 px-4 rounded-lg hover:bg-red-100 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <X className="w-4 h-4" /> Clear
            </button>
            <button 
              onClick={handleGoLive}
              className="flex-[2] bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Send className="w-4 h-4" /> Go Live
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Broadcaster;