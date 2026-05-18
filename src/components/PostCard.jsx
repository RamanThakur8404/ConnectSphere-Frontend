import {
  Heart, MessageCircle, Share2, MoreVertical, Trash2,
  Bookmark, BookmarkCheck, Flag, Link as LinkIcon,
  Globe, Lock, Users as UsersIcon, Eye, Check, UserPlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { getPostMediaItems, toDisplayMediaUrl } from "@/lib/service-helpers";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const REACTIONS = [
  { type: "LIKE", emoji: "\u2764\uFE0F", label: "Like" },
  { type: "LOVE", emoji: "\uD83D\uDE0D", label: "Love" },
  { type: "HAHA", emoji: "\uD83D\uDE02", label: "Haha" },
  { type: "WOW", emoji: "\uD83D\uDE2E", label: "Wow" },
  { type: "SAD", emoji: "\uD83D\uDE22", label: "Sad" },
  { type: "ANGRY", emoji: "\uD83D\uDE21", label: "Angry" },
];

const REACTION_LOOKUP = Object.fromEntries(
  REACTIONS.map((reaction) => [reaction.type, reaction]),
);

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", icon: Globe, label: "Public" },
  { value: "FOLLOWERS_ONLY", icon: UsersIcon, label: "Followers Only" },
  { value: "PRIVATE", icon: Lock, label: "Private" },
];

function normalizeReactionCounts(source) {
  if (!source || typeof source !== "object") return {};

  return Object.entries(source).reduce((result, [key, value]) => {
    const type = String(key || "").toUpperCase();
    const count = Number(value || 0);

    if (type && count > 0) {
      result[type] = count;
    }

    return result;
  }, {});
}

function getReactionStateFromPost(post) {
  return {
    counts: normalizeReactionCounts(post?.reactionCounts),
    total: Number(post?.totalReactions ?? post?.likesCount ?? 0),
    userReactionType: String(post?.userReactionType || (post?.userLiked ? "LIKE" : "")).toUpperCase() || null,
  };
}

function updateReactionCounts(currentCounts, previousType, nextType) {
  const nextCounts = { ...currentCounts };

  if (previousType && nextCounts[previousType]) {
    nextCounts[previousType] = Math.max(0, nextCounts[previousType] - 1);
    if (nextCounts[previousType] === 0) {
      delete nextCounts[previousType];
    }
  }

  if (nextType) {
    nextCounts[nextType] = (nextCounts[nextType] || 0) + 1;
  }

  return nextCounts;
}

function getTopReactions(counts) {
  return Object.entries(counts)
    .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
    .slice(0, 3)
    .map(([type, count]) => ({
      ...(REACTION_LOOKUP[type] || REACTION_LOOKUP.LIKE),
      count,
    }));
}

