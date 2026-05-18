import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { CommentModal } from "@/components/CommentModal";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function PostDetails() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);

  const loadPost = async () => {
    if (!postId) return;

    setLoading(true);
    try {
      const data = await api.posts.getPostById(postId);

      if (user?.id) {
        const liked = await api.likes.hasLiked(data.postId, user.id).catch(() => false);
        setPost({ ...data, userLiked: liked });
      } else {
        setPost(data);
      }
    } catch (error) {
      setPost(null);
      toast.error(error?.message || "Failed to load post");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPost();
  }, [postId, user?.id]);

  const handleLike = async (targetPostId) => {
    if (!user || !post || post.postId !== targetPostId) return;

    const previousPost = post;
    const nextLiked = !previousPost.userLiked;

    setPost({
      ...previousPost,
      userLiked: nextLiked,
      likesCount: Math.max(0, (previousPost.likesCount || 0) + (nextLiked ? 1 : -1)),
    });

    try {
      if (previousPost.userLiked) {
        await api.likes.unlikePost(targetPostId, user.id);
      } else {
        await api.likes.likePost(targetPostId, user.id);
      }
    } catch {
      setPost(previousPost);
      toast.error("Action failed");
    }
  };

  const updatePostMetric = (targetPostId, field, valueOrUpdater) => {
    setPost((currentPost) => {
      if (!currentPost || Number(currentPost.postId) !== Number(targetPostId)) return currentPost;
      const currentValue = Number(currentPost[field] || 0);
      const nextValue = typeof valueOrUpdater === "function" ? valueOrUpdater(currentValue) : Number(valueOrUpdater || 0);
      return { ...currentPost, [field]: Math.max(0, nextValue) };
    });
  };

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-4xl">
          <button type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : post ? (
            <PostCard
              post={post}
              onLike={handleLike}
              onCommentClick={() => setActiveCommentPostId(post.postId)}
              onRefresh={loadPost}
              onShareChange={(postId, value) => updatePostMetric(postId, "sharesCount", value)}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-12 text-center text-muted-foreground">
              This post could not be found.
            </div>
          )}
        </div>
      </main>

      {activeCommentPostId !== null && (
        <CommentModal
          isOpen={true}
          onClose={() => {
            setActiveCommentPostId(null);
          }}
          postId={activeCommentPostId}
          onCommentCountChange={(postId, value) => updatePostMetric(postId, "commentsCount", value)}
        />
      )}
    </>
  );
}
