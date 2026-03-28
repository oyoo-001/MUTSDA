import React, { useState, useEffect, useRef, useMemo, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, LogIn, Users, X, Lock, Hash, MessageSquare, LogOut,
  Paperclip, Smile, Image as ImageIcon, FileVideo, Trash2, FileText,
  Music, Download, Reply, Pencil, Bot, Sparkles, RefreshCw, ChevronDown, Search,
  MessageCircle, ArrowLeft,
  Share2, Copy,
} from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import io from 'socket.io-client';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Media renderer ────────────────────────────────────────────────────────────
const MessageMedia = ({ message, onMediaClick }) => {
  if (!message.media_url) return null;

  const getAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    try {
      const serverUrl = new URL(SOCKET_URL);
      return `${serverUrl.origin}${url}`;
    } catch (e) {
      return url;
    }
  };

  const absoluteMediaUrl = getAbsoluteUrl(message.media_url);
  const isAudio    = message.media_type?.startsWith('audio/');
  const isVideo    = message.media_type?.startsWith('video/');
  const isImage    = message.media_type?.startsWith('image/');
  const isDocument = !isAudio && !isVideo && !isImage;

  if (isImage) {
    return (
      <div 
        className="relative group max-w-xs my-1 rounded-lg overflow-hidden border bg-slate-50 shadow-sm cursor-pointer"
        onClick={() => onMediaClick?.({ url: absoluteMediaUrl, type: 'image', filename: message.media_filename })}
      >
        <img src={absoluteMediaUrl} alt={message.media_filename || 'attachment'} className="max-w-full max-h-80 object-cover transition-transform group-hover:scale-105" />
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <p className="text-white text-xs font-bold truncate drop-shadow-md">{message.media_filename || 'Image'}</p>
        </div>
      </div>
    );
  }
  if (isVideo) {
    return (
      <div className="relative max-w-xs my-1 rounded-lg overflow-hidden border bg-black shadow-sm group">
        <video src={absoluteMediaUrl} controls className="w-full max-h-80" />
        <a href={absoluteMediaUrl} download={message.media_filename} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  }
  if (isAudio) {
    return (
      <div className="bg-white border p-3 rounded-lg flex items-center gap-3 max-w-xs my-1 shadow-sm">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
          <Music className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-slate-800">{message.media_filename || 'Audio File'}</p>
          <audio src={absoluteMediaUrl} controls className="w-full h-8 mt-2" />
        </div>
        <a href={absoluteMediaUrl} download={message.media_filename} target="_blank" rel="noopener noreferrer">
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100">
            <Download className="w-4 h-4" />
          </Button>
        </a>
      </div>
    );
  }
  if (isDocument) {
    return (
      <div 
        onClick={() => onMediaClick?.({ url: absoluteMediaUrl, type: 'document', filename: message.media_filename })}
        className="block bg-white border p-3 rounded-lg flex items-center gap-3 max-w-xs my-1 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-slate-800">{message.media_filename || 'File'}</p>
          <p className="text-xs text-slate-500">Click to view document</p>
        </div>
        <Download className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
    );
  }
  return null;
};

// ── Role badge ────────────────────────────────────────────────────────────────
const getRoleBadgeClass = (role) => {
  const roleMap = {
    admin: "bg-red-600 text-white",
    pastor: "bg-purple-600 text-white",
    elder: "bg-amber-600 text-white",
    deacon: "bg-blue-600 text-white",
    deaconese: "bg-pink-600 text-white",
    members: "bg-green-600 text-white",
    default: "bg-gray-600 text-white",
  };
  const normalizedRole = role?.toLowerCase().trim() || 'default';
  return roleMap[normalizedRole] || roleMap.default;
};

// ── AI text formatter ─────────────────────────────────────────────────────────
const formatAiText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    if (/^# (.+)/.test(line))   return <p key={lineIdx} className="font-bold text-[#1a2744] text-base mt-3 mb-1">{parseInline(line.replace(/^# /, ''))}</p>;
    if (/^## (.+)/.test(line))  return <p key={lineIdx} className="font-bold text-[#2d5f8a] text-sm mt-2 mb-0.5">{parseInline(line.replace(/^## /, ''))}</p>;
    if (/^### (.+)/.test(line)) return <p key={lineIdx} className="font-semibold text-[#c8a951] text-sm mt-1.5 mb-0.5">{parseInline(line.replace(/^### /, ''))}</p>;
    if (/^> (.+)/.test(line))   return <p key={lineIdx} className="flex gap-2 my-1 bg-amber-50 border-l-4 border-[#c8a951] rounded-r-lg px-3 py-1.5"><span className="text-[#c8a951] font-bold shrink-0">❝</span><span className="text-[#1a2744] italic text-sm">{parseInline(line.replace(/^> /, ''))}</span></p>;
    if (/^[\*\-] (.+)/.test(line)) return <p key={lineIdx} className="flex gap-2 my-0.5"><span className="text-[#c8a951] font-bold mt-0.5 shrink-0">•</span><span>{parseInline(line.replace(/^[\*\-] /, ''))}</span></p>;
    if (line.trim() === '') return <span key={lineIdx} className="block h-1.5" />;
    return <p key={lineIdx} className="my-0.5 leading-relaxed">{parseInline(line)}</p>;
  });
};

const parseInline = (text) => {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) parts.push(<strong key={match.index} className="font-bold text-[#1a2744]">{match[1]}</strong>);
    else if (match[2] !== undefined) parts.push(<em key={match.index} className="italic text-[#2d5f8a]">{match[2]}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
};

// ── DM conversation compositeKey ─────────────────────────────────────────────
const getDmChannelId = (emailA, emailB) => {
  const sorted = [emailA, emailB].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
};

// ── Standardized Reply Layer ───────────────────────────────────────────────
const ReplyPreview = ({ senderName, message, isMe, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      "mb-1.5 p-2 rounded-lg text-[11px] cursor-pointer hover:bg-black/5 transition-all border-l-[3px] animate-in slide-in-from-top-1 duration-200 shadow-sm",
      isMe 
        ? "bg-white/10 border-white/60 text-white/90" 
        : "bg-slate-50 border-[#c8a951] text-slate-500"
    )}
  >
    <p className={cn("font-bold text-[10px] mb-0.5 flex items-center gap-1", isMe ? "text-white" : "text-[#c8a951]")}>{senderName}</p>
    <p className="line-clamp-1 italic opacity-90">{message || "Attachment"}</p>
  </div>
);

