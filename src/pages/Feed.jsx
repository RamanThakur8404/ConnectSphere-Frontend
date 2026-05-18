import { Header } from "@/components/Header";
import { CreatePost } from "@/components/CreatePost";
import { PostCard } from "@/components/PostCard";
import { CommentModal } from "@/components/CommentModal";
import { TrendingComponent } from "@/components/TrendingComponent";
import { SuggestedUsers } from "@/components/SuggestedUsers";
import { StoriesBar } from "@/components/StoriesBar";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.posts)) return value.posts;
  if (Array.isArray(value?.userIds)) return value.userIds;
  return [];
};

const normalizeUserId = (value) => {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "string") return Number(value);
  return Number(value.userId ?? value.id ?? value.followeeId ?? value.authorId);
};

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [suggestedIds, setSuggestedIds] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState("");

  const observer = useRef();

  const addViewerState = async (postList) => {
    if (!user || !postList?.length) return postList || [];

    const postIds = postList.map((post) => post.postId).filter(Boolean);
    const [likedMap, bookmarkedPosts] = await Promise.all([
      api.likes.hasLikedBatch(postIds, user.id).catch(() => ({})),
      api.posts.getBookmarks(user.id).catch(() => []),
    ]);
    const bookmarkedIds = new Set(normalizeList(bookmarkedPosts).map((post) => Number(post.postId)));

    return postList.map((post) => {
      const isBookmarked = bookmarkedIds.has(Number(post.postId));
      return {
        ...post,
        userLiked: !!likedMap[post.postId],
        isBookmarked,
        bookmarked: isBookmarked,
      };
    });
  };

  const lastPostElementRef = useCallback((node) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreFeed();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const fetchFeed = async () => {
    setLoading(true);
    setHasMore(true);
    setFeedError("");
    try {
      let feedPosts = [];
      if (user) {
        const followeesData = normalizeList(await api.follows.getFollowing(user.id).catch(() => []));
        const followeeIds = followeesData.map((f) => f.followeeId || f.id || f).filter(Boolean);
        if (followeeIds.length > 0) {
          feedPosts = normalizeList(await api.posts.getFeed(followeeIds, null, 20).catch(() => []));
        }
        if (!feedPosts || feedPosts.length === 0) {
          feedPosts = normalizeList(await api.posts.getPublicFeed(null, 20));
        }
      } else {
        feedPosts = normalizeList(await api.posts.getPublicFeed(null, 20));
      }

      if (feedPosts?.length < 20) setHasMore(false);

      if (user && feedPosts?.length) {
        setPosts(await addViewerState(feedPosts));
      } else {
        setPosts(feedPosts || []);
      }
    } catch (error) {
      const message = error?.message || "Failed to load feed";
      setPosts([]);
      setFeedError(message);
      toast.error("Failed to load feed", { id: "feed-load-error" });
    }
    finally { setLoading(false); }
  };

  const loadMoreFeed = async () => {
    if (!hasMore || loadingMore || posts.length === 0) return;
    setLoadingMore(true);
    const lastPost = posts[posts.length - 1];
    const cursor = Number(lastPost.postId);

    if (!Number.isInteger(cursor) || cursor <= 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    try {
      let feedPosts = [];
      if (user) {
        const followeesData = normalizeList(await api.follows.getFollowing(user.id).catch(() => []));
        const followeeIds = followeesData.map((f) => f.followeeId || f.id || f).filter(Boolean);
        if (followeeIds.length > 0) {
          feedPosts = normalizeList(await api.posts.getFeed(followeeIds, cursor, 20).catch(() => []));
        }
        if (!feedPosts || feedPosts.length === 0) {
          feedPosts = normalizeList(await api.posts.getPublicFeed(cursor, 20));
        }
      } else {
        feedPosts = normalizeList(await api.posts.getPublicFeed(cursor, 20));
      }

      if (!feedPosts || feedPosts.length === 0) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      if (feedPosts.length < 20) setHasMore(false);

      if (user) {
        const postsWithViewerState = await addViewerState(feedPosts);
        setPosts((prev) => {
          const existingIds = new Set(prev.map((post) => Number(post.postId)));
          return [...prev, ...postsWithViewerState.filter((post) => !existingIds.has(Number(post.postId)))];
        });
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((post) => Number(post.postId)));
          return [...prev, ...feedPosts.filter((post) => !existingIds.has(Number(post.postId)))];
        });
      }
    } catch {
      toast.error("Failed to load more posts", { id: "feed-load-more-error" });
    }
    finally { setLoadingMore(false); }
  };

  const fetchTrending = async () => {
    setTrendingLoading(true);
    try { const data = await api.searchAPI.getTrending(); setTrending(Array.isArray(data) ? data : []); }
    catch { setTrending([]); }
    finally { setTrendingLoading(false); }
  };

  const fetchSuggested = async () => {
    if (!user) { setSuggestedLoading(false); return; }
    setSuggestedLoading(true);
    try {
      const data = normalizeList(await api.follows.getSuggested(user.id).catch(() => []));
      let ids = data.map(normalizeUserId).filter((id) => Number.isFinite(id) && id !== Number(user.id));

      if (ids.length === 0) {
        const [publicPosts, followingData] = await Promise.all([
          api.posts.getPublicFeed(null, 30).catch(() => []),
          api.follows.getFollowing(user.id).catch(() => []),
        ]);
        const followingIds = new Set(normalizeList(followingData).map((item) => normalizeUserId(item)).filter(Number.isFinite));
        ids = normalizeList(publicPosts)
          .map((post) => normalizeUserId(post?.authorId))
          .filter((id) => Number.isFinite(id) && id !== Number(user.id) && !followingIds.has(id));
      }

      setSuggestedIds([...new Set(ids)].slice(0, 5));
    }
    catch { setSuggestedIds([]); }
    finally { setSuggestedLoading(false); }
  };

  useEffect(() => { fetchFeed(); fetchTrending(); fetchSuggested(); }, [user]);

  const handleCreatePost = async (content, mediaUrl, mediaType) => {
    if (!user) { toast.error("Please log in"); return; }
    setCreating(true);
    try {
      const trimmedContent = content.trim();
      const payload = {
        authorId: user.id,
        content: trimmedContent || (mediaUrl ? "Shared a media update" : ""),
      };
      if (mediaUrl) {
        payload.mediaUrls = [mediaUrl];
        payload.postType = "MEDIA";
      }
      await api.posts.createPost(payload);
      toast.success("Post created!");
      await fetchFeed();
    } catch (e) { toast.error(e.message || "Failed to create post"); }
    finally { setCreating(false); }
  };

  const handleLike = async (postId) => {
    if (!user) return;
    const post = posts.find((p) => p.postId === postId);
    if (!post) return;
    setPosts(posts.map((p) => p.postId === postId ? { ...p, userLiked: !p.userLiked, likesCount: p.userLiked ? p.likesCount - 1 : p.likesCount + 1 } : p));
    try {
      if (post.userLiked) await api.likes.unlikePost(postId, user.id);
      else await api.likes.likePost(postId, user.id);
    } catch {
      setPosts(posts.map((p) => p.postId === postId ? { ...p, userLiked: post.userLiked, likesCount: post.likesCount } : p));
      toast.error("Action failed");
    }
  };

  const handleFollow = async (userId) => {
    if (!user) return;
    try {
      await api.follows.followUser(user.id, userId);
      await fetchSuggested();
      setFollowRefreshKey((key) => key + 1);
      toast.success("Followed!");
    }
    catch (error) { toast.error(error?.message || "Failed to follow"); }
  };

  const handleUnfollow = async (userId) => {
    if (!user) return;
    try {
      await api.follows.unfollowUser(user.id, userId);
      await fetchSuggested();
      setFollowRefreshKey((key) => key + 1);
      toast.success("Unfollowed!");
    }
    catch (error) { toast.error(error?.message || "Failed to unfollow"); }
  };

  const updatePostMetric = (postId, field, valueOrUpdater) => {
    setPosts((currentPosts) => currentPosts.map((post) => {
      if (Number(post.postId) !== Number(postId)) return post;
      const currentValue = Number(post[field] || 0);
      const nextValue = typeof valueOrUpdater === "function" ? valueOrUpdater(currentValue) : Number(valueOrUpdater || 0);
      return { ...post, [field]: Math.max(0, nextValue) };
    }));
  };

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 md:gap-8">
            <div className="lg:col-span-8 xl:col-span-7">
              <StoriesBar key={followRefreshKey} />
              <CreatePost user={user} onSubmit={handleCreatePost} loading={creating} />
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : feedError ? (
                <div className="bg-white p-8 rounded-2xl text-center border border-border shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-lg font-semibold mb-2">Feed is unavailable</p>
                  <p className="text-sm text-muted-foreground mb-5">{feedError}</p>
                  <button
                    type="button"
                    onClick={fetchFeed}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border shadow-sm">
                  <p className="text-lg font-semibold mb-2">No posts yet</p>
                  <p className="text-sm">Follow users or create a post to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post, index) => {
                    const isLast = index === posts.length - 1;
                    return (
                      <div ref={isLast ? lastPostElementRef : null} key={`${post.postId}-${index}`}>
                        <PostCard post={post} onLike={handleLike} onCommentClick={() => setActiveCommentPostId(post.postId)} onRefresh={fetchFeed} onFollowClick={handleFollow} onUnfollowClick={handleUnfollow} onShareChange={(postId, value) => updatePostMetric(postId, "sharesCount", value)} />
                      </div>
                    );
                  })}
                  {loadingMore && (
                    <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  )}
                  {hasMore && !loadingMore && (
                    <div className="flex justify-center p-4">
                      <button
                        type="button"
                        onClick={loadMoreFeed}
                        className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition"
                      >
                        Next page
                      </button>
                    </div>
                  )}
                  {!hasMore && posts.length > 0 && (
                    <div className="text-center text-muted-foreground p-4 text-sm">You have caught up with the feed!</div>
                  )}
                </div>
              )}
            </div>
            <div className="hidden lg:block lg:col-span-4 xl:col-span-5 space-y-4 sm:space-y-6">
              <TrendingComponent hashtags={trending} loading={trendingLoading} />
              <SuggestedUsers userIds={suggestedIds} loading={suggestedLoading} onFollow={handleFollow} onUnfollow={handleUnfollow} />
            </div>
          </div>
        </div>
      </main>
      {activeCommentPostId !== null && (
        <CommentModal isOpen={true} onClose={() => setActiveCommentPostId(null)} postId={activeCommentPostId} onCommentCountChange={(postId, value) => updatePostMetric(postId, "commentsCount", value)} />
      )}
    </>
  );
}