function getHashtagsFromPost(post) {
  const source = Array.isArray(post?.hashtags) ? post.hashtags : [];
  const fromPost = source
    .map((hashtag) => hashtag?.tag || hashtag?.hashtag || hashtag)
    .filter(Boolean);

  const fromContent = Array.from(String(post?.content || "").matchAll(/#([\p{L}\p{N}_]+)/gu))
    .map((match) => match[1]);

  return Array.from(new Set([...fromPost, ...fromContent]))
    .map((tag) => ({ tag }));
}

export function PostCard({
  post,
  onLike,
  onCommentClick,
  onRefresh,
  showFollowButton = true,
  onFollowClick,
  onUnfollowClick,
  onBookmarkChange,
  onShareChange,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialReactionState = getReactionStateFromPost(post);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(Boolean(post.isBookmarked || post.bookmarked));
  const [commentsCount, setCommentsCount] = useState(Number(post.commentsCount || 0));
  const [sharesCount, setSharesCount] = useState(Number(post.sharesCount || 0));
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [authorName, setAuthorName] = useState(`User ${post.authorId}`);
  const [authorUsername, setAuthorUsername] = useState("");
  const [authorIsPremium, setAuthorIsPremium] = useState(false);
  const [hashtags, setHashtags] = useState(() => getHashtagsFromPost(post));
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportDesc, setReportDesc] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [isFollowActionPending, setIsFollowActionPending] = useState(false);
  const [reactionCounts, setReactionCounts] = useState(initialReactionState.counts);
  const [totalReactions, setTotalReactions] = useState(initialReactionState.total);
  const [userReactionType, setUserReactionType] = useState(initialReactionState.userReactionType);
  const [isReactionPending, setIsReactionPending] = useState(false);
  const [linkedMediaItems, setLinkedMediaItems] = useState([]);
  const menuRef = useRef(null);
  const reactionRef = useRef(null);
  const reactionTimeoutRef = useRef(null);

  useEffect(() => {
    api.auth.getPublicProfile(post.authorId).then((profile) => {
      if (profile) {
        setAuthorName(profile.fullName || profile.username || `User ${post.authorId}`);
        setAuthorUsername(profile.username || "");
        setAuthorIsPremium(profile.isPremium || false);
      }
    }).catch(() => {});
  }, [post.authorId]);

  useEffect(() => {
    setIsBookmarked(Boolean(post.isBookmarked || post.bookmarked));
    setCommentsCount(Number(post.commentsCount || 0));
    setSharesCount(Number(post.sharesCount || 0));
    const nextState = getReactionStateFromPost(post);
    setReactionCounts(nextState.counts);
    setTotalReactions(nextState.total);
    setUserReactionType(nextState.userReactionType);
  }, [post]);

  useEffect(() => {
    setHashtags(getHashtagsFromPost(post));
  }, [post]);

  useEffect(() => {
    let cancelled = false;
    const embeddedMediaItems = getPostMediaItems(post);

    if (embeddedMediaItems.length > 0 || !post.postId) {
      setLinkedMediaItems([]);
      return () => {
        cancelled = true;
      };
    }

    const loadLinkedMedia = async () => {
      try {
        const mediaRecords = await api.media.getByPost(post.postId);
        if (cancelled) return;
        const nextItems = Array.isArray(mediaRecords)
          ? mediaRecords
              .filter((media) => media?.url && media?.isDeleted !== true)
              .map((media) => ({
                url: toDisplayMediaUrl(media.url),
                kind: String(media.mediaTypes || "").toUpperCase() === "VIDEO" ? "video" : "image",
              }))
          : [];
        setLinkedMediaItems(nextItems);
      } catch {
        if (!cancelled) setLinkedMediaItems([]);
      }
    };

    void loadLinkedMedia();

    return () => {
      cancelled = true;
    };
  }, [post]);

  useEffect(() => {
    let cancelled = false;
    const fallbackState = getReactionStateFromPost(post);

    const loadReactionData = async () => {
      try {
        const [summary, likes] = await Promise.all([
          api.likes.getReactionSummary(post.postId).catch(() => null),
          user ? api.likes.getLikesByTarget(post.postId).catch(() => []) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        const normalizedCounts = normalizeReactionCounts(summary?.reactionCounts);
        const fallbackCounts = Array.isArray(likes)
          ? likes.reduce((result, like) => {
              const type = String(like?.reactionType || "LIKE").toUpperCase();
              result[type] = (result[type] || 0) + 1;
              return result;
            }, {})
          : {};

        const resolvedCounts = Object.keys(normalizedCounts).length > 0 ? normalizedCounts : fallbackCounts;
        const resolvedTotal = Number(
          summary?.totalCount
          ?? Object.values(resolvedCounts).reduce((sum, count) => sum + Number(count || 0), 0)
          ?? 0,
        );
        const currentUserReaction = Array.isArray(likes)
          ? likes.find((like) => Number(like.userId) === Number(user?.id))
          : null;

        setReactionCounts(resolvedCounts);
        setTotalReactions(resolvedTotal);
        setUserReactionType(currentUserReaction?.reactionType || fallbackState.userReactionType);
      } catch {
        if (!cancelled) {
          setReactionCounts(fallbackState.counts);
          setTotalReactions(fallbackState.total);
          setUserReactionType(fallbackState.userReactionType);
        }
      }
    };

    void loadReactionData();

    return () => {
      cancelled = true;
    };
  }, [post.postId, post.likesCount, post.userLiked, post.userReactionType, user?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!user || user.id === post.authorId) {
      setIsFollowingAuthor(false);
      setIsFollowActionPending(false);
      return () => {
        cancelled = true;
      };
    }

    api.follows.isFollowing(user.id, post.authorId)
      .then((following) => {
        if (!cancelled) {
          setIsFollowingAuthor(!!following);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsFollowingAuthor(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [post.authorId, user]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setShowMenu(false);
      if (reactionRef.current && !reactionRef.current.contains(event.target)) setShowReactions(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const formatDate = (value) => {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const activeReaction = userReactionType ? (REACTION_LOOKUP[userReactionType] || REACTION_LOOKUP.LIKE) : null;
  const topReactions = getTopReactions(reactionCounts);

  const applyOptimisticReaction = (nextReactionType) => {
    const previousReactionType = userReactionType;
    const previousCounts = reactionCounts;
    const previousTotal = totalReactions;
    const nextCounts = updateReactionCounts(previousCounts, previousReactionType, nextReactionType);
    const nextTotal = Math.max(
      0,
      previousTotal + (previousReactionType ? 0 : 1) - (nextReactionType ? 0 : 1),
    );

    setReactionCounts(nextCounts);
    setTotalReactions(nextTotal);
    setUserReactionType(nextReactionType);

    return { previousReactionType, previousCounts, previousTotal };
  };

  const restoreReactionState = (snapshot) => {
    setReactionCounts(snapshot.previousCounts);
    setTotalReactions(snapshot.previousTotal);
    setUserReactionType(snapshot.previousReactionType);
  };

  const handleDeletePost = async () => {
    if (!user || user.id !== post.authorId) return;
    setIsDeleting(true);
    setShowMenu(false);
    try {
      await api.posts.deletePost(post.postId);
      toast.success("Post deleted");
      onRefresh?.();
    } catch (error) {
      toast.error(error?.message || "Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    if (!user) {
      toast.error("Please log in to share");
      return;
    }
    setIsSharing(true);
    try {
      await api.posts.sharePost(post.postId, { authorId: user.id });
      setSharesCount((currentCount) => currentCount + 1);
      onShareChange?.(post.postId, (currentCount) => currentCount + 1);
      toast.success("Post shared to your profile");
    } catch {
      navigator.clipboard?.writeText(`${window.location.origin}/posts/${post.postId}`).catch(() => {});
      toast.success("Link copied to clipboard");
    } finally {
      setIsSharing(false);
    }
  };

  const handleBookmark = async () => {
    if (!user) {
      toast.error("Please log in to bookmark");
      return;
    }

    try {
      if (isBookmarked) {
        await api.posts.removeBookmark(user.id, post.postId);
        setIsBookmarked(false);
        onBookmarkChange?.(post.postId, false);
        toast.success("Bookmark removed");
      } else {
        await api.posts.bookmarkPost(user.id, post.postId);
        setIsBookmarked(true);
        onBookmarkChange?.(post.postId, true);
        toast.success("Post bookmarked");
      }
    } catch (error) {
      toast.error(error?.message || "Action failed");
    }
  };

  const handleToggleLike = async () => {
    if (!user) {
      toast.error("Please log in");
      return;
    }

    setIsReactionPending(true);
    const nextReactionType = userReactionType ? null : "LIKE";
    const snapshot = applyOptimisticReaction(nextReactionType);

    try {
      if (snapshot.previousReactionType) {
        await api.likes.unlikePost(post.postId, user.id);
      } else {
        await api.likes.likePost(post.postId, user.id, "LIKE");
      }
    } catch {
      restoreReactionState(snapshot);
      toast.error("Reaction failed");
    } finally {
      setIsReactionPending(false);
    }
  };

  const handleReactionSelect = async (reactionType) => {
    if (!user) {
      toast.error("Please log in");
      return;
    }

    if (userReactionType === reactionType) {
      setShowReactions(false);
      return;
    }

    setShowReactions(false);
    setIsReactionPending(true);
    const snapshot = applyOptimisticReaction(reactionType);

    try {
      if (snapshot.previousReactionType) {
        await api.likes.changeReaction(user.id, post.postId, "POST", reactionType);
      } else {
        await api.likes.likePost(post.postId, user.id, reactionType);
      }
      toast.success(`Reaction updated to ${REACTION_LOOKUP[reactionType]?.label || "Like"}`);
    } catch {
      restoreReactionState(snapshot);
      toast.error("Reaction failed");
    } finally {
      setIsReactionPending(false);
    }
  };

  const handleVisibilityChange = async (visibility) => {
    setShowVisibility(false);
    setShowMenu(false);
    try {
      await api.posts.changeVisibility(post.postId, visibility);
      toast.success(`Post visibility changed to ${visibility.replace("_", " ").toLowerCase()}`);
    } catch {
      toast.error("Failed to change visibility");
    }
  };

  const handleReport = async () => {
    if (!user) {
      toast.error("Please log in to report");
      return;
    }

    setIsReporting(true);
    try {
      await api.reports.createReport({
        targetId: post.postId,
        targetType: "POST",
        reason: reportReason,
        description: reportDesc,
      }, user.id);
      toast.success("Report submitted. Thank you");
      setShowReportModal(false);
      setReportDesc("");
    } catch {
      toast.error("Failed to submit report");
    } finally {
      setIsReporting(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!user) {
      toast.error("Please log in to follow users");
      return;
    }

    setIsFollowActionPending(true);
    try {
      if (isFollowingAuthor) {
        if (onUnfollowClick) {
          await onUnfollowClick(post.authorId);
        } else {
          await api.follows.unfollowUser(user.id, post.authorId);
          toast.success("Unfollowed");
        }
        setIsFollowingAuthor(false);
      } else {
        if (onFollowClick) {
          await onFollowClick(post.authorId);
        } else {
          await api.follows.followUser(user.id, post.authorId);
          toast.success("Followed");
        }
        setIsFollowingAuthor(true);
      }
    } catch (error) {
      toast.error(error?.message || `Failed to ${isFollowingAuthor ? "unfollow" : "follow"} user`);
    } finally {
      setIsFollowActionPending(false);
    }
  };

  const mediaItems = getPostMediaItems(post);
  const visibleMediaItems = mediaItems.length > 0 ? mediaItems : linkedMediaItems;

  return (
    <>
      <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
        authorIsPremium
          ? "border-amber-300 shadow-amber-100/50" 
          : "border-border"
      }`}>
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/users/${post.authorId}`)}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white font-bold flex-shrink-0">
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm hover:underline truncate flex items-center gap-1">
                  {authorName}
                  {authorIsPremium && <VerifiedBadge />}
                </div>
                {authorUsername && <div className="text-xs text-muted-foreground">@{authorUsername}</div>}
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {formatDate(post.createdAt)}
                  {post.visibility && (
                    <span title={post.visibility}>
                      {post.visibility === "PUBLIC" ? <Globe className="w-3 h-3" /> : post.visibility === "PRIVATE" ? <Lock className="w-3 h-3" /> : <UsersIcon className="w-3 h-3" />}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {user && user.id !== post.authorId && showFollowButton && (
                <Button
                  variant={isFollowingAuthor ? "outline" : "default"}
                  size="sm"
                  disabled={isFollowActionPending}
                  className={`rounded-full text-xs flex-shrink-0 gap-1.5 ${
                    isFollowingAuthor
                      ? ""
                      : "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white"
                  }`}
                  onClick={handleFollowToggle}
                >
                  {isFollowActionPending ? null : isFollowingAuthor ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                  {isFollowActionPending ? "Working..." : isFollowingAuthor ? "Following" : "Follow"}
                </Button>
              )}

              <div className="relative" ref={menuRef}>
                <button type="button" className="p-2 hover:bg-muted rounded-full transition text-muted-foreground" onClick={() => setShowMenu(!showMenu)} aria-label="Post options">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-50 min-w-[190px] py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/posts/${post.postId}`).catch(() => {});
                        toast.success("Link copied");
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition"
                    >
                      <LinkIcon className="w-4 h-4 text-muted-foreground" /> Copy link
                    </button>

                    {user && user.id === post.authorId && (
                      <>
                        <div className="relative">
                          <button type="button" onClick={() => setShowVisibility(!showVisibility)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition">
                            <Eye className="w-4 h-4 text-muted-foreground" /> Change visibility
                          </button>
                          {showVisibility && (
                            <div className="absolute left-full top-0 ml-1 bg-white border border-border rounded-xl shadow-lg z-50 min-w-[170px] py-1">
                              {VISIBILITY_OPTIONS.map((option) => (
                                <button
                                  type="button"
                                  key={option.value}
                                  onClick={() => handleVisibilityChange(option.value)}
                                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition ${post.visibility === option.value ? "text-primary font-semibold bg-primary/5" : ""}`}
                                >
                                  <option.icon className="w-4 h-4" /> {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={handleDeletePost} disabled={isDeleting} className="w-full text-left px-4 py-2.5 text-sm hover:bg-destructive/5 text-destructive flex items-center gap-2 transition">
                          <Trash2 className="w-4 h-4" /> {isDeleting ? "Deleting..." : "Delete post"}
                        </button>
                      </>
                    )}

                    {user && user.id !== post.authorId && (
                      <button type="button" onClick={() => { setShowMenu(false); setShowReportModal(true); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 text-amber-600 flex items-center gap-2 transition">
                        <Flag className="w-4 h-4" /> Report post
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {post.content && <p className="text-sm leading-relaxed mb-3 sm:mb-4 break-words whitespace-pre-wrap text-foreground">{post.content}</p>}

          {visibleMediaItems.length > 0 && (
            <div className="space-y-3 mb-3 sm:mb-4">
              {visibleMediaItems.map((media, index) => (
                <div key={`${media.url}-${index}`} className={`rounded-xl overflow-hidden ${media.kind === "video" ? "bg-black" : "bg-muted"} max-h-96`}>
                  {media.kind === "video"
                    ? <video src={media.url} controls className="w-full max-h-96 object-contain" />
                    : <img src={media.url} alt="Post content" className="w-full max-h-96 object-cover" loading="lazy" />}
                </div>
              ))}
            </div>
          )}

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
              {hashtags.map((hashtag) => {
                const tag = hashtag.tag || hashtag.hashtag;
                return (
                  <button key={tag} type="button" onClick={() => navigate(`/explore?q=${encodeURIComponent(`#${tag}`)}`)} className="text-xs px-2.5 py-1 rounded-full bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition">
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}

          {topReactions.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <div className="flex -space-x-1">
                {topReactions.map((reaction) => (
                  <span key={reaction.type} className="w-6 h-6 rounded-full border border-white bg-white flex items-center justify-center shadow-sm" title={`${reaction.label}: ${reaction.count}`}>
                    {reaction.emoji}
                  </span>
                ))}
              </div>
              <span>{totalReactions} reaction{totalReactions === 1 ? "" : "s"}</span>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2 pt-3 sm:pt-4 border-t border-border text-xs text-muted-foreground">
            <div className="relative" ref={reactionRef}>
              <button
                type="button"
                onClick={handleToggleLike}
                onMouseEnter={() => { reactionTimeoutRef.current = setTimeout(() => setShowReactions(true), 500); }}
                onMouseLeave={() => { if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current); }}
                disabled={isReactionPending}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition group ${activeReaction ? "text-primary bg-primary/5" : "hover:bg-primary/5 hover:text-primary"}`}
                aria-label="React to post"
              >
                {isReactionPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : activeReaction ? (
                  <span className="text-sm leading-none">{activeReaction.emoji}</span>
                ) : (
                  <Heart className="w-4 h-4 transition group-hover:fill-primary/30" />
                )}
                <span className="text-xs font-medium">{totalReactions}</span>
                {activeReaction && <span className="hidden sm:inline font-medium">{activeReaction.label}</span>}
              </button>
              {showReactions && (
                <div className="absolute bottom-full left-0 mb-2 bg-white border border-border rounded-full shadow-xl px-2 py-1.5 flex gap-0.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  {REACTIONS.map((reaction) => (
                    <button type="button" key={reaction.type} onClick={() => handleReactionSelect(reaction.type)} title={reaction.label} className="text-xl p-1.5 rounded-full hover:bg-muted hover:scale-125 transition-all">
                      {reaction.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={() => onCommentClick?.(post.postId)} className="flex items-center gap-1.5 px-2.5 py-2 hover:bg-secondary/5 rounded-lg transition hover:text-secondary" aria-label="Comment on post">
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">{commentsCount}</span>
            </button>

            <button type="button" onClick={handleShare} disabled={isSharing} className="flex items-center gap-1.5 px-2.5 py-2 hover:bg-accent/5 rounded-lg transition hover:text-accent" aria-label="Share post">
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-medium">{sharesCount}</span>
            </button>

            <button type="button" onClick={handleBookmark} className={`flex items-center gap-1 px-2.5 py-2 rounded-lg transition ml-auto ${isBookmarked ? "text-primary bg-primary/5" : "hover:bg-muted text-muted-foreground"}`} aria-label={isBookmarked ? "Remove bookmark" : "Bookmark post"}>
              {isBookmarked ? <BookmarkCheck className="w-4 h-4 fill-primary text-primary" /> : <Bookmark className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && setShowReportModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full"><Flag className="w-5 h-5 text-amber-600" /></div>
              <h2 className="text-lg font-bold">Report Post</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Help us understand what is wrong with this post.</p>
            <div className="space-y-3 mb-4">
              <label className="block text-sm font-medium">Reason</label>
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Harassment or bullying</option>
                <option value="HATE_SPEECH">Hate speech</option>
                <option value="MISINFORMATION">Misinformation</option>
                <option value="NSFW">Inappropriate content</option>
                <option value="OTHER">Other</option>
              </select>
              <label className="block text-sm font-medium">Description (optional)</label>
              <textarea value={reportDesc} onChange={(event) => setReportDesc(event.target.value)} placeholder="Provide more details..." rows={3} className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowReportModal(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white" onClick={handleReport} disabled={isReporting}>
                {isReporting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
