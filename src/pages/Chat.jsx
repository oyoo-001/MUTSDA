import React, { useState, useEffect, useRef, useMemo, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, LogIn, Users, X, Lock, Hash, MessageSquare, LogOut, Paperclip, Smile, Image as ImageIcon, FileVideo, Trash2, FileText, Music, Download, Reply, Pencil } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import io from 'socket.io-client';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const socket = io(SOCKET_URL);

const MessageMedia = ({ message }) => {
  if (!message.media_url) return null;

  // The server provides a relative path like '/uploads/xyz'. We need to make it absolute.
  const getAbsoluteUrl = (url) => {
    if (!url) return '';
    // If it's already a full URL (http, https) or a local blob, use it as is.
    if (url.startsWith('http') || url.startsWith('blob:')) {
      return url;
    }
    try {
      // Create a URL object from SOCKET_URL to easily get the origin
      const serverUrl = new URL(SOCKET_URL);
      return `${serverUrl.origin}${url}`;
    } catch (e) {
      // Fallback for invalid SOCKET_URL or other errors
      console.error("Could not create absolute URL for media", e);
      return url;
    }
  };

  const absoluteMediaUrl = getAbsoluteUrl(message.media_url);
  const isAudio = message.media_type?.startsWith('audio/');
  const isVideo = message.media_type?.startsWith('video/');
  const isImage = message.media_type?.startsWith('image/');
  const isDocument = !isAudio && !isVideo && !isImage;

  if (isImage) {
    return (
      <div className="relative group max-w-xs my-1 rounded-lg overflow-hidden border bg-slate-50 shadow-sm">
        <a href={absoluteMediaUrl} target="_blank" rel="noopener noreferrer">
          <img src={absoluteMediaUrl} alt={message.media_filename || 'attachment'} className="max-w-full max-h-80 object-cover transition-transform group-hover:scale-105" />
        </a>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white text-xs font-bold truncate drop-shadow-md">{message.media_filename || 'Image'}</p>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="max-w-xs my-1 rounded-lg overflow-hidden border bg-black shadow-sm">
         <video src={absoluteMediaUrl} controls className="w-full max-h-80" />
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
        <a href={absoluteMediaUrl} target="_blank" rel="noopener noreferrer" className="block bg-white border p-3 rounded-lg flex items-center gap-3 max-w-xs my-1 shadow-sm hover:bg-slate-50 transition-colors">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-slate-800">{message.media_filename || 'File'}</p>
            <p className="text-xs text-slate-500">Click to open document</p>
          </div>
          <Download className="w-4 h-4 text-slate-400 shrink-0" />
        </a>
      );
  }

  return null;
};

