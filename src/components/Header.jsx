import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Orbit, House, Compass, BellRing, Menu, X, LogOut, MessagesSquare,
  Bookmark, Settings, Shield, ChevronDown, CreditCard, LogIn
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const countUnreadMessageSenders = (conversations = []) => {
  const senderKeys = new Set();

  conversations.forEach((conversation, index) => {
    const unread = Number(conversation?.unreadCount ?? 0);
    if (unread <= 0) return;

    senderKeys.add(conversation?.otherUserId ?? conversation?.conversationId ?? `unknown-${index}`);
  });

  return senderKeys.size;
};

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { user, isAuthenticated, isLoading: checkingAuth, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageSenderCount, setUnreadMessageSenderCount] = useState(0);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setUnreadMessageSenderCount(0);
      return undefined;
    }

    let isCurrent = true;

    const loadUnreadIndicators = () => {
      api.notifications.getUnreadCount(user.id)
        .then((count) => {
          if (isCurrent && typeof count === "number") setUnreadCount(count);
        })
        .catch(() => {});

      api.messages.getConversations()
        .then((conversations) => {
          if (isCurrent) {
            setUnreadMessageSenderCount(countUnreadMessageSenders(conversations || []));
          }
        })
        .catch(() => {});
    };

    loadUnreadIndicators();
    const interval = window.setInterval(loadUnreadIndicators, 5000);
    window.addEventListener("focus", loadUnreadIndicators);
    return () => {
      isCurrent = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadUnreadIndicators);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    navigate("/");
  };

  const navItems = [
    { to: "/feed", icon: House, label: "Feed" },
    { to: "/explore", icon: Compass, label: "Explore" },
    { to: "/messages", icon: MessagesSquare, label: "Messages", count: unreadMessageSenderCount },
    { to: "/notifications", icon: BellRing, label: "Notifications", count: unreadCount },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl flex-shrink-0">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
              <Orbit className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hidden sm:inline">
              ConnectSphere
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 rounded-xl transition-all relative ${
                    isActive(item.to)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {(item.count ?? 0) > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-gradient-to-br from-primary to-secondary text-white text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm">
                      {(item.count ?? 0) > 9 ? "9+" : item.count}
                    </span>
                  ) : null}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {!checkingAuth && isAuthenticated ? (
              <>
                <div className="hidden sm:block relative" ref={profileMenuRef}>
                  <button type="button"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-muted transition-all border border-transparent hover:border-border"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                      {user?.profilePicUrl ? (
                        <img src={user.profilePicUrl} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-xs font-bold">
                          {(user?.fullName || user?.username || "U").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium max-w-[100px] truncate">{user?.fullName || user?.username}</span>
                      {user?.isPremium && <VerifiedBadge />}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-border shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="font-semibold text-sm truncate flex items-center gap-1">
                          {user?.fullName}
                          {user?.isPremium && <VerifiedBadge className="w-3.5 h-3.5 text-primary" />}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
                      </div>
                      {[
                        { icon: House, label: "My Profile", to: `/users/${user?.id}` },
                        { icon: Bookmark, label: "Bookmarks", to: "/bookmarks" },
                        { icon: CreditCard, label: "Payments", to: "/payments" },
                        { icon: Settings, label: "Settings", to: "/settings" },
                        ...(user?.role === "ADMIN" || user?.role === "ROLE_ADMIN"
                          ? [{ icon: Shield, label: "Admin Dashboard", to: "/admin" }]
                          : []),
                      ].map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                        >
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          {item.label}
                        </Link>
                      ))}
                      <div className="border-t border-border mt-1 pt-1">
                        <button type="button"
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button type="button"
                  className="sm:hidden w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden"
                  onClick={() => navigate(`/users/${user?.id}`)}
                >
                  {user?.profilePicUrl ? (
                    <img src={user.profilePicUrl} alt={user?.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {(user?.fullName || user?.username || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
              </>
            ) : !checkingAuth ? (
              <>
                <Link to="/auth/login" className="hidden sm:block">
                  <Button variant="outline" size="sm" className="rounded-xl">Sign In</Button>
                </Link>
                <Link to="/auth/signup">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white rounded-xl shadow-sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            ) : null}

            <button type="button"
              className="md:hidden p-2 rounded-xl hover:bg-muted transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-white/98 backdrop-blur animate-in slide-in-from-top-2 duration-150">
            <nav className="container px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
                    isActive(item.to) ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                    {(item.count ?? 0) > 0 && (
                      <span className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {(item.count ?? 0) > 9 ? "9+" : item.count}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              {isAuthenticated && (
                <>
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    {[
                      { icon: Bookmark, label: "Bookmarks", to: "/bookmarks" },
                      { icon: CreditCard, label: "Payments", to: "/payments" },
                      { icon: Settings, label: "Settings", to: "/settings" },
                      ...(user?.role === "ADMIN" || user?.role === "ROLE_ADMIN"
                        ? [{ icon: Shield, label: "Admin Dashboard", to: "/admin" }]
                        : []),
                    ].map((item) => (
                      <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                          <item.icon className="w-5 h-5" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                      </Link>
                    ))}
                    <button type="button" onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all w-full text-left">
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Sign Out</span>
                    </button>
                  </div>
                </>
              )}
              {!isAuthenticated && (
                <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                    <LogIn className="w-5 h-5" />
                    <span className="text-sm">Sign In</span>
                  </div>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-border shadow-[0_-1px_0_0_theme(colors.border)]">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive(item.to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive(item.to) && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
              <item.icon className={`w-5 h-5 ${isActive(item.to) ? "fill-primary/20" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {(item.count ?? 0) > 0 && (
                <span className="absolute top-0 right-1 bg-primary text-white text-[8px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-0.5">
                  {(item.count ?? 0) > 9 ? "9+" : item.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
