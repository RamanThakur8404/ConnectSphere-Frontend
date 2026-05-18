import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bookmark, Loader2, ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { CommentModal } from "@/components/CommentModal";

export default function Bookmarks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);

  useEffect(() => { if (!user) { navigate("/auth/login"); return; } fetchBookmarks(); }, [user]);

  const fetchBookmarks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.posts.getBookmarks(user.id);
      const bkPosts = Array.isArray(data) ? data : [];
      if (bkPosts.length > 0) {
        const withLikes = await Promise.all(bkPosts.map(async (p) => {
          const hasLiked = await api.likes.hasLiked(p.postId, user.id).catch(() => false);
          return { ...p, userLiked: hasLiked === true, isBookmarked: true, bookmarked: true };
        }));
        setPosts(withLikes);
      } else { setPosts([]); }
    } catch { toast.error("Failed to load bookmarks"); }
    finally { setLoading(false); }
  };

  const handleLike = async (postId) => {
    if (!user) return;
    const post = posts.find((p) => p.postId === postId);
    if (!post) return;
    setPosts(posts.map((p) => p.postId === postId ? { ...p, userLiked: !p.userLiked, likesCount: p.userLiked ? p.likesCount - 1 : p.likesCount + 1 } : p));
    try { if (post.userLiked) await api.likes.unlikePost(postId, user.id); else await api.likes.likePost(postId, user.id); }
    catch { setPosts(posts.map((p) => p.postId === postId ? { ...p, userLiked: post.userLiked, likesCount: post.likesCount } : p)); toast.error("Action failed"); }
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
        <div className="app-page max-w-4xl">
          <div className="flex items-center gap-4 mb-6">
            <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <div><h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Bookmark className="w-7 h-7 text-primary fill-primary/20" /> Bookmarks</h1><p className="text-sm text-muted-foreground mt-0.5">{posts.length} saved post{posts.length !== 1 ? "s" : ""}</p></div>
          </div>
          {loading ? (<div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"><Bookmark className="w-8 h-8 text-primary" /></div>
              <h3 className="font-bold text-lg mb-2">No bookmarks yet</h3>
              <p className="text-muted-foreground text-sm">Save posts you want to revisit by clicking the bookmark icon on any post.</p>
            </div>
          ) : (<div className="space-y-4">{posts.map((post) => (<PostCard key={post.postId} post={post} onLike={handleLike} onCommentClick={() => setActiveCommentPostId(post.postId)} onBookmarkChange={(postId, bookmarked) => { if (!bookmarked) setPosts((current) => current.filter((item) => Number(item.postId) !== Number(postId))); }} onRefresh={fetchBookmarks} showFollowButton={false} onShareChange={(postId, value) => updatePostMetric(postId, "sharesCount", value)} />))}</div>)}
        </div>
      </main>
      {activeCommentPostId !== null && (<CommentModal isOpen={true} onClose={() => setActiveCommentPostId(null)} postId={activeCommentPostId} onCommentCountChange={(postId, value) => updatePostMetric(postId, "commentsCount", value)} />)}
    </>
  );
}
