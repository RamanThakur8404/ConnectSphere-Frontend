import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  User, Lock, Camera, ArrowLeft, Loader2, Save, Eye, EyeOff,
  Shield, LogOut, Flag, RefreshCw, BrainCircuit,
} from "lucide-react";

export default function Settings() {
  const { user, isLoading: authLoading, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsPage, setReportsPage] = useState(0);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const reportsPageSize = 20;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth/login", { replace: true, state: { from: "/settings" } });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || "");
    setBio(user.bio || "");
    setProfilePicUrl(user.profilePicUrl || "");
  }, [user]);

  useEffect(() => {
    if (!user || tab !== "reports") return;
    void loadReports();
  }, [reportsPage, tab, user]);

  const loadReports = async () => {
    if (!user) return;
    setReportsLoading(true);
    try {
      const data = await api.reports.getUserReports(user.id, reportsPage, reportsPageSize);
      const nextReports = data?.content || (Array.isArray(data) ? data : []);
      setReports(nextReports);
      setReportsTotal(Number(data?.totalElements ?? data?.total ?? nextReports.length));
    } catch {
      toast.error("Failed to load your reports");
    } finally {
      setReportsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.auth.updateProfile({ fullName, bio, profilePicUrl });
      await refreshProfile();
      toast.success("Profile updated!");
    } catch (error) {
      toast.error(error.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Min 8 characters");
      return;
    }

    setSaving(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      toast.success("Password changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("Logged out");
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Security", icon: Lock },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "privacy", label: "Privacy", icon: Shield },
  ];

  if (authLoading || !user) {
    return (
      <>
        <Header />
        <main className="app-shell-muted">
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-5xl">
          <div className="flex items-center gap-4 mb-6">
            <button type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-white border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your account preferences</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <div className="bg-white rounded-2xl border border-border shadow-sm p-2 space-y-1">
                {tabs.map((currentTab) => (
                  <button type="button"
                    key={currentTab.id}
                    onClick={() => setTab(currentTab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      tab === currentTab.id
                        ? "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <currentTab.icon className="w-4 h-4" />
                    {currentTab.label}
                  </button>
                ))}
                <div className="border-t border-border pt-1 mt-1">
                  <button type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                {tab === "profile" && (
                  <div className="p-6 sm:p-8">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Edit Profile
                    </h2>

                    <div className="flex items-center gap-5 mb-8 pb-6 border-b border-border">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
                          {profilePicUrl ? (
                            <img
                              src={profilePicUrl}
                              alt="avatar"
                              className="w-full h-full object-cover"
                              onError={() => setProfilePicUrl("")}
                            />
                          ) : (
                            (user.fullName || user.username).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center border-2 border-white">
                          <Camera className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{user.fullName || user.username}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                        <p className="text-xs text-muted-foreground mt-1">Paste an image URL below to update your photo</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Your full name"
                          className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">Bio</label>
                        <textarea
                          value={bio}
                          onChange={(event) => setBio(event.target.value)}
                          placeholder="Tell people about yourself..."
                          rows={3}
                          maxLength={200}
                          className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/200</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">Profile Photo URL</label>
                        <input
                          type="url"
                          value={profilePicUrl}
                          onChange={(event) => setProfilePicUrl(event.target.value)}
                          placeholder="https://example.com/photo.jpg"
                          className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                        />
                      </div>

                      <div className="pt-2">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white rounded-xl gap-2 px-6"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "password" && (
                  <div className="p-6 sm:p-8">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-primary" />
                      Change Password
                    </h2>

                    <div className="space-y-5 max-w-md">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrent ? "text" : "password"}
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            placeholder="Enter current password"
                            className="w-full pl-4 pr-10 py-3 bg-muted/50 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                          >
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">New Password</label>
                        <div className="relative">
                          <input
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Minimum 8 characters"
                            className="w-full pl-4 pr-10 py-3 bg-muted/50 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                          >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground/80">Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Re-enter new password"
                          className={`w-full px-4 py-3 bg-muted/50 rounded-xl border outline-none focus:ring-2 focus:ring-primary/30 transition-all text-sm ${
                            confirmPassword && newPassword !== confirmPassword
                              ? "border-destructive focus:ring-destructive/20"
                              : "border-border focus:border-primary"
                          }`}
                        />
                        {confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-xs text-destructive mt-1">Passwords don't match</p>
                        )}
                      </div>

                      <Button
                        onClick={handleChangePassword}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-secondary text-white rounded-xl gap-2 px-6"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Update Password
                      </Button>
                    </div>
                  </div>
                )}

                {tab === "privacy" && (
                  <div className="p-6 sm:p-8">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Privacy Settings
                    </h2>
                    <div className="space-y-4">
                      {[
                        { label: "Show profile to everyone", desc: "Anyone on ConnectSphere can view your profile", defaultOn: true },
                        { label: "Allow followers only feed", desc: "Only followers can see your posts in their feed", defaultOn: false },
                        { label: "Email notifications", desc: "Receive email alerts for likes, comments and follows", defaultOn: true },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all"
                        >
                          <div>
                            <p className="font-semibold text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked={item.defaultOn} className="sr-only peer" />
                            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all border border-border" />
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      These toggles are UI-only right now. The backend does not expose privacy-preference endpoints yet.
                    </p>
                  </div>
                )}

                {tab === "reports" && (
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                          <Flag className="w-5 h-5 text-amber-500" />
                          Your Reports
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Track moderation status and AI analysis for reports you submitted.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full gap-2"
                        onClick={() => void loadReports()}
                        disabled={reportsLoading}
                      >
                        {reportsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Refresh
                      </Button>
                    </div>

                    {reportsLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : reports.length === 0 ? (
                      <div className="rounded-2xl border border-border bg-muted/20 p-10 text-center">
                        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                          <Flag className="w-7 h-7 text-amber-600" />
                        </div>
                        <h3 className="font-semibold text-lg mb-1">No reports submitted yet</h3>
                        <p className="text-sm text-muted-foreground">
                          When you report a post, comment, or user, it will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reports.map((report) => {
                          const severity = Number(report.aiSeverityScore ?? 0);
                          return (
                            <div key={report.reportId || report.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                <div>
                                  <div className="font-semibold text-sm">{report.reason || "Report"}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {report.targetType} #{report.targetId} / submitted {new Date(report.createdAt).toLocaleString()}
                                  </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                  report.status === "PENDING"
                                    ? "bg-amber-100 text-amber-700"
                                    : report.status === "RESOLVED"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {report.status}
                                </span>
                              </div>

                              {report.description && (
                                <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                              )}

                              <div className="rounded-xl border border-border bg-muted/20 p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <BrainCircuit className="w-4 h-4" />
                                    AI Analysis
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                    severity >= 8
                                      ? "bg-red-100 text-red-700"
                                      : severity >= 5
                                      ? "bg-amber-100 text-amber-700"
                                      : severity > 0
                                      ? "bg-green-100 text-green-700"
                                      : "bg-muted text-muted-foreground"
                                  }`}>
                                    {severity > 0 ? `Severity ${severity}/10` : "Pending"}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed">
                                  {report.aiAnalysis || "AI analysis is still processing for this report."}
                                </p>
                              </div>

                              {(report.resolutionNote || report.resolvedAt || report.resolvedBy) && (
                                <div className="mt-4 rounded-xl border border-border bg-green-50/60 p-4">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">
                                    Resolution
                                  </div>
                                  <p className="text-sm text-foreground">
                                    {report.resolutionNote || "This report was reviewed by the moderation team."}
                                  </p>
                                  <div className="text-xs text-muted-foreground mt-2">
                                    {report.resolvedBy ? `Resolved by admin #${report.resolvedBy}` : "Resolved"}
                                    {report.resolvedAt ? ` / ${new Date(report.resolvedAt).toLocaleString()}` : ""}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {reportsTotal > reportsPageSize && (
                          <div className="flex items-center justify-between gap-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              disabled={reportsPage === 0 || reportsLoading}
                              onClick={() => setReportsPage((currentPage) => Math.max(0, currentPage - 1))}
                            >
                              Previous
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              Page {reportsPage + 1} of {Math.max(1, Math.ceil(reportsTotal / reportsPageSize))}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              disabled={(reportsPage + 1) * reportsPageSize >= reportsTotal || reportsLoading}
                              onClick={() => setReportsPage((currentPage) => currentPage + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