// ── Main Chat Component ───────────────────────────────────────────────────────
export default function Chat() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [messagesData, setMessagesData] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeChannel, setActiveChannel] = useState({ id: 'general', name: 'General Fellowship' });
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMobileUsers, setShowMobileUsers] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [viewingProfilePhoto, setViewingProfilePhoto] = useState(null);
  const [fullScreenMedia, setFullScreenMedia] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // ── Mobile Gesture State ──────────────────────────────────────────────────
  const [touchState, setTouchState] = useState({ id: null, startX: 0, startY: 0, currentX: 0, isSwiping: false });
  const [longPressMessage, setLongPressMessage] = useState(null);
  const longPressTimer = useRef(null);

  const handleTouchStart = (e, message) => {
    const touch = e.touches[0];
    setTouchState({
      id: message.id,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      isSwiping: false
    });

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setLongPressMessage(message);
      window.navigator.vibrate?.(50); // Haptic feedback
    }, 600);
  };

  const handleTouchMove = (e) => {
    if (!touchState.id) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = Math.abs(touch.clientY - touchState.startY);

    // If they move vertically more than horizontally, they are scrolling, not swiping
    if (deltaY > Math.abs(deltaX)) {
      clearTimeout(longPressTimer.current);
      return;
    }

    // If moved more than 10px, it's not a long press anymore
    if (Math.abs(deltaX) > 10 || deltaY > 10) {
      clearTimeout(longPressTimer.current);
    }

    // Only allow swiping to the right (positive deltaX) for reply
    if (deltaX > 0) {
      setTouchState(prev => ({ ...prev, currentX: touch.clientX, isSwiping: true }));
    }
  };

  const handleTouchEnd = (message, isDm = false) => {
    clearTimeout(longPressTimer.current);
    const deltaX = touchState.currentX - touchState.startX;

    if (deltaX > 70) {
      // Trigger Reply
      if (isDm) setDmReplyingTo(message);
      else setReplyingTo(message);
      window.navigator.vibrate?.(30);
    }

    setTouchState({ id: null, startX: 0, startY: 0, currentX: 0, isSwiping: false });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard");
    setLongPressMessage(null);
  };
  // ──────────────────────────────────────────────────────────────────────────

  // Scroll behavior state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [dmShowScrollBottom, setDmShowScrollBottom] = useState(false);
  const [aiShowScrollBottom, setAiShowScrollBottom] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  // ── DM state ─────────────────────────────────────────────────────────────────
  const [activeDm, setActiveDm] = useState(null); // { email, full_name, profile_photo_url, role }
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmShowEmoji, setDmShowEmoji] = useState(false);
  const [dmSelectedFile, setDmSelectedFile] = useState(null);
  const [dmPreviewUrl, setDmPreviewUrl] = useState(null);
  const [dmCaption, setDmCaption] = useState("");
  const [dmTypingUsers, setDmTypingUsers] = useState(new Set());
  const [dmReplyingTo, setDmReplyingTo] = useState(null);
  const [dmEditingMessage, setDmEditingMessage] = useState(null);
  const dmBottomRef = useRef(null);
  const dmFileInputRef = useRef(null);
  const dmTypingTimeoutRef = useRef(null);
  const dmIsTypingRef = useRef(false);
  // ─────────────────────────────────────────────────────────────────────────────

  // ── AI Chat state ─────────────────────────────────────────────────────────
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistoryLoaded, setAiHistoryLoaded] = useState(false);
  const [aiShowEmoji, setAiShowEmoji] = useState(false);
  const [aiSelectedFile, setAiSelectedFile] = useState(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState(null);
  const [aiCaption, setAiCaption] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const aiBottomRef = useRef(null);
  const aiInputRef = useRef(null);
  // ─────────────────────────────────────────────────────────────────────────────

  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const bottomRef = useRef(null);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const messages = useMemo(() => Array.isArray(messagesData) ? messagesData : [], [messagesData]);

  const messagesWithSeparators = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    return messages.reduce((acc, message, index) => {
      const messageDate = new Date(message.created_date);
      const prevMessage = messages[index - 1];
      const prevMessageDate = prevMessage ? new Date(prevMessage.created_date) : null;
      if (!prevMessageDate || !isSameDay(messageDate, prevMessageDate)) {
        let label = isToday(messageDate) ? 'Today' : isYesterday(messageDate) ? 'Yesterday' : format(messageDate, 'MMMM d, yyyy');
        acc.push({ isDateSeparator: true, id: `date-${message.id || index}`, label });
      }
      acc.push(message);
      return acc;
    }, []);
  }, [messages]);

  const dmMessagesWithSeparators = useMemo(() => {
    if (!dmMessages || dmMessages.length === 0) return [];
    return dmMessages.reduce((acc, message, index) => {
      const messageDate = new Date(message.created_date);
      const prevMessage = dmMessages[index - 1];
      const prevMessageDate = prevMessage ? new Date(prevMessage.created_date) : null;
      if (!prevMessageDate || !isSameDay(messageDate, prevMessageDate)) {
        let label = isToday(messageDate) ? 'Today' : isYesterday(messageDate) ? 'Yesterday' : format(messageDate, 'MMMM d, yyyy');
        acc.push({ isDateSeparator: true, id: `dm-date-${message.id || index}`, label });
      }
      acc.push(message);
      return acc;
    }, []);
  }, [dmMessages]);

  const sortedMembers = useMemo(() => {
    const onlineSet = new Set(onlineUsers.map(u => u.email));
    const online = allMembers.filter(m => onlineSet.has(m.email));
    const offline = allMembers.filter(m => !onlineSet.has(m.email));
    return [...online, ...offline];
  }, [allMembers, onlineUsers]);

  // ── Auth & Initial Load ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) {
          const userData = await apiClient.auth.me();
          setUser(userData);
          apiClient.entities.ChatGroup.getMyGroups().then(setMyGroups).catch(console.error);
          try {
            let membersData = [];
            if (apiClient.entities.User?.getAll) {
              const result = await apiClient.entities.User.getAll();
              membersData = Array.isArray(result) ? result : (result?.data || result?.items || []);
            }
            if (membersData.length === 0 && apiClient.entities.User?.filter) {
              const result = await apiClient.entities.User.filter({});
              membersData = Array.isArray(result) ? result : (result?.data || result?.items || []);
            }
            if (membersData.length === 0) {
              const result = await apiClient.get('/api/users') || await apiClient.get('/users');
              membersData = Array.isArray(result) ? result : (result?.data || result?.items || []);
            }
            setAllMembers(Array.isArray(membersData) ? membersData : []);
          } catch (err) {
            console.error("Failed to load members:", err);
            setAllMembers([]);
          }
        }
      } catch (e) {
        console.error("Auth load failed", e);
      } finally {
        setLoadingAuth(false);
      }
    };
    load();
  }, []);

  // ── Initialize Socket ─────────────────────────────────────────────────────
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      extraHeaders: { "ngrok-skip-browser-warning": "true" },
      auth: { token: localStorage.getItem('token') }
    });

    socketRef.current.on("online_users_update", (users) => setOnlineUsers(users));

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const fetchHistory = (channelId) => {
    const cacheKey = `chat_cache_${channelId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setMessagesData(JSON.parse(cached));
      } catch (e) { console.error("Cache read error", e); }
    }

    apiClient.entities.ChatMessage.filter({ channel: channelId })
      .then((response) => {
        const data = Array.isArray(response) ? response : (response?.data || response?.items || []);
        const history = [...data].reverse();
        setMessagesData(history);
        sessionStorage.setItem(cacheKey, JSON.stringify(history));
      })
      .catch(err => console.error("Failed to load chat history", err));
  };

  // ── Socket listeners for group/general chat ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = socketRef.current;
    const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
    socket.emit('i_am_online', user);
    socket.emit("join", channelId);
    setMessagesData([]);
    fetchHistory(channelId);

    const handleNewMessage = (msg) => {
      if (msg.channel === channelId) {
        setMessagesData(prev => [...prev, msg]);
        if (msg.sender_email !== user.email) {
          const audio = new Audio("https://res.cloudinary.com/dxzmo0roe/video/upload/v1774549875/koiroylers-live-chat-353605_dro3qx.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
          if (document.hidden && Notification.permission === "granted") {
            new Notification(`New message from ${msg.sender_name}`, { body: msg.message || "Sent an attachment" });
          }
            if (msg.reply_to_sender_name === user.full_name) toast.info(`${msg.sender_name} replied to your message!`);
        }
      } else {
        const groupId = msg.channel.replace('group_', '');
        setUnreadCounts(prev => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1,
        }));
      }
    };

    const handleMessageUpdated = (data) => {
      if (data.channel === channelId) {
        setMessagesData(prev => prev.map(m => m.id === data.id ? { ...m, message: data.message } : m));
      }
    };
    const handleMessageDeleted = (data) => {
      if (data.channel === channelId) {
        setMessagesData(prev => prev.filter(m => m.id !== data.messageId));
      }
    };
    const handleTyping = (data) => {
      if (data.channel === channelId && data.sender_name) {
        setTypingUsers(prev => new Set([...prev, data.sender_name]));
      }
    };
    const handleStopTyping = (data) => {
      if (data.channel === channelId && data.sender_name) {
        setTypingUsers(prev => { const next = new Set(prev); next.delete(data.sender_name); return next; });
      }
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageUpdated", handleMessageUpdated);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
    };
  }, [user, activeChannel]);

  // Scroll monitoring
  const handleScroll = (e, setter) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Show button if user is more than 300px from bottom
    const isAway = scrollHeight - scrollTop - clientHeight > 300;
    setter(isAway);
  };


  // ── DM socket listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeDm) return;
    const socket = socketRef.current;
    const dmChannelId = getDmChannelId(user.email, activeDm.email);

    socket.emit("join", dmChannelId);
    setDmMessages([]);

    // Fetch DM history
    const cacheKey = `dm_cache_${dmChannelId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setDmMessages(JSON.parse(cached));
      } catch (e) { console.error("DM cache read error", e); }
    }

    apiClient.entities.DirectMessage.getHistory(dmChannelId)
    .then((data) => {
      const history = Array.isArray(data) ? data : [];
      setDmMessages(history);
      sessionStorage.setItem(cacheKey, JSON.stringify(history));
    })
      .catch(err => console.error("Failed to load DM history", err));

    const handleDmNewMessage = (msg) => {
      if (msg.channel === dmChannelId) {
        setDmMessages(prev => [...prev, msg]);
        if (msg.sender_email !== user.email && document.hidden && Notification.permission === "granted") {
          new Notification(`New DM from ${msg.sender_name}`, { 
            body: msg.message || "Sent an attachment",
            icon: msg.sender_profile_photo_url || "/church-logo.png"
          });
        }
        if (msg.sender_email !== user.email) {
          const audio = new Audio("https://res.cloudinary.com/dxzmo0roe/video/upload/v1774549875/koiroylers-live-chat-353605_dro3qx.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        }
      } else if (msg.channel?.startsWith('dm_') && msg.sender_email !== user.email) {
        // Unread DM badge
        setUnreadCounts(prev => ({ ...prev, [msg.channel]: (prev[msg.channel] || 0) + 1 }));
      }
    };
    const handleDmTyping = (data) => {
      if (data.channel === dmChannelId && data.sender_name) {
        setDmTypingUsers(prev => new Set([...prev, data.sender_name]));
      }
    };
    const handleDmStopTyping = (data) => {
      if (data.channel === dmChannelId && data.sender_name) {
        setDmTypingUsers(prev => { const next = new Set(prev); next.delete(data.sender_name); return next; });
      }
    };

    const handleDmUpdated = (data) => {
      if (data.channel === dmChannelId) {
        setDmMessages(prev => prev.map(m => m.id === data.id ? { ...m, message: data.message } : m));
      }
    };

    const handleDmDeleted = (data) => {
      if (data.channel === dmChannelId) {
        setDmMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
    };

    socket.on("newMessage", handleDmNewMessage);
    socket.on("messageUpdated", handleDmUpdated);
    socket.on("messageDeleted", handleDmDeleted);
    socket.on("typing", handleDmTyping);
    socket.on("stopTyping", handleDmStopTyping);

    return () => {
      socket.off("newMessage", handleDmNewMessage);
      socket.off("messageUpdated", handleDmUpdated);
      socket.off("messageDeleted", handleDmDeleted);
      socket.off("typing", handleDmTyping);
      socket.off("stopTyping", handleDmStopTyping);
    };
  }, [user, activeDm]);

  // ── DM send ───────────────────────────────────────────────────────────────
  const sendDmMessage = (e) => {
    e?.preventDefault();
    if (!dmInput.trim() || !user || !activeDm) return;
    const dmChannelId = getDmChannelId(user.email, activeDm.email);

    if (dmEditingMessage) {
      socketRef.current.emit("editMessage", { messageId: dmEditingMessage.id, newMessage: dmInput.trim(), userEmail: user.email });
      setDmEditingMessage(null);
    } else {
      const payload = {
      message: dmInput.trim(),
      sender_name: user.full_name,
      sender_email: user.email,
      sender_profile_photo_url: user.profile_photo_url,
      channel: dmChannelId,
      };
      if (dmReplyingTo) {
        payload.replyTo = {
          id: dmReplyingTo.id,
          sender_name: dmReplyingTo.sender_name,
          message: dmReplyingTo.message,
        };
      }
      socketRef.current.emit("sendMessage", payload);
    }

    setDmInput("");
    setDmReplyingTo(null);
    if (dmIsTypingRef.current) {
      dmIsTypingRef.current = false;
      socketRef.current.emit("stopTyping", { sender_name: user.full_name, channel: dmChannelId });
    }
  };

  const handleDmInputChange = (e) => {
    setDmInput(e.target.value);
    if (!activeDm || !user) return;
    const dmChannelId = getDmChannelId(user.email, activeDm.email);
    if (!dmIsTypingRef.current) {
      dmIsTypingRef.current = true;
      socketRef.current.emit("typing", { sender_name: user.full_name, channel: dmChannelId });
    }
    if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
    dmTypingTimeoutRef.current = setTimeout(() => {
      dmIsTypingRef.current = false;
      socketRef.current.emit("stopTyping", { sender_name: user.full_name, channel: dmChannelId });
    }, 2000);
  };

  const handleDmFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("File is too large (max 25MB)."); return; }
    setDmSelectedFile(file);
    setDmPreviewUrl(URL.createObjectURL(file));
    setDmCaption("");
  };

  const handleDmCancelPreview = () => {
    if (dmPreviewUrl) URL.revokeObjectURL(dmPreviewUrl);
    setDmSelectedFile(null);
    setDmPreviewUrl(null);
    setDmCaption("");
    if (dmFileInputRef.current) dmFileInputRef.current.value = "";
  };

  // AI File Handlers
  const handleAiFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAiSelectedFile(file);
    setAiPreviewUrl(URL.createObjectURL(file));
    setAiCaption("");
  };

  const handleAiCancelPreview = () => { setAiSelectedFile(null); setAiPreviewUrl(null); setAiCaption(""); };

  const handleDmSendMedia = async () => {
    if (!dmSelectedFile || !user || !activeDm) return;
    setDmSending(true);
    try {
      const dmChannelId = getDmChannelId(user.email, activeDm.email);
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file: dmSelectedFile });
      if (!file_url) throw new Error("File upload failed, no URL returned.");
      const payload = {
        message: dmCaption,
        sender_name: user.full_name,
        sender_email: user.email,
        sender_profile_photo_url: user.profile_photo_url,
        channel: dmChannelId,
        media_url: file_url,
        media_filename: dmSelectedFile.name,
        media_type: dmSelectedFile.type,
      };
      if (dmReplyingTo) {
        payload.replyTo = {
          id: dmReplyingTo.id,
          sender_name: dmReplyingTo.sender_name,
          message: dmReplyingTo.message,
        };
      }
      socketRef.current.emit("sendMessage", payload);
      handleDmCancelPreview();
    } catch (error) {
      toast.error(error.message || "Failed to upload file.");
    } finally {
      setDmSending(false);
    }
  };

  const handleAiSendMedia = async () => {
    if (!aiSelectedFile || !user) return;
    setAiSending(true);
    try {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file: aiSelectedFile });
      // Include file info in the AI prompt context
      const prompt = aiCaption ? `${aiCaption} (Attached file: ${aiSelectedFile.name})` : `Analyzing file: ${aiSelectedFile.name}`;
      
      const historySnapshot = aiMessages.map(m => ({ role: m.role, content: m.content }));
      setAiMessages(prev => [...prev, { role: 'user', content: prompt, id: Date.now() }]);
      
      const data = await apiClient.aiChat.send(prompt, historySnapshot);
      setAiMessages(prev => [...prev, { role: 'model', content: data.reply, id: data.messageId }]);
      handleAiCancelPreview();
    } catch (error) {
      toast.error("AI could not process the file.");
    } finally { setAiSending(false); }
  };

  // Auto scroll DMs
  useEffect(() => {
    dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, dmTypingUsers]);

  // ── Open DM ───────────────────────────────────────────────────────────────
  const handleOpenDm = (member) => {
    if (member.email === user?.email) return;
    setActiveDm(member);
    const dmChannelId = getDmChannelId(user.email, member.email);
    setUnreadCounts(prev => ({ ...prev, [dmChannelId]: 0 }));
    setShowMobileUsers(false);
  };

  const handleCloseDm = () => {
    setActiveDm(null);
    setDmMessages([]);
    setDmInput("");
  };

  // DM unread count helper
  const getDmUnread = (memberEmail) => {
    if (!user) return 0;
    const key = getDmChannelId(user.email, memberEmail);
    return unreadCounts[key] || 0;
  };

  // Inside Chat.jsx

  useEffect(() => {
    const fetchChatHistory = async (targetChannelId) => {
      const channelId = targetChannelId || (activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`);
      if (!channelId) return;

        const cacheKey = `chat_cache_${channelId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            setMessagesData(JSON.parse(cached));
          } catch (e) { console.error("Fetch cache read error", e); }
        }

      try {
        let data;

        if (channelId.startsWith('dm_')) {
          // Use the new Direct Message route
          data = await apiClient.entities.DirectMessage.getHistory(channelId);
          
          // Also mark as read when opening the conversation
          await apiClient.entities.DirectMessage.markAsRead(channelId);
        } else {
          // Use the standard ChatMessage entity for general/groups. 
          // The generic controller returns newest first (DESC), so we reverse it.
          data = await apiClient.entities.ChatMessage.filter({ 
            channel: channelId 
          });
        }

        // Defensive check: Ensure we always set an array to avoid the "prev is not iterable" crash
        let messagesArray = Array.isArray(data) ? data : (data?.data || []);
        if (!channelId.startsWith('dm_')) messagesArray = [...messagesArray].reverse();
        
        setMessagesData(messagesArray);
        
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setMessagesData([]); // Reset to empty array so the UI doesn't crash
        toast.error("Could not load messages.");
      }
    };

    const targetId = activeDm ? getDmChannelId(user.email, activeDm.email) : null;
    fetchChatHistory(targetId);
  }, [activeDm, activeChannel, user]);

  // ── Group/General typing handler ──────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!user) return;
    const socket = socketRef.current;
    const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing", { sender_name: user.full_name || "User", channel: channelId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stopTyping", { sender_name: user.full_name || "User", channel: channelId });
    }, 2000);
  };

  const handleEmojiClick = (emojiData) => {
    setInput(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleScrollToMessage = (messageId, prefix = "message") => {
    const element = document.getElementById(`${prefix}-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-amber-100/50', 'rounded-lg', 'transition-all', 'duration-300');
      setTimeout(() => element.classList.remove('bg-amber-100/50', 'rounded-lg'), 2000);
    } else {
      toast.info("Original message not in view.");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("File is too large (max 25MB)."); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCaption("");
  };

  const handleCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMedia = async () => {
    if (!selectedFile || !user) return;
    setSending(true);
    try {
      const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file: selectedFile });
      if (!file_url) throw new Error("File upload failed, no URL returned.");
      const payload = {
        message: caption,
        sender_name: user.full_name,
        sender_email: user.email,
        sender_profile_photo_url: user.profile_photo_url,
        channel: channelId,
        media_url: file_url,
        media_filename: selectedFile.name,
        media_type: selectedFile.type,
      };
      if (replyingTo) {
        payload.replyTo = {
          id: replyingTo.id,
          sender_name: replyingTo.sender_name,
          message: replyingTo.message,
          media_url: replyingTo.media_url,
          media_filename: replyingTo.media_filename
        };
      }
      socketRef.current.emit("sendMessage", payload);
      handleCancelPreview();
      setReplyingTo(null);
    } catch (error) {
      toast.error(error.message || "Failed to upload file.");
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const socket = socketRef.current;
    setSending(true);
    const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
    if (editingMessage) {
      socket.emit("editMessage", { messageId: editingMessage.id, newMessage: input.trim(), userEmail: user.email });
      handleCancelEdit();
      setSending(false);
      return;
    }
    const payload = {
      message: input.trim(),
      sender_name: user.full_name,
      sender_email: user.email,
      sender_profile_photo_url: user.profile_photo_url,
      channel: channelId,
    };
    if (replyingTo) {
      payload.replyTo = {
        id: replyingTo.id,
        sender_name: replyingTo.sender_name,
        message: replyingTo.message,
        media_filename: replyingTo.media_filename,
      };
    }
    socket.emit("sendMessage", payload);
    setInput("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setSending(false);
  };

  const handleDeleteMessage = (message) => {
    if (!user) return;
    if (confirm("Are you sure you want to delete this message? This cannot be undone.")) {
      socketRef.current.emit("deleteMessage", { messageId: message.id, userEmail: user.email });
    }
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setInput(message.message || "");
    setReplyingTo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancelEdit = () => { setEditingMessage(null); setInput(""); };

  const handleChannelSwitch = (channel) => {
    if (channel.id === activeChannel.id) return;
    setActiveChannel(channel);
    setUnreadCounts(prev => ({ ...prev, [channel.id]: 0 }));
  };

  const handleLeaveGroup = async (group) => {
    if (!confirm(`Are you sure you want to leave the "${group.name}" group?`)) return;
    try {
      await apiClient.entities.ChatGroup.leaveGroup(group.id);
      setMyGroups(prev => prev.filter(g => g.id !== group.id));
      if (activeChannel.id === group.id) handleChannelSwitch({ id: 'general', name: 'General Fellowship' });
    } catch (error) { console.error(error); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (n) => n?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const avatarColors = ["bg-[#1a2744]", "bg-[#2d5f8a]", "bg-[#3a7d5c]", "bg-[#8b5e3c]", "bg-purple-600"];
  const getColor = (email) => avatarColors[email?.charCodeAt(0) % avatarColors.length] || avatarColors[0];
  const onlineEmailsSet = useMemo(() => new Set(onlineUsers.map(u => u.email)), [onlineUsers]);
  const isUserOnline = (email) => onlineEmailsSet.has(email);

  // Scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messagesData, typingUsers]);

  // ── AI Chat ───────────────────────────────────────────────────────────────
  const loadAiHistory = async () => {
    if (!user || aiHistoryLoaded) return;
    const cacheKey = `ai_cache_${user.email}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setAiMessages(JSON.parse(cached));
      } catch (e) { console.error("AI cache read error", e); }
    }

    try {
      const data = await apiClient.aiChat.getHistory();
      const history = data.map(m => ({ role: m.role, content: m.content, id: m.id }));
      setAiMessages(history);
      sessionStorage.setItem(cacheKey, JSON.stringify(history));
    } catch (e) { console.error('Failed to load AI history', e); }
    finally { setAiHistoryLoaded(true); }
  };

  const handleOpenAiChat = () => { setShowAiChat(true); loadAiHistory(); };

  const handleClearAiChat = async () => {
    if (!confirm('Clear your entire conversation with Faith AI?')) return;
    try { await apiClient.aiChat.clearHistory(); setAiMessages([]); }
    catch (e) { console.error('Clear AI history failed', e); }
  };

  const sendAiMessage = async (e) => {
    e?.preventDefault();
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const historySnapshot = aiMessages.map(m => ({ role: m.role, content: m.content }));
    setAiMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }]);
    setAiInput('');
    setAiLoading(true);
    try {
      const data = await apiClient.aiChat.send(text, historySnapshot);
      setAiMessages(prev => [...prev, { role: 'model', content: data.reply, id: data.messageId }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'model', content: `⚠️ ${err?.message || 'Something went wrong.'}`, id: Date.now() + 1 }]);
    } finally { setAiLoading(false); }
  };

  useEffect(() => { aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages, aiLoading]);

  if (loadingAuth) return <div className="h-screen flex items-center justify-center">Loading Community...</div>;


  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white relative">

      {/* Unauthorized Overlay */}
      {!user && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/60 p-6 text-center">
          <div className="max-w-md p-8 bg-white shadow-2xl rounded-3xl border">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[#c8a951]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1a2744]">Member Access Only</h2>
            <p className="text-gray-500 mt-2 mb-6">Please sign in to join the conversation.</p>
            <Button onClick={() => navigate("/auth")} className="w-full bg-[#1a2744] gap-2">
              <LogIn className="w-4 h-4" /> Sign In to Participate
            </Button>
          </div>
        </div>
      )}

      {/* Media Preview Modal (Group/General) */}
      {selectedFile && (
        <MediaPreviewModal
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          caption={caption}
          setCaption={setCaption}
          onCancel={handleCancelPreview}
          onSend={handleSendMedia}
          sending={sending}
        />
      )}

      {/* DM Media Preview Modal */}
      {dmSelectedFile && (
        <MediaPreviewModal
          selectedFile={dmSelectedFile}
          previewUrl={dmPreviewUrl}
          caption={dmCaption}
          setCaption={setDmCaption}
          onCancel={handleDmCancelPreview}
          onSend={handleDmSendMedia}
          sending={dmSending}
        />
    )}

    {/* AI Media Preview Modal */}
    {aiSelectedFile && (
      <MediaPreviewModal
        selectedFile={aiSelectedFile}
        previewUrl={aiPreviewUrl}
        caption={aiCaption}
        setCaption={setAiCaption}
        onCancel={handleAiCancelPreview}
        onSend={handleAiSendMedia}
        sending={aiSending}
      />
      )}

      {/* Profile Photo Viewer */}
      {viewingProfilePhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setViewingProfilePhoto(null)}>
          <Button variant="ghost" size="icon" onClick={() => setViewingProfilePhoto(null)} className="fixed top-4 right-4 text-white hover:bg-white/20 rounded-full z-[110]">
            <X className="w-6 h-6" />
          </Button>
          <div className="relative max-w-lg w-full max-h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img src={viewingProfilePhoto} alt="Profile" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-4 border-white/10" />
          </div>
        </div>
      )}

      {/* Universal Media Viewer Modal */}
      {fullScreenMedia && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 animate-in fade-in duration-300" onClick={() => { setFullScreenMedia(null); setZoomLevel(1); }}>
          <div className="relative w-full md:max-w-5xl h-full max-h-[92vh] md:max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="fixed top-4 right-4 md:top-8 md:right-8 flex gap-3 z-[120]" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                title="Share"
                onClick={async () => {
                  const shareData = {
                    title: fullScreenMedia.filename || 'Shared Media',
                    text: `Check out this ${fullScreenMedia.type} from MUTSDA Chat`,
                    url: fullScreenMedia.url
                  };
                  if (navigator.share) {
                    try {
                      await navigator.share(shareData);
                    } catch (err) {
                      console.log("Error sharing:", err);
                    }
                  } else {
                    await navigator.clipboard.writeText(fullScreenMedia.url);
                    toast.success("Link copied to clipboard!");
                  }
                }}
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <a href={fullScreenMedia.url} download={fullScreenMedia.filename} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors flex items-center justify-center" title="Download">
                <Download className="w-5 h-5" />
              </a>
              <Button variant="ghost" size="icon" onClick={() => { setFullScreenMedia(null); setZoomLevel(1); }} className="text-white hover:bg-white/20 rounded-full">
                <X className="w-6 h-6" />
              </Button>
            </div>

            {fullScreenMedia.type === 'image' ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto custom-scrollbar">
                <img 
                  src={fullScreenMedia.url} 
                  alt={fullScreenMedia.filename} 
                  className={cn("max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300", zoomLevel > 1 ? "scale-[2] cursor-zoom-out" : "cursor-zoom-in")} 
                  onClick={() => setZoomLevel(prev => prev === 1 ? 2 : 1)}
                />
              </div>
            ) : fullScreenMedia.type === 'document' ? (
              <div className="w-full h-full bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-3 border-b flex justify-between items-center bg-gray-50 shrink-0">
                  <div className="flex items-center gap-2 px-2 overflow-hidden">
                    <FileText className="w-4 h-4 text-[#c8a951] shrink-0" />
                    <span className="text-xs md:text-sm font-semibold truncate text-slate-700">{fullScreenMedia.filename}</span>
                  </div>
                  <a href={fullScreenMedia.url} target="_blank" rel="noopener noreferrer" className="text-[10px] md:text-xs text-blue-600 hover:underline font-medium shrink-0 px-2">
                    Open Original
                  </a>
                </div>
                <iframe src={fullScreenMedia.url.toLowerCase().endsWith('.pdf') ? fullScreenMedia.url : `https://docs.google.com/gview?url=${encodeURIComponent(fullScreenMedia.url)}&embedded=true`} className="flex-1 w-full border-none" title="Document Viewer" loading="lazy" />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── AI Pastor Chat Panel ─────────────────────────────────────────────── */}
      {showAiChat && (
        <div className="absolute inset-0 z-[80] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl shadow-2xl flex flex-col h-full md:h-[80vh] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#1a2744] to-[#2d5f8a] text-white shrink-0">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#c8a951]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight">MUTSDA AI</p>
                <p className="text-[11px] text-white/70">Your spiritual companion · Powered by Gemini</p>
              </div>
              <button onClick={handleClearAiChat} className="p-1.5 rounded-full hover:bg-white/20 transition-colors" title="Clear conversation">
                <RefreshCw className="w-4 h-4 text-white/70" />
              </button>
              <button onClick={() => setShowAiChat(false)} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative" onScroll={(e) => handleScroll(e, setAiShowScrollBottom)}>
              {aiMessages.length === 0 && !aiLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 text-gray-500">
                  <div className="w-16 h-16 bg-[#1a2744]/10 rounded-full flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-[#1a2744]" />
                  </div>
                  <p className="font-semibold text-[#1a2744] text-lg mb-1">Hello, {user?.full_name?.split(' ')[0] || 'Friend'}! 🙏</p>
                  <p className="text-sm leading-relaxed">I'm <span className="font-semibold text-[#c8a951]">MUTSDA AI</span>, your spiritual companion.</p>
                  <div className="mt-5 grid grid-cols-1 gap-2 w-full">
                    {["What does the Bible say about anxiety?", "Give me today's devotional thought", "Explain the plan of salvation", "How do I strengthen my prayer life?"].map(suggestion => (
                      <button key={suggestion} onClick={() => { setAiInput(suggestion); aiInputRef.current?.focus(); }} className="text-left text-xs text-[#1a2744] bg-white border border-[#1a2744]/20 rounded-xl px-3 py-2 hover:bg-[#1a2744]/5 transition-colors">
                        💬 {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id || Math.random()} className={cn("flex gap-2 items-end", isUser ? "flex-row-reverse" : "flex-row")}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] flex items-center justify-center shrink-0 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-[#c8a951]" />
                      </div>
                    )}
                    <div className={cn("max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm", isUser ? "bg-[#1a2744] text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-800 rounded-bl-none")}>
                      {isUser ? msg.content : formatAiText(msg.content)}
                    </div>
                  </div>
                );
              })}
              {aiLoading && (
                <div className="flex gap-2 items-end">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-[#c8a951]" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
              {aiShowScrollBottom && (
                <Button 
                  size="icon" 
                  className="fixed bottom-20 right-8 rounded-full shadow-lg bg-[#c8a951] hover:bg-[#b09440] animate-in slide-in-from-bottom-4 duration-300"
                  onClick={() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <ChevronDown className="w-5 h-5 text-[#1a2744]" />
                </Button>
              )}
              <div ref={aiBottomRef} />
            </div>
            <form onSubmit={sendAiMessage} className="shrink-0 px-3 py-3 bg-white border-t flex gap-2 items-end">
              <div className="flex gap-1 pb-1">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-[#1a2744]" onClick={() => document.getElementById('ai-file').click()}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <input type="file" id="ai-file" className="hidden" onChange={handleAiFileSelect} />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-[#1a2744]" onClick={() => { setAiShowEmoji(!aiShowEmoji); setAiInputRef.current?.focus(); }}>
                  <Smile className="w-5 h-5" />
                </Button>
              </div>
              {aiShowEmoji && (
                <div className="absolute bottom-20 left-4 z-[90] shadow-2xl rounded-xl">
                  <EmojiPicker 
                    onEmojiClick={(d) => { setAiInput(p => p + d.emoji); setAiShowEmoji(false); }} 
                    width={300} 
                    height={400} 
                  />
                </div>
              )}
              <textarea 
                ref={aiInputRef}
                value={aiInput}
                onChange={e => { setAiInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                placeholder="Ask Faith AI anything spiritual..."
                rows={1}
                disabled={aiLoading || !user}
                className="flex-1 resize-none overflow-y-auto bg-gray-100 border-none rounded-2xl px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744] leading-relaxed disabled:opacity-50"
                style={{ maxHeight: '120px', minHeight: '38px' }}
              />
              <Button type="submit" disabled={!aiInput.trim() || aiLoading || !user} className="rounded-full h-9 w-9 p-0 flex items-center justify-center bg-[#1a2744] hover:bg-[#2d5f8a] text-white shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── DM Panel ──────────────────────────────────────────────────────────── */}
      {activeDm && (
        <div className="absolute inset-0 z-[75] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl shadow-2xl flex flex-col h-full md:h-[85vh] overflow-hidden">
            {/* DM Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1a2744] text-white shrink-0">
              <button onClick={handleCloseDm} className="p-1.5 rounded-full hover:bg-white/20 transition-colors mr-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 relative", !activeDm.profile_photo_url && getColor(activeDm.email))}>
                {activeDm.profile_photo_url ? (
                  <img src={activeDm.profile_photo_url} alt={activeDm.full_name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(activeDm.full_name)
                )}
                {isUserOnline(activeDm.email) && (
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-[#1a2744]"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight truncate">{activeDm.full_name}</p>
                <p className="text-[11px] text-white/70">{isUserOnline(activeDm.email) ? '🟢 Online' : 'Offline'}</p>
              </div>
              <button onClick={handleCloseDm} className="p-1.5 rounded-full hover:bg-white/20 transition-colors ml-auto">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DM Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gradient-to-b from-[#efeae2] to-[#e0dbd3] relative" onScroll={(e) => handleScroll(e, setDmShowScrollBottom)} style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cg fill-opacity='0.03'%3E%3Cpolygon points='30 55 0 41.25 0 9.75 30 0 60 9.75 60 41.25' fill='%23fff'/%3E%3C/g%3E%3C/svg%3E")`,
            }}>
              {dmMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in zoom-in duration-300 py-10 opacity-60">
                  <div className="w-20 h-20 rounded-full bg-white/50 flex items-center justify-center shadow-inner border border-white/20">
                    <MessageCircle className="w-10 h-10 text-[#1a2744]" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[#1a2744]">Start chatting with {activeDm.full_name}</p>
                    <p className="text-sm text-gray-600 mt-1">Send a message to begin your conversation.</p>
                  </div>
                </div>
              )}

              {dmMessagesWithSeparators.map((item, idx) => {
                if (item.isDateSeparator) {
                  return (
                    <div key={item.id} className="relative text-center my-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-300/50"></div>
                        <span className="bg-gray-200/70 px-3 py-1 text-xs font-semibold text-gray-600 rounded-full">{item.label}</span>
                        <div className="flex-1 h-px bg-gray-300/50"></div>
                      </div>
                    </div>
                  );
                }
                const msg = item;
                const isMe = msg.sender_email === user?.email;
                const swipeOffset = touchState.id === msg.id ? Math.min(touchState.currentX - touchState.startX, 100) : 0;

                return (
                  <div 
                    id={`message-dm-${msg.id}`} 
                    key={msg.id || idx} 
                    className={cn("flex items-end gap-2 group relative transition-transform duration-100", isMe ? "flex-row-reverse justify-start" : "flex-row justify-start")}
                    style={{ transform: `translateX(${swipeOffset}px)` }}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={() => handleTouchEnd(msg, true)}
                  >
                    {swipeOffset > 20 && (
                      <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 opacity-50">
                        <Reply className={cn("w-5 h-5 transition-all", swipeOffset > 70 ? "text-blue-500 scale-125 opacity-100" : "text-gray-400")} />
                      </div>
                    )}
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden", !msg.sender_profile_photo_url && getColor(msg.sender_email))}>
                      {msg.sender_profile_photo_url ? <img src={msg.sender_profile_photo_url} alt={msg.sender_name} className="w-full h-full object-cover" /> : getInitials(msg.sender_name)}
                    </div>
                    <div className={cn("flex flex-col max-w-xs lg:max-w-md", isMe ? "items-end" : "items-start")}>
                      <div className={cn("relative rounded-2xl text-sm shadow-md leading-relaxed", isMe ? "bg-[#0084ff] text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-200")}>
                        {msg.reply_to_message_id && (
                          <div className="pt-1 px-1">
                            <ReplyPreview 
                                senderName={msg.reply_to_sender_name} 
                                message={msg.reply_to_message_snippet} 
                                isMe={isMe} 
                                onClick={() => handleScrollToMessage(msg.reply_to_message_id, "message-dm")} 
                            />
                          </div>
                        )}
                        {msg.media_url && <MessageMedia message={msg} onMediaClick={setFullScreenMedia} />}
                        {msg.message && <p className="break-words px-3 py-2">{msg.message}</p>}
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 px-2">{msg.created_date ? format(new Date(msg.created_date), "h:mm a") : ""}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400" onClick={() => setDmReplyingTo(msg)}><Reply className="w-3 h-3"/></Button>
                       {isMe && <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400" onClick={() => { setDmEditingMessage(msg); setDmInput(msg.message); }}><Pencil className="w-3 h-3"/></Button>}
                       {(isMe || user.role === 'admin') && <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400" onClick={() => socketRef.current.emit("deleteMessage", { messageId: msg.id, userEmail: user.email })}><Trash2 className="w-3 h-3"/></Button>}
                    </div>
                  </div>
                );
              })}
              {dmTypingUsers.size > 0 && (
                <div className="text-[11px] text-gray-600 italic px-4 py-1">
                  {Array.from(dmTypingUsers).join(", ")} is typing
                  <span className="inline-flex gap-0.5 ml-1">
                    <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                    <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                  </span>
                </div>
              )}
              {dmShowScrollBottom && (
                <Button 
                  size="icon" 
                  className="fixed bottom-20 right-8 rounded-full shadow-lg bg-[#0084ff] hover:bg-blue-600 animate-in slide-in-from-bottom-4 duration-300"
                  onClick={() => dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <ChevronDown className="w-5 h-5 text-white" />
                </Button>
              )}
              <div ref={dmBottomRef} />
            </div>

            {/* DM Input */}
            <footer className="p-3 bg-white border-t relative">
              {dmReplyingTo && (
                <div className="p-2 mb-2 bg-blue-50 border-l-4 border-blue-500 rounded flex justify-between items-center text-xs animate-in slide-in-from-bottom-2">
                  <div className="truncate flex-1">
                    <span className="font-bold block">Replying to {dmReplyingTo.sender_name}</span>
                    {dmReplyingTo.message}
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDmReplyingTo(null)}><X className="w-3 h-3"/></Button>
                </div>
              )}

              {dmEditingMessage && (
                <div className="p-2 mb-2 bg-green-50 border-l-4 border-green-500 rounded flex justify-between items-center text-xs animate-in slide-in-from-bottom-2">
                  <div className="truncate flex-1">
                    <span className="font-bold block">Editing Message</span>
                    {dmEditingMessage.message}
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setDmEditingMessage(null); setDmInput(""); }}><X className="w-3 h-3"/></Button>
                </div>
              )}

               {dmShowEmoji && (
                <div className="absolute bottom-16 left-2 z-10 shadow-xl rounded-xl">
                  <EmojiPicker onEmojiClick={(emojiData) => { setDmInput(prev => prev + emojiData.emoji); setDmShowEmoji(false); }} width={300} height={380} />
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex gap-1 pb-1">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-[#1a2744]" onClick={() => dmFileInputRef.current?.click()}>
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <input type="file" ref={dmFileInputRef} className="hidden" onChange={handleDmFileSelect} accept="image/*,video/*,audio/mp3,audio/mpeg,audio/wav,audio/m4a,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-[#1a2744]" onClick={() => setDmShowEmoji(!dmShowEmoji)}>
                    <Smile className="w-5 h-5" />
                  </Button>
                </div>
                <textarea
  value={dmInput}
  onChange={handleDmInputChange}
  placeholder={`Message ${activeDm.full_name}...`}
  rows={1}
  className="w-full bg-gray-100 border-none rounded-2xl px-4 py-2.5 resize-none focus:ring-2 focus:ring-[#0084ff] focus:outline-none scrollbar-hide min-h-[40px] max-h-[120px]"
  onKeyDown={(e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendDmMessage(); 
    } 
  }}
  onInput={(e) => {
    const target = e.target;
    target.style.height = 'inherit';
    target.style.height = `${target.scrollHeight}px`;
  }}
  disabled={dmSending}
/>
                <Button onClick={sendDmMessage} className="rounded-full h-9 w-9 p-0 bg-[#0084ff] hover:bg-blue-600 text-white" disabled={!dmInput.trim() || dmSending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-4 border-b bg-white flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#1a2744]">{activeChannel.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            <span className="text-xs text-gray-500 font-medium">{onlineUsers.length} Online</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="md:hidden gap-2" onClick={() => setShowMobileUsers(true)}>
          <Users className="w-4 h-4" /> Members
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gradient-to-b from-[#efeae2] to-[#e0dbd3] relative" onScroll={(e) => handleScroll(e, setShowScrollBottom)} style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cg fill-opacity='0.03'%3E%3Cpolygon points='30 55 0 41.25 0 9.75 30 0 60 9.75 60 41.25'/%3E%3Cpolygon points='30 55 0 41.25 0 9.75 30 0 60 9.75 60 41.25' fill='%23fff'/%3E%3C/g%3E%3C/svg%3E")`,
          }}>
            {messagesData.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in zoom-in duration-300 py-10 opacity-60">
                <div className="w-20 h-20 rounded-full bg-white/50 flex items-center justify-center shadow-inner border border-white/20">
                  <Users className="w-10 h-10 text-[#1a2744]" />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#1a2744]">Welcome to {activeChannel.name}</p>
                  <p className="text-sm text-gray-600 mt-1">No messages here yet. Start the conversation with the community!</p>
                </div>
              </div>
            )}

            {messagesWithSeparators.map((item, idx) => {
              if (item.isDateSeparator) {
                return (
                  <div key={item.id} className="relative text-center my-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-gray-300/50"></div>
                      <span className="bg-gray-200/70 px-3 py-1 text-xs font-semibold text-gray-600 rounded-full">{item.label}</span>
                      <div className="flex-1 h-px bg-gray-300/50"></div>
                    </div>
                  </div>
                );
              }
              const msg = item;
              const isMe = msg.sender_email === user?.email;
              const canDelete = isMe || user?.role === 'admin';
              const swipeOffset = touchState.id === msg.id ? Math.min(touchState.currentX - touchState.startX, 100) : 0;

              return (
                <div 
                  id={`message-${msg.id}`} 
                  key={msg.id || idx} 
                  className={cn("flex items-end gap-2 group relative transition-transform duration-100", isMe ? "flex-row-reverse justify-start" : "flex-row justify-start")}
                  style={{ transform: `translateX(${swipeOffset}px)` }}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(msg, false)}
                >
                  {swipeOffset > 20 && (
                    <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 opacity-50">
                      <Reply className={cn("w-5 h-5 transition-all", swipeOffset > 70 ? "text-blue-500 scale-125 opacity-100" : "text-gray-400")} />
                    </div>
                  )}
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm overflow-hidden", !msg.sender_profile_photo_url && getColor(msg.sender_email))}>
                    {msg.sender_profile_photo_url ? (
                      <img src={msg.sender_profile_photo_url} alt={msg.sender_name} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setViewingProfilePhoto(msg.sender_profile_photo_url)} />
                    ) : (
                      getInitials(msg.sender_name)
                    )}
                  </div>
                  <div className={cn("flex flex-col max-w-xs lg:max-w-md", isMe ? "items-end" : "items-start")}>
                    <span className="text-[11px] font-semibold text-gray-600 mb-1 px-2">{msg.sender_name}</span>
                    <div className={cn("relative rounded-2xl text-sm shadow-md leading-relaxed", isMe ? "bg-[#0084ff] text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-200")}>
                      {msg.replyTo && (
                        <div className="pt-1 px-1">
                          <ReplyPreview 
                            senderName={msg.replyTo.sender_name} 
                            message={msg.replyTo.message || msg.replyTo.media_filename} 
                            isMe={isMe} 
                            onClick={() => handleScrollToMessage(msg.replyTo.id)} 
                          />
                        </div>
                      )}
                      {msg.media_url && <MessageMedia message={msg} onMediaClick={setFullScreenMedia} />}
                      {msg.message && <p className="break-words px-3 py-2">{msg.message}</p>}
                    </div>
                    <span className="text-[10px] text-gray-600 mt-1 px-2">{msg.created_date ? format(new Date(msg.created_date), "h:mm a") : ""}</span>
                  </div>
                  <div className="self-center shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-blue-500" onClick={() => setReplyingTo(msg)}>
                      <Reply className="w-3 h-3" />
                    </Button>
                    {isMe && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-green-500" onClick={() => handleEditMessage(msg)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-red-500" onClick={() => handleDeleteMessage(msg)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {typingUsers.size > 0 && (
              <div className="text-[11px] text-gray-600 italic px-4 py-2">
                <span className="inline-flex items-center gap-1">
                  {Array.from(typingUsers).join(", ")} is typing
                  <span className="flex gap-0.5 ml-1">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                  </span>
                </span>
              </div>
            )}
            {showScrollBottom && (
              <Button 
                size="icon" 
                className="fixed bottom-24 right-8 md:right-80 rounded-full shadow-lg bg-[#0084ff] hover:bg-blue-600 animate-in slide-in-from-bottom-4 duration-300"
                onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </Button>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Box */}
          <footer className="p-4 bg-white border-t relative">
            {replyingTo && (
              <div className="p-3 mb-2 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg text-sm flex justify-between items-center animate-in slide-in-from-bottom duration-300">
                <div>
                  <p className="font-bold text-blue-700">Replying to {replyingTo.sender_name}</p>
                  <p className="text-blue-600 line-clamp-1 text-xs">{replyingTo.message || replyingTo.media_filename || "Attachment"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {editingMessage && (
              <div className="p-3 mb-2 bg-green-50 border-l-4 border-green-500 rounded-r-lg text-sm flex justify-between items-center animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-green-600" />
                  <span className="font-bold text-green-700">Editing message</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-700 hover:bg-green-100" onClick={handleCancelEdit}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 z-10 shadow-xl rounded-xl">
                <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={400} />
              </div>
            )}
            <form onSubmit={sendMessage} className="flex gap-2 items-end">
              <div className="flex gap-1 pb-1">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-[#1a2744]" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,video/*,audio/mp3,audio/mpeg,audio/wav,audio/m4a,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-[#1a2744]" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Smile className="w-5 h-5" />
                </Button>
              </div>
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={editingMessage ? "Edit your message..." : `Message ${activeChannel.name}...`}
                className="bg-gray-100 border-none rounded-full ring-offset-0 focus-visible:ring-2 focus-visible:ring-[#0084ff] focus-visible:ring-offset-0"
                disabled={!user || sending}
              />
              <Button type="submit" className={cn("rounded-full h-9 w-9 p-0 flex items-center justify-center", editingMessage ? "bg-green-500 hover:bg-green-600 text-white" : "bg-[#0084ff] hover:bg-blue-600 text-white")} disabled={(!input.trim() && !sending) || sending}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </footer>
        </div>

        {/* Mobile Action Sheet for Long Press */}
        <Dialog open={!!longPressMessage} onOpenChange={() => setLongPressMessage(null)}>
          <DialogContent className="max-w-[90vw] rounded-t-3xl rounded-b-none sm:rounded-2xl bottom-0 top-auto translate-y-0 p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Message Actions</DialogTitle>
            </DialogHeader>
            <div className="p-4 bg-white space-y-1">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 md:hidden" />
              <p className="text-[10px] uppercase font-bold text-gray-400 px-4 mb-2">Message Actions</p>
              
              <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl text-slate-700" onClick={() => { setReplyingTo(longPressMessage); setLongPressMessage(null); }}>
                <Reply className="w-4 h-4 text-blue-500" /> Reply
              </Button>
              
              <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl text-slate-700" onClick={() => copyToClipboard(longPressMessage.message)}>
                <Copy className="w-4 h-4 text-green-500" /> Copy Text
              </Button>

              {longPressMessage?.sender_email === user?.email && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl text-slate-700" onClick={() => { handleEditMessage(longPressMessage); setLongPressMessage(null); }}>
                  <Pencil className="w-4 h-4 text-amber-500" /> Edit Message
                </Button>
              )}

              {(longPressMessage?.sender_email === user?.email || user?.role === 'admin') && (
                <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { handleDeleteMessage(longPressMessage); setLongPressMessage(null); }}>
                  <Trash2 className="w-4 h-4" /> Delete Message
                </Button>
              )}
              
              <div className="pt-2">
                <Button variant="secondary" className="w-full rounded-xl h-12" onClick={() => setLongPressMessage(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Desktop Sidebar */}
        <aside className="w-72 border-l bg-white hidden md:block overflow-y-auto p-6">
          <SidebarContent
            user={user}
            allMembers={sortedMembers}
            myGroups={myGroups}
            activeChannel={activeChannel}
            onChannelSwitch={handleChannelSwitch}
            onLeaveGroup={handleLeaveGroup}
            unreadCounts={unreadCounts}
            getInitials={getInitials}
            getColor={getColor}
            onViewPhoto={setViewingProfilePhoto}
            isUserOnline={isUserOnline}
            onOpenAiChat={handleOpenAiChat}
            onOpenDm={handleOpenDm}
            getDmUnread={getDmUnread}
            memberSearch={memberSearch}
            setMemberSearch={setMemberSearch}
          />
        </aside>

        {/* Mobile Sidebar */}
        {showMobileUsers && (
          <div className="fixed inset-0 z-[100] flex justify-end md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileUsers(false)} />
            <aside className="absolute right-0 w-80 max-w-sm h-full bg-white shadow-xl p-6 flex flex-col animate-in slide-in-from-right overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-lg">Members & Groups</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowMobileUsers(false)}><X /></Button>
              </div>
              <SidebarContent
                user={user}
                allMembers={sortedMembers}
                myGroups={myGroups}
                activeChannel={activeChannel}
                onChannelSwitch={handleChannelSwitch}
                onLeaveGroup={handleLeaveGroup}
                unreadCounts={unreadCounts}
                getInitials={getInitials}
                getColor={getColor}
                onViewPhoto={setViewingProfilePhoto}
                isUserOnline={isUserOnline}
                onOpenAiChat={() => { setShowMobileUsers(false); handleOpenAiChat(); }}
                onOpenDm={(member) => { handleOpenDm(member); }}
                getDmUnread={getDmUnread}
                memberSearch={memberSearch}
                setMemberSearch={setMemberSearch}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reusable Media Preview Modal ──────────────────────────────────────────────
function MediaPreviewModal({ selectedFile, previewUrl, caption, setCaption, onCancel, onSend, sending }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-[#1a2744]">Preview Media</h3>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center overflow-hidden min-h-[200px]">
          {selectedFile.type.startsWith('image/') ? (
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-sm" />
          ) : selectedFile.type.startsWith('video/') ? (
            <video src={previewUrl} controls className="max-w-full max-h-[50vh] rounded-lg shadow-sm" />
          ) : selectedFile.type.startsWith('audio/') ? (
            <div className="text-center p-4 bg-slate-200 rounded-lg w-full">
              <Music className="w-16 h-16 mx-auto text-slate-500" />
              <p className="mt-2 text-sm font-semibold text-slate-700 break-all">{selectedFile.name}</p>
              <audio src={previewUrl} controls className="w-full mt-4" />
            </div>
          ) : (
            <div className="text-center p-4 bg-slate-200 rounded-lg">
              <FileText className="w-16 h-16 mx-auto text-slate-500" />
              <p className="mt-2 text-sm font-semibold text-slate-700 break-all">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{Math.round(selectedFile.size / 1024)} KB</p>
            </div>
          )}
        </div>
        <div className="p-2 border-t">
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..." className="bg-white border-none h-10 focus-visible:ring-0" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} />
        </div>
        <div className="p-2 bg-gray-50 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={sending}>Cancel</Button>
          <Button onClick={onSend} disabled={sending} className="bg-[#1a2744] hover:bg-[#2d5f8a] text-white gap-2">
            <Send className="w-4 h-4" />{sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function SidebarContent({ user, allMembers, myGroups, activeChannel, onChannelSwitch, onLeaveGroup, unreadCounts, getInitials, getColor, onViewPhoto, isUserOnline, onOpenAiChat, onOpenDm, getDmUnread, memberSearch, setMemberSearch }) {
  
  const filteredMembers = useMemo(() => {
    return allMembers.filter(m => 
      m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [allMembers, memberSearch]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Channels</h4>
        <div className="space-y-1">
          <button
            onClick={() => onChannelSwitch({ id: 'general', name: 'General Fellowship' })}
            className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              activeChannel.id === 'general' ? "bg-[#1a2744] text-white" : "text-gray-600 hover:bg-gray-100")}
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", activeChannel.id === 'general' ? "bg-white/20" : "bg-gray-200")}>
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="font-medium">General Fellowship</span>
          </button>

          {/* Faith AI */}
          <button
            onClick={onOpenAiChat}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-600 hover:bg-amber-50 group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-[#c8a951]" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium text-[#1a2744]">MUTSDA AI</span>
              <p className="text-[10px] text-gray-400 leading-tight">Bible · Prayer · Hope</p>
            </div>
            <span className="text-[9px] font-bold bg-[#c8a951] text-[#1a2744] px-1.5 py-0.5 rounded-full uppercase tracking-wide">AI</span>
          </button>

          {myGroups.map(group => {
            const unread = unreadCounts[group.id] || 0;
            return (
              <div key={group.id} className="group relative">
                <button
                  onClick={() => onChannelSwitch({ id: group.id, name: group.name })}
                  className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    activeChannel.id === group.id ? "bg-[#1a2744] text-white" : "text-gray-600 hover:bg-gray-100")}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 uppercase",
                    activeChannel.id === group.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600")}>
                    {group.name.substring(0, 2)}
                  </div>
                  <span className="flex-1 text-left truncate font-medium">{group.name}</span>
                  {unread > 0 && <Badge className="h-5 px-2 text-xs bg-red-500 hover:bg-red-600 text-white">{unread > 9 ? '9+' : unread}</Badge>}
                </button>
                <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onLeaveGroup(group); }}>
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* You */}
      <div className="border-t pt-6 space-y-4">
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">You</h4>
        {user && (
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0", !user.profile_photo_url && getColor(user.email))}>
              {user.profile_photo_url ? (
                <img src={user.profile_photo_url} alt={user.full_name} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onViewPhoto(user.profile_photo_url)} />
              ) : getInitials(user.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-700 truncate">{user.full_name} (You)</span>
                {user.role && <Badge className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0", getRoleBadgeClass(user.role))}>{user.role}</Badge>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Members — with DM button */}
      <div className="space-y-4">
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Members — {allMembers.length}</h4>
        
        {/* Member Search Bar */}
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#1a2744] transition-colors" />
          <input 
            type="text"
            placeholder="Search members..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full bg-gray-100 border-none rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-[#1a2744] outline-none transition-all"
          />
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-xs text-gray-500 italic py-2">No members loaded yet</div>
        ) : (
          <div className="space-y-1">
            {filteredMembers.map((member, idx) => {
              if (member.email === user?.email) return null;
              const online = isUserOnline(member.email);
              const dmUnread = getDmUnread ? getDmUnread(member.email) : 0;
              return (
                <div
                  key={member.email || idx}
                  className={cn(
                    "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors cursor-pointer group",
                    online ? "hover:bg-green-100 bg-green-50" : "hover:bg-gray-100"
                  )}
                  onClick={() => onOpenDm && onOpenDm(member)}
                  title={`Click to chat privately with ${member.full_name}`}
                >
                  <div className="relative shrink-0">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden", !member.profile_photo_url && getColor(member.email))}>
                      {member.profile_photo_url ? (
                        <img src={member.profile_photo_url} alt={member.full_name} className="w-full h-full object-cover" onClick={(e) => { e.stopPropagation(); onViewPhoto(member.profile_photo_url); }} />
                      ) : getInitials(member.full_name)}
                    </div>
                    {online && <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white"></span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-700 truncate">{member.full_name}</span>
                      {member.role && <Badge className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0", getRoleBadgeClass(member.role))}>{member.role}</Badge>}
                    </div>
                    {online && <span className="text-[10px] text-green-600 font-semibold">Online</span>}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {dmUnread > 0 && (
                      <Badge className="h-5 px-1.5 text-xs bg-red-500 text-white">{dmUnread > 9 ? '9+' : dmUnread}</Badge>
                    )}
                    <MessageCircle className="w-4 h-4 text-gray-400 group-hover:text-[#0084ff] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}