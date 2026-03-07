import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../api/base44Client';
import { Maximize2, Minimize2, Volume2, VolumeX, Users, Radio, Loader2, PictureInPicture2 } from 'lucide-react';
import NewsTicker from './NewsTicker';
import TextOverlay from './TextOverlay';

const Viewer = ({ streamId = 'default', isBroadcasting = true, offlineMessage = "Stream Offline" }) => {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [status, setStatus] = useState('connecting'); // connecting, live, offline

  useEffect(() => {
    if (!isBroadcasting) {
      setStatus('offline');
      return;
    }

    socketRef.current = io(SOCKET_URL);
    
    socketRef.current.on('viewer_count', (count) => {
        setViewerCount(count);
    });

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setStatus('live');
      }
    };
    
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setStatus('offline');
        } else if (pc.connectionState === 'connected') {
            setStatus('live');
        }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('candidate', streamId, event.candidate);
      }
    };

    socketRef.current.on('offer', (id, description) => {
      pc.setRemoteDescription(description)
        .then(() => pc.createAnswer())
        .then((sdp) => pc.setLocalDescription(sdp))
        .then(() => {
          socketRef.current.emit('answer', id, pc.localDescription);
        });
    });

    socketRef.current.on('candidate', (id, candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error(e));
    });

    socketRef.current.on('broadcaster', () => {
      socketRef.current.emit('watcher', streamId);
    });

    socketRef.current.on('disconnectPeer', () => {
      if (videoRef.current) videoRef.current.srcObject = null;
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      setStatus('offline');
    });

    socketRef.current.emit('watcher', streamId);

    // Heartbeat watchdog: Tell server we are still watching every 15 seconds
    const heartbeatInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('stream_heartbeat', streamId);
      }
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [streamId, isBroadcasting]);

  const toggleMute = () => {
      if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
      }
  };

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          videoRef.current.parentElement.requestFullscreen().catch(err => {
              console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
          });
          setIsFullscreen(true);
      } else {
          document.exitFullscreen();
          setIsFullscreen(false);
      }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;

    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(err => console.error(err));
    } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture().catch(err => {
            console.error(`Error attempting to enable PiP mode: ${err.message} (${err.name})`);
        });
    }
  };

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className={`relative group overflow-hidden bg-black rounded-xl shadow-2xl aspect-video ${isFullscreen ? 'w-full h-full' : 'w-full'}`}>
      {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900 text-white">
              <div className="flex flex-col items-center animate-pulse">
                  <Loader2 className="w-10 h-10 mb-3 text-[#c8a951] animate-spin" />
                  <span className="text-sm font-medium tracking-wider">CONNECTING TO LIVE STREAM...</span>
              </div>
          </div>
      )}
      {status === 'offline' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900 text-white">
              <div className="flex flex-col items-center">
                  <Radio className="w-12 h-12 mb-2 text-gray-600" />
                  <span className="text-sm font-medium text-gray-400">{offlineMessage}</span>
              </div>
          </div>
      )}
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className="w-full h-full object-cover"
      ></video>

      {/* News Ticker Overlay - High Z-Index to ensure visibility */}
      <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
        <NewsTicker />
        <TextOverlay />
      </div>

      {/* Overlay Controls */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 z-40 pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
            <div className="flex items-center gap-2">
                 <button onClick={toggleMute} className="text-white hover:text-[#c8a951] transition-colors p-2 rounded-full hover:bg-white/10 bg-black/20 backdrop-blur-sm">
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5 shadow-lg">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                </div>
                {status === 'live' && (
                    <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5 border border-white/10">
                        <Users className="w-3 h-3 text-[#c8a951]" /> {viewerCount}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
              {document.pictureInPictureEnabled && (
                <button onClick={togglePiP} className="text-white hover:text-[#c8a951] transition-colors p-2 rounded-full hover:bg-white/10 bg-black/20 backdrop-blur-sm" title="Picture-in-Picture">
                    <PictureInPicture2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={toggleFullscreen} className="text-white hover:text-[#c8a951] transition-colors p-2 rounded-full hover:bg-white/10 bg-black/20 backdrop-blur-sm" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Viewer;
