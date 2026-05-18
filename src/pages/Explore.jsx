import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { CommentModal } from "@/components/CommentModal";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search, Loader2, Hash, Users, FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.posts)) return value.posts;
  return [];
};

export default function Explore() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);

  useEffect(() => {
    void fetchExploreData();
  }, [user]);

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    setQuery(nextQuery);
    if (nextQuery) {
      void performSearch(nextQuery);
    } else {
      setPosts([]);
      setUsers([]);
      setHashtags([]);
    }
  }, [searchParams, user]);

  const fetchTrending = async () => {
    setTrendingLoading(true);
    try {
      const data = await api.searchAPI.getTrending();
      setTrending(Array.isArray(data) ? data : []);
    } catch {
      setTrending([]);
    } finally {
      setTrendingLoading(false);
    }
  };

  const addLikeState = async (postList) => {
    if (!user || postList.length === 0) return postList;

    const postIds = postList.map((post) => post.postId).filter(Boolean);
    const likedMap = await api.likes.hasLikedBatch(postIds, user.id).catch(() => ({}));

    return postList.map((post) => ({
      ...post,
      userLiked: !!likedMap[post.postId],
    }));
  };

  const fetchRecentPosts = async () => {
    setRecentLoading(true);
    setRecentError("");
    try {
      const data = await api.posts.getPublicFeed(null, 12);
      const realPosts = normalizeList(data);
      setRecentPosts(await addLikeState(realPosts));
    } catch (error) {
      setRecentPosts([]);
      setRecentError(error?.message || "Recent posts are unavailable");
    } finally {
      setRecentLoading(false);
    }
  };

  const fetchExploreData = async () => {
    await Promise.all([fetchTrending(), fetchRecentPosts()]);
  };

  const hydratePosts = async (postIds) => {
    let hydratedPosts = (await Promise.all(
      postIds.slice(0, 20).map((id) => api.posts.getPostById(id).catch(() => null))
    )).filter(Boolean);

    return addLikeState(hydratedPosts);
  };

  const performSearch = async (rawQuery) => {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery) {
      setPosts([]);
      setUsers([]);
      setHashtags([]);
      return;
    }

    setLoading(true);
    try {
      const normalizedHashtag = trimmedQuery.replace(/^#/, "");
      const exactHashtagSearch = trimmedQuery.startsWith("#");

      const [postResult, userResult, hashtagResult] = await Promise.all([
        api.searchAPI.searchPostIds(trimmedQuery).catch(() => ({ postIds: [] })),
        api.auth.searchUsers(trimmedQuery).catch(() => []),
        api.searchAPI.searchHashtags(normalizedHashtag).catch(() => []),
      ]);

      let hydratedPosts = [];
      if (exactHashtagSearch) {
        const hashtagPosts = await api.searchAPI.getPostsByHashtag(normalizedHashtag).catch(() => ({ postIds: [] }));
        hydratedPosts = await hydratePosts(hashtagPosts?.postIds || []);
      }

      if (hydratedPosts.length === 0) {
        hydratedPosts = await hydratePosts(postResult?.postIds || []);
      }

      const hydratedUsers = Array.isArray(userResult) ? userResult.slice(0, 20) : [];

      if (hydratedPosts.length === 0) {
        const directPosts = await api.posts.search(trimmedQuery).catch(() => []);
        if (Array.isArray(directPosts) && directPosts.length > 0) {
          hydratedPosts = await addLikeState(directPosts);
        }
      }

      setPosts(hydratedPosts);
      setUsers(hydratedUsers);
      setHashtags(Array.isArray(hashtagResult) ? hashtagResult : []);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearchParams({ q: query.trim() });
  };

  const handleLike = async (postId) => {
    if (!user) return;
    const selectedPost = [...posts, ...recentPosts].find((post) => post.postId === postId);
    if (!selectedPost) return;

    const nextPostState = (post) => post.postId === postId
      ? { ...post, userLiked: !post.userLiked, likesCount: post.userLiked ? (post.likesCount || 0) - 1 : (post.likesCount || 0) + 1 }
      : post;

    setPosts(posts.map(nextPostState));
    setRecentPosts(recentPosts.map(nextPostState));

    try {
      if (selectedPost.userLiked) {
        await api.likes.unlikePost(postId, user.id);
      } else {
        await api.likes.likePost(postId, user.id);
      }
    } catch {
      const previousPostState = (post) => post.postId === postId
        ? { ...post, userLiked: selectedPost.userLiked, likesCount: selectedPost.likesCount }
        : post;
      setPosts(posts.map(previousPostState));
      setRecentPosts(recentPosts.map(previousPostState));
      toast.error("Action failed");
    }
  };

  const refreshVisiblePosts = () => {
    if (query) {
      void performSearch(query);
    } else {
      void fetchRecentPosts();
    }
  };

  const updatePostMetric = (postId, field, valueOrUpdater) => {
    const applyMetric = (post) => {
      if (Number(post.postId) !== Number(postId)) return post;
      const currentValue = Number(post[field] || 0);
      const nextValue = typeof valueOrUpdater === "function" ? valueOrUpdater(currentValue) : Number(valueOrUpdater || 0);
      return { ...post, [field]: Math.max(0, nextValue) };
    };

    setPosts((currentPosts) => currentPosts.map(applyMetric));
    setRecentPosts((currentPosts) => currentPosts.map(applyMetric));
  };

  const tabs = [
    { id: "posts", label: "Posts", icon: FileText, count: posts.length },
    { id: "users", label: "Users", icon: Users, count: users.length },
    { id: "hashtags", label: "Hashtags", icon: Hash, count: hashtags.length },
  ];

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-5xl">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search posts, users, hashtags..."
                className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-border shadow-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition text-sm"
              />
            </div>
          </form>

          {query && (
            <div className="flex gap-2 mb-6">
              {tabs.map((section) => (
                <Button key={section.id} variant={tab === section.id ? "default" : "outline"} size="sm" className="rounded-full gap-2" onClick={() => setTab(section.id)}>
                  <section.icon className="w-4 h-4" />{section.label} ({section.count})
                </Button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : query ? (
            <div className="space-y-4">
              {tab === "posts" && (posts.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border">No posts found for "{query}"</div>
              ) : posts.map((post) => (
                <PostCard key={post.postId} post={post} onLike={handleLike} onCommentClick={() => setActiveCommentPostId(post.postId)} onRefresh={() => performSearch(query)} showFollowButton={false} onShareChange={(postId, value) => updatePostMetric(postId, "sharesCount", value)} />
              )))}

              {tab === "users" && (users.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border">No users found for "{query}"</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {users.map((person) => (
                    <div key={person.userId || person.id} onClick={() => navigate(`/users/${person.userId || person.id}`)} className="bg-white p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(person.fullName || person.username || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{person.fullName || person.username}</div>
                        <div className="text-xs text-muted-foreground">@{person.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {tab === "hashtags" && (hashtags.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border">No hashtags found for "{query}"</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {hashtags.map((hashtag) => {
                    const tag = hashtag.tag || hashtag.hashtag;
                    const count = hashtag.postCount || hashtag.count || 0;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const hashtagQuery = `#${tag}`;
                          setQuery(hashtagQuery);
                          setSearchParams({ q: hashtagQuery });
                        }}
                        className="bg-white p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition text-left flex items-center gap-4"
                      >
                        <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                          <Hash className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">#{tag}</div>
                          <div className="text-xs text-muted-foreground">{count} {count === 1 ? "post" : "posts"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                  <h2 className="text-xl font-bold">Trending</h2>
                </div>
                {trendingLoading ? (
                  <div className="space-y-3">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-14 bg-white rounded-xl animate-pulse border border-border" />)}</div>
                ) : trending.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border">No trending topics yet</div>
                ) : (
                  <div className="space-y-2">
                    {trending.map((item, index) => {
                      const tag = item.tag || item.hashtag;
                      return (
                        <button type="button"
                          key={`${tag}-${index}`}
                          onClick={() => {
                            const hashtagQuery = `#${tag}`;
                            setQuery(hashtagQuery);
                            setSearchParams({ q: hashtagQuery });
                          }}
                          className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md transition text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                            <Hash className="w-5 h-5 text-secondary" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">#{tag}</div>
                            <div className="text-xs text-muted-foreground">{item.postCount || item.count || 0} posts</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold">Recent Posts</h2>
                </div>
                {recentLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 bg-white rounded-xl animate-pulse border border-border" />)}</div>
                ) : recentError ? (
                  <div className="bg-white p-8 rounded-2xl text-center border border-border">
                    <p className="text-sm text-muted-foreground mb-4">{recentError}</p>
                    <Button type="button" variant="outline" className="rounded-full" onClick={fetchRecentPosts}>Retry</Button>
                  </div>
                ) : recentPosts.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border">No public posts yet</div>
                ) : (
                  <div className="space-y-4">
                    {recentPosts.map((post) => (
                      <PostCard key={post.postId} post={post} onLike={handleLike} onCommentClick={() => setActiveCommentPostId(post.postId)} onRefresh={refreshVisiblePosts} showFollowButton={false} onShareChange={(postId, value) => updatePostMetric(postId, "sharesCount", value)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
      {activeCommentPostId !== null && (
        <CommentModal isOpen={true} onClose={() => setActiveCommentPostId(null)} postId={activeCommentPostId} onCommentCountChange={(postId, value) => updatePostMetric(postId, "commentsCount", value)} />
      )}
    </>
  );
}
