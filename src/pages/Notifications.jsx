import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, Heart, MessageCircle, UserPlus, Loader2, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveNotificationPath } from "@/lib/service-helpers";

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const actorProfileCache = useRef(new Map());

  useEffect(() => {
    if (!user) { navigate("/auth/login"); return; }
    fetchNotifications();

    const refreshSilently = () => fetchNotifications({ silent: true });
    const interval = window.setInterval(refreshSilently, 5000);
    window.addEventListener("focus", refreshSilently);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSilently);
    };
  }, [user, page]);

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      // api.notifications.getForUser already unwraps ApiResponse → returns List<ResponseDTO>
      const data = await api.notifications.getForUserPaged(user.id, page, pageSize);
      setNotifications(await decorateNotifications(Array.isArray(data) ? data : []));
    } catch {
      if (!silent) toast.error("Failed to load notifications");
    }
    finally {
      if (!silent) setLoading(false);
    }
  };

  const getActorProfile = async (actorId) => {
    if (!actorId || actorId === 0) return null;
    if (actorProfileCache.current.has(actorId)) return actorProfileCache.current.get(actorId);

    try {
      const profile = await api.auth.getPublicProfile(actorId);
      actorProfileCache.current.set(actorId, profile);
      return profile;
    } catch {
      actorProfileCache.current.set(actorId, null);
      return null;
    }
  };

  const decorateNotifications = async (items) => Promise.all(items.map(async (notification) => {
    const type = String(notification?.type || "").toUpperCase();
    if (type !== "MESSAGE") return notification;

    const profile = await getActorProfile(notification.actorId);
    const senderName = profile?.fullName || profile?.username;
    return {
      ...notification,
      actorProfile: profile,
      displayMessage: senderName ? `${senderName} sent you a message` : notification.message,
    };
  }));

  const handleMarkAsRead = async (id) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(notifications.map((n) =>
        (n.notificationId || n.id) === id ? { ...n, read: true } : n
      ));
    } catch { toast.error("Failed to mark as read"); }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await api.notifications.markAllRead(user.id);
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      toast.success("All marked as read");
    } catch { toast.error("Failed to mark all as read"); }
  };

  const handleDelete = async (id) => {
    try {
      await api.notifications.deleteNotification(id);
      setNotifications(notifications.filter((n) => (n.notificationId || n.id) !== id));
    } catch { toast.error("Failed to delete"); }
  };

  const handleOpenNotification = async (notification) => {
    const destination = resolveNotificationPath(notification);
    const notificationId = getId(notification);
    const isUnread = !(notification.read ?? notification.isRead);

    if (isUnread) {
      try {
        await api.notifications.markAsRead(notificationId);
        setNotifications((currentNotifications) => currentNotifications.map((item) =>
          getId(item) === notificationId ? { ...item, read: true, isRead: true } : item
        ));
      } catch {
        // Ignore read-state update failures so navigation can continue.
      }
    }

    if (destination) {
      navigate(destination);
    }
  };

  const getIcon = (type) => {
    const t = (type || "").toUpperCase();
    if (t.includes("LIKE")) return <Heart className="w-5 h-5 text-primary" />;
    if (t.includes("COMMENT") || t.includes("MESSAGE")) return <MessageCircle className="w-5 h-5 text-secondary" />;
    if (t.includes("FOLLOW")) return <UserPlus className="w-5 h-5 text-accent" />;
    return <Bell className="w-5 h-5 text-muted-foreground" />;
  };

  const getId = (n) => n.notificationId || n.id;
  const filtered = filter === "unread" ? notifications.filter((n) => !(n.read ?? n.isRead)) : notifications;
  const unreadCount = notifications.filter((n) => !(n.read ?? n.isRead)).length;

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-4xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Bell className="w-7 h-7 text-primary" /> Notifications</h1>
              {unreadCount > 0 && <p className="text-sm text-muted-foreground mt-1">{unreadCount} unread</p>}
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={handleMarkAllRead}>
                <CheckCheck className="w-4 h-4" /> Mark all read
              </Button>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            {["all", "unread"].map((f) => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="rounded-full capitalize" onClick={() => setFilter(f)}>{f}</Button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border border-border shadow-sm">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"><Bell className="w-8 h-8 text-primary" /></div>
              <h3 className="font-bold text-lg mb-2">{filter === "unread" ? "All caught up!" : "No notifications yet"}</h3>
              <p className="text-muted-foreground text-sm">When someone interacts with your posts, you'll see it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => (
                <div key={getId(n)} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all ${(n.read ?? n.isRead) ? "bg-white border-border" : "bg-primary/5 border-primary/20 shadow-sm"}`}>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">{getIcon(n.type)}</div>
                  <button type="button" onClick={() => handleOpenNotification(n)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm break-words">{n.displayMessage || n.message || n.content || `${n.type} notification`}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt || n.timestamp).toLocaleString()}</p>
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    {!(n.read ?? n.isRead) && (<button type="button" onClick={() => handleMarkAsRead(getId(n))} className="p-1.5 hover:bg-muted rounded-md transition" title="Mark as read"><Check className="w-4 h-4 text-primary" /></button>)}
                    <button type="button" onClick={() => handleDelete(getId(n))} className="p-1.5 hover:bg-destructive/10 rounded-md transition" title="Delete"><Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">Page {page + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={notifications.length < pageSize || loading}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
