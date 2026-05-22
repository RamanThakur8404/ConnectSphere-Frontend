import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { normalizeStoryList, resolveMediaUrl, toDisplayMediaUrl } from "@/lib/service-helpers";
import { toast } from "sonner";
import {
  Plus, X, Eye, ChevronLeft, ChevronRight, Clock, Image as ImageIcon,
  Video, Loader2, Trash2
} from "lucide-react";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function timeLeft(createdAt) {
  const expiry = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const diff = expiry - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m left`;
}

export default function Stories() {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [myStories, setMyStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    loadStories();
  }, [user]);

  const loadStories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const following = await api.follows.getFollowing(user.id);
      const followeeIds = following.map((f) => f.followeeId || f.userId || f.id).filter(Boolean);
      followeeIds.push(user.id);

      if (followeeIds.length > 0) {
        const activeStories = normalizeStoryList(await api.media.getActiveStories(followeeIds));
        const grouped = {};
        activeStories.forEach((story) => {
          const authorId = story.authorId;
          if (!grouped[authorId]) grouped[authorId] = [];
          grouped[authorId].push(story);
        });

        const myGroup = grouped[user.id] || [];
        delete grouped[user.id];
        setMyStories(myGroup);
        setStories(Object.entries(grouped).map(([authorId, items]) => ({ authorId: Number(authorId), items })));
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.media.upload(file, user.id);
      const mediaUrl = resolveMediaUrl(result);
      if (!mediaUrl) throw new Error("No URL returned from media service");
      const mediaTypes = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      await api.media.createStory({ authorId: user.id, mediaUrl, mediaTypes });
      toast.success("Story published!");
      await loadStories();
    } catch (err) {
      toast.error(err.message || "Failed to create story");
    } finally {
      setUploading(false);
    }
  };

  const openStory = (authorStories, index = 0) => {
    setViewingStory(authorStories);
    setViewIndex(index);
  };

  const nextStory = () => {
    if (viewIndex < viewingStory.length - 1) {
      setViewIndex(viewIndex + 1);
    } else {
      setViewingStory(null);
    }
  };

  const prevStory = () => {
    if (viewIndex > 0) setViewIndex(viewIndex - 1);
  };

  const handleViewStory = async (story) => {
    try {
      await api.media.viewStory(story.storyId || story.id, user.id);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    if (viewingStory && viewingStory[viewIndex]) {
      handleViewStory(viewingStory[viewIndex]);
      // Auto-advance after 5 seconds for images
      const story = viewingStory[viewIndex];
      const isVideo = String(story.mediaTypes || "").toUpperCase() === "VIDEO";
      if (!isVideo) {
        const timer = setTimeout(nextStory, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [viewingStory, viewIndex]);

  const deleteStory = async (storyId) => {
    try {
      await api.media.deleteStory(storyId);
      toast.success("Story deleted");
      await loadStories();
      setViewingStory(null);
    } catch (err) {
      toast.error("Failed to delete story");
    }
  };

  return (
    <>
      <Header />
      <div className="app-shell">
        <div className="app-page max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Stories
          </h1>

          {/* Story Row */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {/* Create Story */}
            <div className="flex-shrink-0 w-24">
              <button type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-24 h-36 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-all group"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                )}
                <span className="text-[11px] font-medium text-primary">
                  {uploading ? "Uploading..." : "Add Story"}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleCreateStory} />
            </div>

            {/* My Stories */}
            {myStories.length > 0 && (
              <div className="flex-shrink-0 w-24">
                <button type="button"
                  onClick={() => openStory(myStories)}
                  className="relative w-24 h-36 rounded-2xl overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-20" />
                  {myStories[0]?.mediaUrl && (
                    <img src={toDisplayMediaUrl(myStories[0].mediaUrl)} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <p className="text-white text-[11px] font-semibold">Your Story</p>
                    <p className="text-white/60 text-[9px]">{myStories.length} stories</p>
                  </div>
                  <div className="absolute top-1.5 left-1.5 right-1.5 flex gap-0.5">
                    {myStories.map((_, i) => (
                      <div key={i} className="flex-1 h-0.5 bg-white/60 rounded-full" />
                    ))}
                  </div>
                </button>
              </div>
            )}

            {/* Other Stories */}
            {stories.map((group) => (
              <div key={group.authorId} className="flex-shrink-0 w-24">
                <button type="button"
                  onClick={() => openStory(group.items)}
                  className="relative w-24 h-36 rounded-2xl overflow-hidden group ring-2 ring-primary/50 ring-offset-2"
                >
                  {group.items[0]?.mediaUrl && (
                    <img src={toDisplayMediaUrl(group.items[0].mediaUrl)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <p className="text-white text-[11px] font-semibold truncate px-1">User {group.authorId}</p>
                  </div>
                </button>
              </div>
            ))}

            {loading && (
              <div className="flex items-center justify-center w-24 h-36">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Empty State */}
          {!loading && stories.length === 0 && myStories.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No Stories Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Share photos and videos that disappear after 24 hours.
              </p>
              <button type="button"
                onClick={() => fileRef.current?.click()}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium text-sm shadow-sm hover:shadow-md transition-all"
              >
                Create Your First Story
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Story Viewer Overlay */}
      {viewingStory && viewingStory[viewIndex] && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          {/* Progress Bars */}
          <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
            {viewingStory.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    i < viewIndex ? "bg-white w-full" : i === viewIndex ? "bg-white animate-pulse w-full" : "w-0"
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Story Header */}
          <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {(viewingStory[viewIndex].authorId === user?.id ? user?.fullName?.[0] : "U") || "U"}
                </span>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">
                  {viewingStory[viewIndex].authorId === user?.id ? "You" : `User ${viewingStory[viewIndex].authorId}`}
                </p>
                <div className="flex items-center gap-2 text-white/60 text-[11px]">
                  <Clock className="w-3 h-3" />
                  {timeAgo(viewingStory[viewIndex].createdAt)}
                  <span>·</span>
                  <Eye className="w-3 h-3" />
                  {viewingStory[viewIndex].viewsCount || 0} views
                  <span>·</span>
                  {timeLeft(viewingStory[viewIndex].createdAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewingStory[viewIndex].authorId === user?.id && (
                <button type="button"
                  onClick={() => deleteStory(viewingStory[viewIndex].storyId || viewingStory[viewIndex].id)}
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => setViewingStory(null)} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Story Content */}
          <div className="max-w-lg w-full h-[80vh] relative">
            {String(viewingStory[viewIndex].mediaTypes || "").toUpperCase() === "VIDEO" ? (
              <video
                src={toDisplayMediaUrl(viewingStory[viewIndex].mediaUrl)}
                className="w-full h-full object-contain"
                autoPlay
                onEnded={nextStory}
              />
            ) : (
              <img src={toDisplayMediaUrl(viewingStory[viewIndex].mediaUrl)} alt="" className="w-full h-full object-contain" />
            )}
          </div>

          {/* Navigation */}
          <button type="button" onClick={prevStory} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button type="button" onClick={nextStory} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
}
