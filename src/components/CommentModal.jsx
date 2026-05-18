import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Trash2, Loader2, Send, Heart, Reply, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

function CommentItem({ comment, user, onDelete, onReply, depth = 0 }) {
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likesCount ?? comment.likeCount ?? 0);
  const [authorName, setAuthorName] = useState(`User ${comment.authorId}`);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const maxDepth = 2;
  const canLoadReplies = depth < maxDepth;

  useEffect(() => {
    api.auth.getPublicProfile(comment.authorId).then((profile) => {
      if (profile) {
        setAuthorName(profile.fullName || profile.username || `User ${comment.authorId}`);
      }
    }).catch(() => {});
  }, [comment.authorId]);

  const loadReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }

    setLoadingReplies(true);
    try {
      const data = await api.comments.getReplies(comment.commentId);
      const nextReplies = Array.isArray(data) ? data : [];
      setReplies(nextReplies);
      setShowReplies(true);
    } catch {
      toast.error("Failed to load replies");
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await api.comments.unlikeComment(comment.commentId);
        setLiked(false);
        setLikeCount((currentCount) => Math.max(0, currentCount - 1));
      } else {
        await api.comments.likeComment(comment.commentId);
        setLiked(true);
        setLikeCount((currentCount) => currentCount + 1);
      }
    } catch {
      toast.error("Failed to update comment like");
    }
  };

  const handleSaveEdit = async () => {
    const nextContent = editContent.trim();
    if (!nextContent) {
      toast.error("Comment cannot be empty");
      return;
    }

    setSavingEdit(true);
    try {
      const updatedComment = await api.comments.updateComment(comment.commentId, { content: nextContent });
      comment.content = updatedComment?.content || nextContent;
      setEditContent(comment.content);
      setIsEditing(false);
      toast.success("Comment updated");
    } catch (error) {
      toast.error(error?.message || "Failed to update comment");
    } finally {
      setSavingEdit(false);
    }
  };

  const replyLabel = replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "View replies";

  return (
    <div className={depth > 0 ? "ml-8 pl-3 border-l-2 border-primary/10" : ""}>
      <div className="flex gap-3 group">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
          {authorName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 rounded-2xl rounded-tl-sm p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-sm truncate">{authorName}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  rows={2}
                  className="w-full bg-white rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditContent(comment.content || "");
                      setIsEditing(false);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-60"
                  >
                    {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 break-words">{comment.content}</p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 px-1">
            <button
              type="button"
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition ${liked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? "fill-primary" : ""}`} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>

            {user && canLoadReplies && (
              <button
                type="button"
                onClick={() => onReply(comment, authorName)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-secondary transition"
              >
                <Reply className="w-3.5 h-3.5" />
                Reply
              </button>
            )}

            {canLoadReplies && (
              <button
                type="button"
                onClick={loadReplies}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
              >
                {loadingReplies ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : showReplies ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                {showReplies ? "Hide replies" : replyLabel}
              </button>
            )}
          </div>
        </div>

        {user?.id === comment.authorId && (
          <div className="flex self-start gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition"
              title="Edit comment"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(comment.commentId)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition"
              title="Delete comment"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {showReplies && replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <CommentItem
              key={reply.commentId}
              comment={reply}
              user={user}
              onDelete={onDelete}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {showReplies && !loadingReplies && replies.length === 0 && (
        <div className="mt-2 ml-11 text-xs text-muted-foreground">No replies yet</div>
      )}
    </div>
  );
}

export function CommentModal({ isOpen, onClose, postId, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      void loadComments();
    }
    return () => setReplyTo(null);
  }, [isOpen, postId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await api.comments.getPostComments(postId);
      const topLevelComments = (data || []).filter((comment) => !comment.parentCommentId);
      setComments(topLevelComments);
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const syncCommentCount = async (fallbackUpdater) => {
    onCommentCountChange?.(postId, fallbackUpdater);
    try {
      const nextCount = await api.comments.getCommentCount(postId);
      onCommentCountChange?.(postId, Number(nextCount || 0));
    } catch {
      // The optimistic count above keeps the UI responsive if count sync fails.
    }
  };

  const handleCreateComment = async (event) => {
    event.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const payload = {
        postId,
        authorId: user.id,
        content: newComment,
      };

      if (replyTo) {
        payload.parentCommentId = replyTo.commentId;
      }

      await api.comments.createComment(payload);
      setNewComment("");
      setReplyTo(null);
      void syncCommentCount((currentCount) => currentCount + 1);
      await loadComments();
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.comments.deleteComment(commentId);
      setComments((currentComments) => currentComments.filter((comment) => comment.commentId !== commentId));
      void syncCommentCount((currentCount) => Math.max(0, currentCount - 1));
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleReply = (comment, authorName) => {
    setReplyTo({ ...comment, authorName });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground pt-4">No comments yet. Be the first!</div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.commentId}
                comment={comment}
                user={user}
                onDelete={handleDeleteComment}
                onReply={handleReply}
              />
            ))
          )}
        </div>

        {user ? (
          <div className="mt-2 border-t pt-4">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-2">
                <Reply className="w-3.5 h-3.5 text-secondary" />
                <span className="text-xs text-muted-foreground">
                  Replying to <strong>{replyTo.authorName || `User ${replyTo.authorId}`}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="ml-auto text-xs text-destructive hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}

            <form onSubmit={handleCreateComment} className="flex gap-2">
              <input
                type="text"
                placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
                className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newComment.trim() || submitting}
                className="rounded-full flex-shrink-0"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-2 text-center text-sm text-muted-foreground border-t pt-4">
            Please log in to leave a comment.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
