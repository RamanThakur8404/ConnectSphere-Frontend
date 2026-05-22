import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { Plus, X, Loader2, Eye, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getStoryMediaType, getStoryViews, normalizeStoryList, resolveMediaUrl, toDisplayMediaUrl } from "@/lib/service-helpers";

export function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [authorNames, setAuthorNames] = useState({});
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    void fetchStories();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);

  useEffect(() => {
    stories.forEach((group) => {
      if (!authorNames[group.authorId]) {
        api.auth.getPublicProfile(group.authorId).then((profile) => {
          if (profile) {
            setAuthorNames((currentNames) => ({
              ...currentNames,
              [group.authorId]: profile.fullName || profile.username || `User ${group.authorId}`,
            }));
          }
        }).catch(() => {});
      }
    });
  }, [authorNames, stories]);

  const fetchStories = async () => {
    if (!user) {
      setLoading(false);
      setStories([]);
      return;
    }

    setLoading(true);
    try {
      const followingData = await api.follows.getFollowing(user.id).catch(() => []);
      const followeeIds = Array.isArray(followingData) ? followingData.map((follow) => follow.followeeId || follow.id || follow) : [];
      const allIds = [user.id, ...followeeIds];

      if (allIds.length === 0) {
        setStories([]);
        return;
      }

      const activeStories = normalizeStoryList(await api.media.getActiveStories(allIds).catch(() => []));
      const groupedStories = {};
      activeStories.forEach((story) => {
        const authorId = story.authorId;
        if (!groupedStories[authorId]) {
          groupedStories[authorId] = { authorId, stories: [] };
        }
        groupedStories[authorId].stories.push(story);
      });
      setStories(Object.values(groupedStories));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async (file) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const uploadResult = await api.media.upload(file, user.id);
      const mediaUrl = resolveMediaUrl(uploadResult);
      if (!mediaUrl) {
        throw new Error("No URL returned from media service");
      }

      const mediaTypes = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      await api.media.createStory({ authorId: user.id, mediaUrl, mediaTypes });
      toast.success("Story posted!");
      await fetchStories();
    } catch (error) {
      toast.error(error?.message || "Failed to create story");
    } finally {
      setUploading(false);
    }
  };

  const startAutoAdvance = (group, index) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index + 1 < group.stories.length) {
        const nextIndex = index + 1;
        setStoryIndex(nextIndex);
        startAutoAdvance(group, nextIndex);
      } else {
        setViewingStory(null);
      }
    }, 5000);
  };

  const openStory = (group, index = 0) => {
    setViewingStory(group);
    setStoryIndex(index);
    const story = group.stories[index];
    if (story && user && story.authorId !== user.id) {
      api.media.viewStory(story.storyId || story.id, user.id).catch(() => {});
    }
    startAutoAdvance(group, index);
  };

  const nextStory = () => {
    if (!viewingStory) return;
    if (storyIndex + 1 < viewingStory.stories.length) {
      const nextIndex = storyIndex + 1;
      setStoryIndex(nextIndex);
      startAutoAdvance(viewingStory, nextIndex);
    } else {
      setViewingStory(null);
    }
  };

  const prevStory = () => {
    if (!viewingStory || storyIndex <= 0) return;
    const nextIndex = storyIndex - 1;
    setStoryIndex(nextIndex);
    startAutoAdvance(viewingStory, nextIndex);
  };

  const handleDeleteStory = async (storyId) => {
    try {
      await api.media.deleteStory(storyId);
      toast.success("Story deleted");
      setViewingStory(null);
      await fetchStories();
    } catch (error) {
      toast.error(error?.message || "Failed to delete story");
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border mb-4 sm:mb-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide" ref={scrollRef}>
          {user && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex flex-col items-center gap-1.5 min-w-[72px] group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-dashed border-primary/40 flex items-center justify-center group-hover:border-primary transition-all relative">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Your story</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.[0]) {
                void handleCreateStory(event.target.files[0]);
              }
              event.target.value = "";
            }}
          />

          {loading ? (
            [1, 2, 3].map((item) => (
              <div key={item} className="flex flex-col items-center gap-1.5 min-w-[72px]">
                <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
                <div className="w-10 h-2 bg-muted rounded animate-pulse" />
              </div>
            ))
          ) : (
            stories.map((group) => (
              <button type="button" key={group.authorId} onClick={() => openStory(group)} className="flex flex-col items-center gap-1.5 min-w-[72px] group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary p-[2.5px]">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sm font-bold text-primary overflow-hidden">
                    {(authorNames[group.authorId] || "U").charAt(0).toUpperCase()}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[72px]">
                  {group.authorId === user?.id ? "You" : (authorNames[group.authorId] || `User ${group.authorId}`).split(" ")[0]}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {viewingStory && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center" onClick={() => setViewingStory(null)}>
          <div className="relative w-full max-w-lg h-full max-h-[90vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex gap-1 p-3 absolute top-0 left-0 right-0 z-10">
              {viewingStory.stories.map((story, index) => (
                <div key={story.storyId || index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-[5000ms] ${index < storyIndex ? "bg-white w-full" : index === storyIndex ? "bg-white w-full animate-[progress_5s_linear]" : "bg-transparent w-0"}`} />
                </div>
              ))}
            </div>

            <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                  {(authorNames[viewingStory.authorId] || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{authorNames[viewingStory.authorId] || `User ${viewingStory.authorId}`}</div>
                  <div className="text-white/60 text-[10px]">
                    {new Date(viewingStory.stories[storyIndex]?.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewingStory.authorId === user?.id && (
                  <button type="button" onClick={() => void handleDeleteStory(viewingStory.stories[storyIndex]?.storyId || viewingStory.stories[storyIndex]?.id)} className="text-white/80 hover:text-white p-1" title="Delete story">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                {getStoryViews(viewingStory.stories[storyIndex]) > 0 && (
                  <span className="text-white/60 text-xs flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />{getStoryViews(viewingStory.stories[storyIndex])}
                  </span>
                )}
                <button type="button" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); setViewingStory(null); }} className="text-white/80 hover:text-white p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden">
              {(() => {
                const story = viewingStory.stories[storyIndex];
                if (!story) return null;
                return getStoryMediaType(story) === "VIDEO"
                  ? <video src={toDisplayMediaUrl(story.mediaUrl)} autoPlay muted className="max-w-full max-h-full object-contain" />
                  : <img src={toDisplayMediaUrl(story.mediaUrl)} alt="Story" className="max-w-full max-h-full object-contain" />;
              })()}
            </div>

            <button type="button" onClick={prevStory} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={nextStory} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full transition">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
