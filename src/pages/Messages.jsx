import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  Send, Search, Loader2, ArrowLeft, MessageCircle, UserPlus, X,
  Pencil, Trash2, Check, CheckCheck
} from "lucide-react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { apiUrl } from "@/lib/apiBase";

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [startingConversationId, setStartingConversationId] = useState(null);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingMessageId, setSavingMessageId] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const profileCache = useRef(new Map());
  const stompClient = useRef(null);
  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    connectWebSocket();

    return () => {
      if (stompClient.current) {
        stompClient.current.deactivate();
      }
      setRealtimeConnected(false);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const refreshMessagesState = () => {
      loadConversations({ silent: true });
      if (activeConversationRef.current) {
        refreshActiveConversationMessages({ silent: true });
      }
    };

    const interval = window.setInterval(refreshMessagesState, realtimeConnected ? 5000 : 2500);
    const handleVisibilityRefresh = () => {
      if (!document.hidden) refreshMessagesState();
    };

    window.addEventListener("focus", refreshMessagesState);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshMessagesState);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [user, realtimeConnected]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadConversations = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingConv(true);
      const data = await api.messages.getConversations();
      const decorated = await decorateConversations(data || []);
      setConversations(decorated);
    } catch {
      if (!silent) toast.error("Failed to load conversations");
    } finally {
      if (!silent) setLoadingConv(false);
    }
  };

  const getPublicProfile = async (userId) => {
    if (!userId) return null;
    if (profileCache.current.has(userId)) return profileCache.current.get(userId);
    try {
      const profile = await api.auth.getPublicProfile(userId);
      profileCache.current.set(userId, profile);
      return profile;
    } catch {
      return null;
    }
  };

  const decorateConversation = async (conversation) => {
    const profile = await getPublicProfile(conversation.otherUserId);
    return {
      ...conversation,
      otherUser: profile,
      otherUserName: profile?.fullName || profile?.username || `User ${conversation.otherUserId}`,
      otherUsername: profile?.username || `user_${conversation.otherUserId}`,
      otherProfilePicUrl: profile?.profilePicUrl || "",
    };
  };

  const decorateConversations = async (items) => Promise.all(items.map(decorateConversation));

  const connectWebSocket = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS(apiUrl("/ws-message")),
      debug: () => {},
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      setRealtimeConnected(true);
      client.subscribe(`/topic/user/${user.id}/messages`, (message) => {
        const msg = JSON.parse(message.body);
        handleIncomingMessage(msg);
      });
      client.subscribe(`/topic/user/${user.id}/messages/updates`, (message) => {
        applyMessageUpdate(JSON.parse(message.body));
      });
      client.subscribe(`/topic/user/${user.id}/read`, (message) => {
        const convId = JSON.parse(message.body);
        setMessages((prev) => 
          prev.map((m) => m.conversationId === convId && m.senderId === user.id ? { ...m, isRead: true } : m)
        );
      });
    };

    client.onDisconnect = () => setRealtimeConnected(false);
    client.onStompError = () => setRealtimeConnected(false);
    client.onWebSocketClose = () => setRealtimeConnected(false);
    client.onWebSocketError = () => setRealtimeConnected(false);

    client.activate();
    stompClient.current = client;
  };

  const handleIncomingMessage = (msg) => {
    const active = activeConversationRef.current;

    if (active?.conversationId === msg.conversationId) {
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === msg.messageId)) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== user.id) {
        api.messages.markAsRead(msg.conversationId).catch(() => {});
      }
    }

    setConversations((prev) => {
      const exists = prev.find((c) => c.conversationId === msg.conversationId);
      if (exists) {
        const updated = prev.map((c) => {
          if (c.conversationId === msg.conversationId) {
            return {
              ...c,
              lastMessageContent: msg.content,
              lastMessageAt: msg.createdAt,
              unreadCount: active?.conversationId === msg.conversationId || msg.senderId === user.id
                ? 0
                : c.unreadCount + 1
            };
          }
          return c;
        });
        return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      } else {
        // If it's a new conversation, reload all
        loadConversations();
        return prev;
      }
    });
  };

  async function refreshActiveConversationMessages({ silent = false } = {}) {
    const active = activeConversationRef.current;
    if (!active) return;

    try {
      const data = await api.messages.getMessages(active.conversationId, 0, 100);
      setMessages(data || []);
      if (active.unreadCount > 0) {
        await api.messages.markAsRead(active.conversationId);
        setConversations(prev => prev.map(c => c.conversationId === active.conversationId ? { ...c, unreadCount: 0 } : c));
      }
    } catch {
      if (!silent) toast.error("Failed to load messages");
    }
  }

  const messagePreview = (message) => message?.isDeleted ? "This message was deleted" : message?.content;

  const applyMessageUpdate = (updatedMessage) => {
    if (!updatedMessage?.messageId) return;

    setMessages((current) => current.map((message) => (
      message.messageId === updatedMessage.messageId ? updatedMessage : message
    )));

    setConversations((current) => current.map((conversation) => (
      conversation.conversationId === updatedMessage.conversationId
        ? {
            ...conversation,
            lastMessageContent: messagePreview(updatedMessage),
            lastMessageAt: updatedMessage.createdAt || conversation.lastMessageAt
          }
        : conversation
    )));
  };

  const selectConversation = async (conv) => {
    const hydratedConversation = conv.otherUserName ? conv : await decorateConversation(conv);
    setActiveConversation(hydratedConversation);
    setLoadingMessages(true);
    try {
      activeConversationRef.current = hydratedConversation;
      await refreshActiveConversationMessages();
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSearchUsers = async (e) => {
    e?.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const results = await api.auth.searchUsers(query);
      const filtered = (Array.isArray(results) ? results : []).filter((candidate) => {
        const candidateId = candidate.userId || candidate.id;
        return candidateId && candidateId !== user.id;
      });
      setSearchResults(filtered);
      if (filtered.length === 0) toast.message("No users found");
    } catch (error) {
      toast.error(error?.message || "User search failed");
    } finally {
      setSearchingUsers(false);
    }
  };

  const startConversation = async (targetUser) => {
    const targetUserId = targetUser.userId || targetUser.id;
    if (!targetUserId) return;

    setStartingConversationId(targetUserId);
    try {
      profileCache.current.set(targetUserId, targetUser);
      const conversation = await api.messages.getOrCreateConversation(targetUserId);
      const decorated = await decorateConversation(conversation);

      setConversations((current) => {
        const withoutDuplicate = current.filter((item) => item.conversationId !== decorated.conversationId);
        return [decorated, ...withoutDuplicate].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
      setSearchQuery("");
      setSearchResults([]);
      await selectConversation(decorated);
    } catch (error) {
      toast.error(error?.message || "Failed to start conversation");
    } finally {
      setStartingConversationId(null);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const content = newMessage.trim();
    setNewMessage("");

    try {
      const sentMessage = await api.messages.sendMessage(activeConversation.conversationId, content);
      if (sentMessage?.messageId) {
        setMessages((current) => current.some((item) => item.messageId === sentMessage.messageId) ? current : [...current, sentMessage]);
        setConversations((current) => current.map((conversation) => (
          conversation.conversationId === activeConversation.conversationId
            ? { ...conversation, lastMessageContent: sentMessage.content, lastMessageAt: sentMessage.createdAt }
            : conversation
        )));
      }
    } catch {
      toast.error("Failed to send message");
    }
  };

  const startEditMessage = (message) => {
    setEditingMessageId(message.messageId);
    setEditingContent(message.content || "");
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const handleUpdateMessage = async (messageId) => {
    const content = editingContent.trim();
    if (!content) return;

    setSavingMessageId(messageId);
    try {
      const updatedMessage = await api.messages.updateMessage(messageId, content);
      applyMessageUpdate(updatedMessage);
      cancelEditMessage();
      toast.success("Message updated");
    } catch (error) {
      toast.error(error?.message || "Failed to update message");
    } finally {
      setSavingMessageId(null);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    setDeletingMessageId(messageId);
    try {
      const deletedMessage = await api.messages.deleteMessage(messageId);
      applyMessageUpdate(deletedMessage);
      if (editingMessageId === messageId) cancelEditMessage();
      toast.success("Message deleted");
    } catch (error) {
      toast.error(error?.message || "Failed to delete message");
    } finally {
      setDeletingMessageId(null);
    }
  };

  const initialsFor = (name = "") => name.trim().slice(0, 1).toUpperCase() || "U";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 pt-[80px] h-full flex gap-4 overflow-hidden">
        
        {/* Conversations Sidebar */}
        <div className={`w-full md:w-80 lg:w-96 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h1 className="font-bold text-lg">Messages</h1>
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="w-9 h-9 rounded-full border border-gray-200 hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center transition"
                title="Find people"
              >
                <UserPlus className="w-4 h-4 text-primary" />
              </button>
            </div>
            <form onSubmit={handleSearchUsers} className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    if (!event.target.value.trim()) setSearchResults([]);
                  }}
                  placeholder="Search people"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="text-gray-400 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchingUsers || searchQuery.trim().length < 2}
                className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:bg-gray-300 transition"
              >
                {searchingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>
          </div>

          {searchResults.length > 0 && (
            <div className="border-b border-gray-100 p-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">People</div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {searchResults.map((result) => {
                  const resultId = result.userId || result.id;
                  const displayName = result.fullName || result.username || `User ${resultId}`;
                  return (
                    <button
                      key={resultId}
                      type="button"
                      onClick={() => startConversation(result)}
                      className="w-full text-left p-2 rounded-xl flex items-center gap-3 hover:bg-gray-50 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                        {result.profilePicUrl ? <img src={result.profilePicUrl} alt="" className="w-full h-full object-cover" /> : initialsFor(displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{displayName}</div>
                        <div className="text-xs text-gray-500 truncate">@{result.username || `user_${resultId}`}</div>
                      </div>
                      {startingConversationId === resultId ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <MessageCircle className="w-4 h-4 text-gray-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConv ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : conversations.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <div className="font-medium text-gray-700 mb-1">No conversations yet</div>
                <p>Search for a person above to start chatting.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button type="button"
                  key={conv.conversationId}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left p-3 rounded-xl flex gap-3 transition-colors ${activeConversation?.conversationId === conv.conversationId ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                    {conv.otherProfilePicUrl ? <img src={conv.otherProfilePicUrl} alt="" className="w-full h-full object-cover" /> : initialsFor(conv.otherUserName)}
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-sm truncate">{conv.otherUserName || `User ${conv.otherUserId}`}</span>
                      <span className="text-xs text-gray-400">{formatDate(conv.lastMessageAt)}</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">@{conv.otherUsername || `user_${conv.otherUserId}`}</div>
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      {conv.lastMessageContent || "Started a conversation"}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="shrink-0 flex items-center">
                      <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{conv.unreadCount}</span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col relative ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-white/80 backdrop-blur-md rounded-t-2xl z-10">
                <button type="button" className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100" onClick={() => setActiveConversation(null)}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                  {activeConversation.otherProfilePicUrl ? <img src={activeConversation.otherProfilePicUrl} alt="" className="w-full h-full rounded-full object-cover" /> : initialsFor(activeConversation.otherUserName)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{activeConversation.otherUserName || `User ${activeConversation.otherUserId}`}</div>
                  <div className="text-xs text-gray-500 truncate">
                    @{activeConversation.otherUsername || `user_${activeConversation.otherUserId}`} - {realtimeConnected ? "Live" : "Reconnecting"}
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {loadingMessages ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const isMine = msg.senderId === user.id;
                    const isEditing = editingMessageId === msg.messageId;
                    const isDeleted = Boolean(msg.isDeleted);
                    return (
                      <div key={msg.messageId} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'} ${isDeleted ? 'opacity-75' : ''}`}>
                            {isEditing ? (
                              <div className="min-w-[240px] space-y-2">
                                <input
                                  type="text"
                                  value={editingContent}
                                  onChange={(event) => setEditingContent(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") handleUpdateMessage(msg.messageId);
                                    if (event.key === "Escape") cancelEditMessage();
                                  }}
                                  className="w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEditMessage}
                                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                                    title="Cancel edit"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateMessage(msg.messageId)}
                                    disabled={!editingContent.trim() || savingMessageId === msg.messageId}
                                    className="w-8 h-8 rounded-full bg-white text-primary hover:bg-white/90 disabled:opacity-60 flex items-center justify-center"
                                    title="Save edit"
                                  >
                                    {savingMessageId === msg.messageId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={`break-words ${isDeleted ? 'italic' : ''}`}>{msg.content}</p>
                                <div className={`text-[10px] mt-1 flex items-center justify-end gap-1.5 ${isMine ? 'text-primary-foreground/70' : 'text-gray-400'}`}>
                                  {msg.editedAt && !isDeleted && <span>edited</span>}
                                  <span>{formatDate(msg.createdAt)}</span>
                                  {isMine && (
                                    <span className="inline-flex items-center gap-0.5">
                                      {msg.isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                      {msg.isRead ? "Read" : "Delivered"}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          {isMine && !isDeleted && !isEditing && (
                            <div className="flex items-center gap-1 pr-1">
                              <button
                                type="button"
                                onClick={() => startEditMessage(msg)}
                                className="w-7 h-7 rounded-full text-gray-400 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition"
                                title="Edit message"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.messageId)}
                                disabled={deletingMessageId === msg.messageId}
                                className="w-7 h-7 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-60 flex items-center justify-center transition"
                                title="Delete message"
                              >
                                {deletingMessageId === msg.messageId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                    <MessageCircle className="w-10 h-10 mb-3 text-gray-300" />
                    <div className="text-sm font-medium text-gray-600">No messages yet</div>
                    <p className="text-xs mt-1">Send the first message to start the conversation.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white rounded-b-2xl">
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent px-4 text-sm focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300 transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Send className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-xl font-medium text-gray-600 mb-2">Your Messages</h3>
              <p className="text-sm max-w-xs text-center mb-4">Search for a person or select a conversation from the sidebar to start chatting</p>
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="md:hidden px-4 py-2 rounded-full bg-primary text-white text-sm font-medium"
              >
                Find People
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