export default function Chat() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [messagesData, setMessagesData] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
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
            let label = '';
            if (isToday(messageDate)) {
                label = 'Today';
            } else if (isYesterday(messageDate)) {
                label = 'Yesterday';
            } else {
                label = format(messageDate, 'MMMM d, yyyy');
            }
            acc.push({ isDateSeparator: true, id: `date-${message.id || index}`, label });
        }
        acc.push(message);
        return acc;
    }, []);
  }, [messages]);

  // 1. Auth & Initial Load
  useEffect(() => {
    const load = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) {
          const userData = await apiClient.auth.me();
          setUser(userData);
          // Fetch user's groups
          apiClient.entities.ChatGroup.getMyGroups().then(setMyGroups).catch(console.error);
        }
      } catch (e) {
        console.error("Auth load failed", e);
      } finally {
        setLoadingAuth(false);
      }
    };
    load();

  }, []);

  // Initialize Socket
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      extraHeaders: {
        "ngrok-skip-browser-warning": "true"
      }
    });

    const handleOnlineUsersUpdate = (users) => {
      // The user object is not available here, so we filter in the render logic
      setOnlineUsers(users);
    };
    socketRef.current.on("online_users_update", handleOnlineUsersUpdate);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    }
  }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const fetchHistory = (channelId) => {
    apiClient.entities.ChatMessage.filter({ channel: channelId })
      .then((response) => {
        const data = Array.isArray(response) ? response : (response?.data || response?.items || []);
        // Backend returns newest first (DESC), reverse to show oldest first (ASC) for chat log
        setMessagesData([...data].reverse());
      })
      .catch(err => console.error("Failed to load chat history", err));
  };

  // 2. Socket Listeners (Only active if user exists)
  useEffect(() => {
    if (!user) return;
    const socket = socketRef.current;

    const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
    
    socket.emit('i_am_online', user);
    socket.emit("join", channelId);
    setMessagesData([]); // Clear messages on channel switch
    fetchHistory(channelId);

    const handleNewMessage = (msg) => {
      if (msg.channel === channelId) {
        setMessagesData(prev => [...prev, msg]);
        
        // Sound and Notification for incoming messages (not from me)
        if (msg.sender_email !== user.email) {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2346/2346-preview.mp3");
          audio.volume = 0.5;
          audio.play().catch(e => console.error("Audio play failed", e));

          if (document.hidden && Notification.permission === "granted") {
            new Notification(`New message from ${msg.sender_name}`, { body: msg.message || "Sent an attachment" });
          }
        }
      } else {
        const groupId = msg.channel.replace('group_', '');
        setUnreadCounts(prev => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1
        }));
      }
    };
    const handleTyping = ({ sender_name, channel }) => {
      if (channel === channelId) {
        setTypingUsers(prev => new Set(prev).add(sender_name));
      }
    };
    const handleStopTyping = ({ sender_name, channel }) => {
      if (channel === channelId) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(sender_name);
          return next;
        });
      }
    };

    const handleMessageDeleted = ({ messageId, channel }) => {
      const currentChannelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
      if (channel === currentChannelId) {
        setMessagesData(prev => prev.filter(m => m.id !== messageId));
        toast.info("Message deleted.");
      }
    };

    const handleDeleteError = ({ message }) => {
      toast.error(message);
    };

    const handleMessageUpdated = ({ id, message, channel }) => {
      if (channel === channelId) {
        setMessagesData(prev => prev.map(m => m.id === id ? { ...m, message } : m));
      }
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('deleteError', handleDeleteError);
    socket.on('messageUpdated', handleMessageUpdated);

    return () => {
      socket.emit('leave', channelId);
      socket.off("newMessage");
      socket.off("typing");
      socket.off("stopTyping");
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('deleteError', handleDeleteError);
      socket.off('messageUpdated', handleMessageUpdated);
    };
  }, [user, activeChannel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleInputChange = (e) => {
    const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;
    const socket = socketRef.current;
    setInput(e.target.value);
    if (!user) return;
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

  const handleScrollToMessage = (messageId) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message temporarily
        element.classList.add('bg-amber-100/50', 'rounded-lg', 'transition-all', 'duration-300');
        setTimeout(() => {
            element.classList.remove('bg-amber-100/50', 'rounded-lg');
        }, 2500);
    } else {
        toast.info("Original message not in view.");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) { // 25MB limit
      toast.error("File is too large (max 25MB).");
      return;
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
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

      if (!file_url) {
        throw new Error("File upload failed, no URL returned.");
      }
      
      const payload = {
        message: caption,
        sender_name: user.full_name,
        sender_email: user.email,
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
      console.error("Upload failed", error);
      toast.error(error.message || "Failed to upload file.");
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim()) || !user) return;
    const socket = socketRef.current;
    setSending(true);
    const channelId = activeChannel.id === 'general' ? 'general' : `group_${activeChannel.id}`;

    if (editingMessage) {
      socket.emit("editMessage", {
        messageId: editingMessage.id,
        newMessage: input.trim(),
        userEmail: user.email
      });
      handleCancelEdit();
      setSending(false);
      return;
    }
    
    const payload = {
      message: input.trim(),
      sender_name: user.full_name,
      sender_email: user.email,
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
    fileInputRef.current.value = "";
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInput("");
  };

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
      
      // If user was in the group they just left, switch to general
      if (activeChannel.id === group.id) {
        handleChannelSwitch({ id: 'general', name: 'General Fellowship' });
      }

    } catch (error) {
      console.error(error);
    }
  };

  // Helper UI functions
  const getInitials = (n) => n?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const avatarColors = ["bg-[#1a2744]", "bg-[#2d5f8a]", "bg-[#3a7d5c]", "bg-[#8b5e3c]", "bg-purple-600"];
  const getColor = (email) => avatarColors[email?.charCodeAt(0) % avatarColors.length] || avatarColors[0];
  const displayOnlineUsers = useMemo(() => onlineUsers.filter(u => u.email !== user?.email), [onlineUsers, user]);

  if (loadingAuth) return <div className="h-screen flex items-center justify-center">Loading Community...</div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white relative">
      {/* 1. Unauthorized Overlay */}
      {!user && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/60 p-6 text-center">
          <div className="max-w-md p-8 bg-white shadow-2xl rounded-3xl border">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[#c8a951]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1a2744]">Member Access Only</h2>
            <p className="text-gray-500 mt-2 mb-6">
              Please sign in to join the conversation and see who else is online.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full bg-[#1a2744] gap-2">
              <LogIn className="w-4 h-4" /> Sign In to Participate
            </Button>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {selectedFile && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-[#1a2744]">Preview Media</h3>
              <Button variant="ghost" size="icon" onClick={handleCancelPreview} className="h-8 w-8 rounded-full hover:bg-gray-100">
                <X className="w-4 h-4" />
              </Button>
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
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="bg-white border-none h-10 focus-visible:ring-0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMedia();
                  }
                }}
              />
            </div>
            <div className="p-2 bg-gray-50 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelPreview} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSendMedia} disabled={sending} className="bg-[#1a2744] hover:bg-[#2d5f8a] text-white gap-2">
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Mobile Toggle */}
      <header className="p-4 border-b bg-white flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#1a2744]">{activeChannel.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
             <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
             <span className="text-xs text-gray-500 font-medium">{displayOnlineUsers.length + (user ? 1 : 0)} Online</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="md:hidden gap-2"
          onClick={() => setShowMobileUsers(true)}
        >
          <Users className="w-4 h-4" /> Members
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fafafa]">
            {messagesWithSeparators.map((item, idx) => {
              if (item.isDateSeparator) {
                return (
                  <div key={item.id} className="relative text-center my-6">
                    <hr className="absolute top-1/2 left-0 w-full border-gray-200" />
                    <span className="relative bg-[#fafafa] px-3 text-xs font-semibold text-gray-500">{item.label}</span>
                  </div>
                );
              }
              const msg = item;
              const isMe = msg.sender_email === user?.email;
              const canDelete = isMe || user?.role === 'admin';

              return (
                <div id={`message-${msg.id}`} key={msg.id || idx} className={cn("flex items-end gap-3 group", isMe ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm", getColor(msg.sender_email))}>
                    {getInitials(msg.sender_name)}
                  </div>
                  <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
                    <span className="text-[11px] font-semibold text-gray-500 mb-1 px-1">{msg.sender_name}</span>
                    <div className={cn("relative p-1 rounded-2xl text-[13px] shadow-sm leading-relaxed", 
                      isMe ? "bg-[#1a2744] text-white rounded-tr-none" : "bg-white text-gray-800 border rounded-tl-none")}>
                      
                      {msg.replyTo && (
                        <div 
                          className={cn("mb-1 rounded-md p-2 text-xs cursor-pointer hover:opacity-90 transition-opacity border-l-4", isMe ? "bg-black/20 border-white/50 text-white/90" : "bg-gray-100 border-[#c8a951] text-gray-700")}
                          onClick={() => handleScrollToMessage(msg.replyTo.id)}
                        >
                          <p className="font-bold text-[10px] opacity-75 mb-0.5">{msg.replyTo.sender_name}</p>
                          <p className="line-clamp-1">{msg.replyTo.message || msg.replyTo.media_filename || "Attachment"}</p>
                        </div>
                      )}

                      {msg.media_url && <MessageMedia message={msg} />}
                      
                      {msg.message && <p className="break-words px-3 py-1.5">{msg.message}</p>}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1.5">{msg.created_date ? format(new Date(msg.created_date), "h:mm a") : ""}</span>
                  </div>
                  <div className="self-center shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-500" onClick={() => setReplyingTo(msg)}>
                          <Reply className="w-3.5 h-3.5" />
                      </Button>
                      {isMe && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-green-500" onClick={() => handleEditMessage(msg)}>
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDeleteMessage(msg)}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                  </div>
                </div>
              );
            })}
            {typingUsers.size > 0 && (
              <div className="text-[11px] text-gray-400 italic animate-pulse px-12">
                {Array.from(typingUsers).join(", ")} is typing...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Box */}
          <footer className="p-4 bg-white border-t relative">
            {replyingTo && (
              <div className="p-2 mb-2 bg-gray-100 rounded-lg text-xs flex justify-between items-center animate-in fade-in duration-200">
                <div>
                  <p className="font-bold text-gray-500">Replying to {replyingTo.sender_name}</p>
                  <p className="text-gray-600 line-clamp-1">{replyingTo.message || replyingTo.media_filename || "Attachment"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {editingMessage && (
              <div className="p-2 mb-2 bg-green-50 border border-green-100 rounded-lg text-xs flex justify-between items-center animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-green-600" />
                  <span className="font-bold text-green-700">Editing message</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-700 hover:bg-green-100" onClick={handleCancelEdit}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 z-10 shadow-xl rounded-xl">
                <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={400} />
              </div>
            )}
            <form onSubmit={sendMessage} className="flex gap-2 max-w-5xl mx-auto items-end">
              <div className="flex gap-1 pb-1">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-[#1a2744]" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileSelect} 
                  accept="image/*,video/*,audio/mp3,audio/mpeg,audio/wav,audio/m4a,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-[#1a2744]" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Smile className="w-5 h-5" />
                </Button>
              </div>
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={editingMessage ? "Edit your message..." : `Message ${activeChannel.name}...`}
                className="bg-gray-50 border-none ring-offset-0 focus-visible:ring-1 focus-visible:ring-[#c8a951]"
                disabled={!user || sending}
              />
              <Button type="submit" className={cn("text-[#1a2744]", editingMessage ? "bg-green-500 hover:bg-green-600 text-white" : "bg-[#c8a951] hover:bg-[#b89941]")} disabled={(!input.trim() && !sending) || sending}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </footer>
        </div>
        {/* Desktop Sidebar */}
        <aside className="w-72 border-l bg-white hidden md:block overflow-y-auto p-6">
          <SidebarContent user={user} onlineUsers={displayOnlineUsers} myGroups={myGroups} activeChannel={activeChannel} onChannelSwitch={handleChannelSwitch} onLeaveGroup={handleLeaveGroup} unreadCounts={unreadCounts} getInitials={getInitials} getColor={getColor} />
        </aside>

        {/* Mobile Sidebar (Sheet/Drawer Effect) */}
        {showMobileUsers && (
          <div className="fixed inset-0 z-[100] flex justify-end md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileUsers(false)} />
            <aside className="absolute right-0 w-80 max-w-sm h-full bg-white shadow-xl p-6 flex flex-col animate-in slide-in-from-right">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-lg">Active Members</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowMobileUsers(false)}><X /></Button>
              </div>
              <SidebarContent user={user} onlineUsers={displayOnlineUsers} myGroups={myGroups} activeChannel={activeChannel} onChannelSwitch={handleChannelSwitch} onLeaveGroup={handleLeaveGroup} unreadCounts={unreadCounts} getInitials={getInitials} getColor={getColor} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for the user list to avoid duplication
function SidebarContent({ user, onlineUsers, myGroups, activeChannel, onChannelSwitch, onLeaveGroup, unreadCounts, getInitials, getColor }) {
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
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", 
               activeChannel.id === 'general' ? "bg-white/20" : "bg-gray-200")}>
               <MessageSquare className="w-4 h-4" />
            </div>
            <span className="font-medium">General Fellowship</span>
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
                  {unread > 0 && (
                    <Badge className="h-5 px-2 text-xs bg-red-500 hover:bg-red-600 text-white">{unread > 9 ? '9+' : unread}</Badge>
                  )}
                </button>
                <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onLeaveGroup(group); }}>
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-6 space-y-4">
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">You</h4>
        {user && <UserItem name={user.full_name} email={user.email} isMe getInitials={getInitials} getColor={getColor} />}
      </div>
      <div className="space-y-4">
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Online — {onlineUsers.length}</h4>
        {onlineUsers.map((u, i) => (
          <UserItem key={i} name={u.name} email={u.email} getInitials={getInitials} getColor={getColor} />
        ))}
      </div>
    </div>
  );
}

function UserItem({ name, email, isMe, getInitials, getColor }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold", getColor(email))}>
          {getInitials(name)}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white"></span>
      </div>
      <span className="text-sm font-medium text-gray-700 truncate">{name} {isMe && "(You)"}</span>
    </div>
  );
}