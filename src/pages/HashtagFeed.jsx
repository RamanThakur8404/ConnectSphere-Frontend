import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { Hash, TrendingUp, Loader2, ArrowLeft } from "lucide-react";

export default function HashtagFeed() {
  const { tag } = useParams();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postCount, setPostCount] = useState(0);

  useEffect(() => {
    const loadHashtagPosts = async () => {
      setLoading(true);
      try {
        const result = await api.searchAPI.getPostsByHashtag(tag);
        const postIds = result?.postIds || [];
        setPostCount(result?.total || postIds.length);

        const postPromises = postIds.slice(0, 20).map((id) =>
          api.posts.getPostById(id).catch(() => null)
        );
        const postData = (await Promise.all(postPromises)).filter(Boolean);
        setPosts(postData);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    if (tag) loadHashtagPosts();
  }, [tag]);

  return (
    <>
      <Header />
      <div className="app-shell">
        <div className="app-page max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link to="/explore" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Explore</span>
            </Link>

            <div className="bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 rounded-2xl p-6 border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                  <Hash className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">#{tag}</h1>
                  <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {postCount} {postCount === 1 ? "post" : "posts"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Posts */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Hash className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No posts found</h3>
              <p className="text-muted-foreground text-sm">
                Be the first to post with <span className="text-primary font-medium">#{tag}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.postId || post.id} post={post} currentUser={user} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
