import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/service-helpers";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, Save, Loader2, User, Mail, FileText, Link as LinkIcon
} from "lucide-react";

export default function EditProfile() {
  const { user, refreshProfile, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    bio: "",
    email: "",
    profilePicUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || "",
        username: user.username || "",
        bio: user.bio || "",
        email: user.email || "",
        profilePicUrl: user.profilePicUrl || "",
      });
    }
  }, [user]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.media.upload(file, user.id);
      const url = resolveUploadedImageUrl(result);
      if (!url) {
        toast.error("Upload finished but no image URL was returned");
        return;
      }
      setForm((prev) => ({ ...prev, profilePicUrl: url }));
      toast.success("Photo uploaded!");
    } catch (err) {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (uploading) {
      toast.error("Please wait for the photo upload to finish");
      return;
    }
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username.trim())) {
      toast.error("Username must be 3-30 characters and use only letters, digits, or underscores");
      return;
    }
    setSaving(true);
    try {
      const updatedProfile = await api.auth.updateProfile({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        bio: form.bio.trim(),
        profilePicUrl: form.profilePicUrl,
      });
      updateUser?.({ ...updatedProfile, profilePicUrl: form.profilePicUrl });
      await refreshProfile();
      toast.success("Profile updated!");
      navigate(`/users/${user.id}`);
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header />
      <div className="app-shell">
        <div className="app-page max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Edit Profile
            </h1>
            <div className="w-16" />
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Avatar */}
            <div className="flex justify-center py-6 bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden ring-4 ring-white shadow-lg">
                  {form.profilePicUrl ? (
                    <img src={form.profilePicUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-3xl font-bold">
                      {(form.fullName || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
            </div>

            {/* Fields */}
            <div className="p-6 space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  <LinkIcon className="w-3.5 h-3.5" /> Username
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Email cannot be changed here.</p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  <FileText className="w-3.5 h-3.5" /> Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  maxLength={300}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                  placeholder="Tell people about yourself..."
                />
                <p className="text-[11px] text-muted-foreground text-right mt-0.5">
                  {form.bio.length}/300
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
              <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl transition-colors">
                Cancel
              </button>
              <button type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : uploading ? "Uploading..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function resolveUploadedImageUrl(result = {}) {
  const payload = result?.data && typeof result.data === "object" ? result.data : result;
  return resolveMediaUrl(payload);
}
