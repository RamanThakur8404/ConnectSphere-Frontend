import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Shield, BarChart3, Flag, Activity, Users, Bell, Receipt,
  LogOut, ChevronLeft, ChevronRight, Orbit,
} from "lucide-react";
import { useState, useEffect } from "react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const ADMIN_NAV = [
  { id: "overview", label: "Dashboard", icon: BarChart3, path: "/admin" },
  { id: "reports", label: "Reports", icon: Flag, path: "/admin/reports" },
  { id: "audit", label: "Audit Logs", icon: Activity, path: "/admin/audit" },
  { id: "users", label: "User Mgmt", icon: Users, path: "/admin/users" },
  { id: "notifications", label: "Notifications", icon: Bell, path: "/admin/notifications" },
  { id: "payments", label: "Payments", icon: Receipt, path: "/admin/payments" },
];

export function AdminLayout({ children, activeTab }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Derive active from URL if not passed
  const currentTab = activeTab || ADMIN_NAV.find(
    (item) => item.path === location.pathname
  )?.id || "overview";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="admin-layout">
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${collapsed ? "admin-sidebar--collapsed" : ""} ${mobileOpen ? "admin-sidebar--open" : ""}`}>
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__logo">
            <div className="admin-sidebar__logo-icon">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="admin-sidebar__logo-text">Admin Panel</span>
            )}
          </div>
          <button type="button"
            className="admin-sidebar__toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar__nav">
          {ADMIN_NAV.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`admin-sidebar__link ${isActive ? "admin-sidebar__link--active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="admin-sidebar__link-icon" />
                {!collapsed && <span className="admin-sidebar__link-label">{item.label}</span>}
                {isActive && <span className="admin-sidebar__active-indicator" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — User info */}
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__avatar">
              {user?.profilePicUrl ? (
                <img src={user.profilePicUrl} alt={user.username} className="admin-sidebar__avatar-img" />
              ) : (
                <span className="admin-sidebar__avatar-letter">
                  {(user?.fullName || user?.username || "A").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!collapsed && (
              <div className="admin-sidebar__user-info">
                <div className="admin-sidebar__user-name">
                  {user?.fullName || user?.username}
                  {user?.isPremium && <VerifiedBadge className="w-3.5 h-3.5 ml-1 text-primary inline-block" />}
                </div>
                <div className="admin-sidebar__user-role">
                  <span className="admin-sidebar__role-badge">{user?.role || "ADMIN"}</span>
                </div>
              </div>
            )}
          </div>
          <button type="button"
            onClick={handleLogout}
            className="admin-sidebar__logout"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className={`admin-main ${collapsed ? "admin-main--expanded" : ""}`}>
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button type="button"
              className="admin-topbar__hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="admin-topbar__home" title="Back to ConnectSphere">
              <div className="admin-topbar__home-icon">
                <Orbit className="w-4 h-4 text-white" />
              </div>
              <span className="admin-topbar__home-text">ConnectSphere</span>
            </Link>
          </div>
          <div className="admin-topbar__right">
            <span className="admin-topbar__welcome">Welcome, <strong>{user?.fullName || user?.username || "Admin"}</strong></span>
          </div>
        </header>

        {/* Content area */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}

// Export the nav items for use in AdminDashboard to sync tabs
export { ADMIN_NAV };
