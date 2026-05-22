import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/service-helpers";
import { toast } from "sonner";
import {
  Image, Video, X, Send, Globe, Lock, Users, Hash,
  Smile, MapPin, CalendarClock, AlertTriangle, ArrowLeft
} from "lucide-react";

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public", icon: Globe, desc: "Anyone can see" },
  { value: "FOLLOWERS_ONLY", label: "Followers", icon: Users, desc: "Only followers" },
  { value: "PRIVATE", label: "Private", icon: Lock, desc: "Only you" },
];

export default function CreatePostPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentWarning, setContentWarning] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <div className="app-shell">
          <div className="app-page flex items-center justify-center app-page-fill">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Sign in to create a post</h2>
              <p className="text-muted-foreground mb-4">You need to be logged in to share your thoughts.</p>
              <button type="button" onClick={() => navigate("/auth/login")} className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + mediaFiles.length > 4) {
      toast.error("Maximum 4 media files allowed");
      return;
    }
    const newPreviews = files.map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video/") ? "video" : "image",
      name: f.name,
    }));
    setMediaFiles((prev) => [...prev, ...files]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeMedia = (index) => {
    URL.revokeObjectURL(mediaPreviews[index].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error("Write something or add media");
      return;
    }
    setIsSubmitting(true);
    try {
      const normalizedContent = content.trim() || (mediaFiles.length > 0 ? "Shared a media update" : "");
      const postData = {
        authorId: user.id,
        content: normalizedContent,
        visibility,
        contentWarning,
      };
      if (mediaFiles.length > 0) {
        postData.postType = "MEDIA";
      }
      if (scheduledDate) {
        postData.scheduledPublishAt = scheduledDate;
      }

      const createdPost = await api.posts.createPost(postData);
      const postId = createdPost?.postId;
      if (mediaFiles.length > 0 && postId) {
        const uploadedUrls = [];
        for (const file of mediaFiles) {
          const result = await api.media.upload(file, user.id, postId);
          const uploadedUrl = resolveMediaUrl(result);
          if (uploadedUrl) {
            uploadedUrls.push(uploadedUrl);
          }
        }

        if (uploadedUrls.length > 0) {
          await api.posts.updatePost(postId, {
            content: createdPost.content || normalizedContent,
            mediaUrls: uploadedUrls,
            postType: "MEDIA",
            visibility: createdPost.visibility || visibility,
            contentWarning,
          });
        }
      }
      toast.success(scheduledDate ? "Post scheduled!" : "Post published!");
      navigate("/feed");
    } catch (err) {
      toast.error(err.message || "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const extractHashtags = (text) => {
    const matches = text.match(/#[\w]+/g);
    return matches ? [...new Set(matches)] : [];
  };

  const hashtags = extractHashtags(content);
  const charCount = content.length;
  const maxChars = 2000;

  return (
    <>
      <Header />
      <div className="app-shell">
        <div className="app-page max-w-2xl mx-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Create Post
            </h1>
            <div className="w-16" />
          </div>

          {/* Post Card */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Author Row */}
            <div className="flex items-center gap-3 p-4 pb-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user?.profilePicUrl ? (
                  <img src={user.profilePicUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-bold">
                    {(user?.fullName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{user?.fullName || user?.username}</p>
                <div className="flex items-center gap-1.5">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button type="button"
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        visibility === opt.value
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <opt.icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind? Use #hashtags to categorize..."
                className="w-full min-h-[180px] resize-none text-[15px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none bg-transparent"
                maxLength={maxChars}
                autoFocus
              />

              {/* Character Count */}
              <div className="flex items-center justify-between mt-1">
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                      <Hash className="w-3 h-3" />
                      {tag.slice(1)}
                    </span>
                  ))}
                </div>
                <span className={`text-xs font-medium ${charCount > maxChars * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
                  {charCount}/{maxChars}
                </span>
              </div>
            </div>

            {/* Media Previews */}
            {mediaPreviews.length > 0 && (
              <div className={`px-4 pb-4 grid gap-2 ${mediaPreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {mediaPreviews.map((media, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden bg-muted aspect-video group">
                    {media.type === "video" ? (
                      <video src={media.url} className="w-full h-full object-cover" controls />
                    ) : (
                      <img src={media.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Content Warning */}
            {contentWarning && (
              <div className="mx-4 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                This post will be marked as sensitive content
              </div>
            )}

            {/* Schedule */}
            {showSchedule && (
              <div className="mx-4 mb-3 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                <label className="text-xs font-medium text-primary mb-1 block">Schedule publish time</label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full text-sm bg-transparent focus:outline-none text-foreground"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
              <div className="flex items-center gap-1">
                <label className="p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors text-muted-foreground hover:text-primary">
                  <Image className="w-5 h-5" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleMediaSelect} />
                </label>
                <label className="p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors text-muted-foreground hover:text-primary">
                  <Video className="w-5 h-5" />
                  <input type="file" accept="video/*" className="hidden" onChange={handleMediaSelect} />
                </label>
                <button type="button" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                  <Smile className="w-5 h-5" />
                </button>
                <button type="button" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                  <MapPin className="w-5 h-5" />
                </button>
                <button type="button"
                  onClick={() => setContentWarning(!contentWarning)}
                  className={`p-2 rounded-xl transition-colors ${contentWarning ? "bg-amber-100 text-amber-600" : "hover:bg-muted text-muted-foreground hover:text-amber-500"}`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </button>
                <button type="button"
                  onClick={() => setShowSchedule(!showSchedule)}
                  className={`p-2 rounded-xl transition-colors ${showSchedule ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}
                >
                  <CalendarClock className="w-5 h-5" />
                </button>
              </div>

              <button type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || (!content.trim() && mediaFiles.length === 0)}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Posting..." : scheduledDate ? "Schedule" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
