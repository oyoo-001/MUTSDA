import React, { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const Viewer = ({ streamId = 'default' }) => {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:4000'); // Adjust URL to your server

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('candidate', streamId, event.candidate);
      }
    };

    socketRef.current.emit('watcher', streamId);

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
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [streamId]);

  return (
    <div className="viewer-container">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        controls 
        className="w-full h-auto bg-black rounded shadow-lg"
      ></video>
    </div>
  );
};

export default Viewer;