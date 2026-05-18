import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Loader2, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PostCard } from "@/components/PostCard";
import { CommentModal } from "@/components/CommentModal";

const getUserIdFromFollow = (follow, type) => {
  if (!follow || typeof follow !== "object") return Number(follow);
  return Number(type === "followers" ? follow.followerId : follow.followeeId);
};

export default function UserProfile() {
  const { userId, username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [socialModal, setSocialModal] = useState(null);
  const [socialUsers, setSocialUsers] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);

  const resolveProfile = async () => {
    if (userId) return api.auth.getPublicProfile(Number(userId));
    if (username) return api.auth.getPublicProfileByUsername(username);
    return null;
  };

  const fetchUserProfile = async () => {
    if (!userId && !username) return;
    setLoading(true);
    try {
      const pubProfile = await resolveProfile();
      if (!pubProfile?.userId) throw new Error("Profile not found");

      const resolvedUserId = Number(pubProfile.userId);
      const [counts, postCountData, userPosts] = await Promise.all([
        api.follows.getFollowCounts(resolvedUserId).catch(() => null),
        api.posts.getPostCount(resolvedUserId).catch(() => null),
        api.posts.getUserPosts(resolvedUserId).catch(() => []),
      ]);

      const ownFreshProfilePic = currentUser && Number(currentUser.id) === resolvedUserId ? currentUser.profilePicUrl : "";
      if (currentUser && Number(currentUser.id) !== resolvedUserId) {
        const followingStatus = await api.follows.isFollowing(currentUser.id, resolvedUserId).catch(() => false);
        setIsFollowing(!!followingStatus);
      }

      setProfile({
        userId: resolvedUserId,
        username: pubProfile.username,
        fullName: pubProfile.fullName || pubProfile.username,
        email: pubProfile.email || "",
        bio: pubProfile.bio || "",
        profilePicUrl: ownFreshProfilePic || pubProfile.profilePicUrl,
        createdAt: pubProfile.createdAt || new Date().toISOString(),
        followersCount: counts?.followerCount || 0,
        followingCount: counts?.followingCount || 0,
        postsCount: postCountData?.postCount || userPosts?.length || 0,
      });

      if (currentUser && userPosts?.length) {
        const postsWithLikeStatus = await Promise.all(userPosts.map(async (p) => {
          const hasLiked = await api.likes.hasLiked(p.postId, currentUser.id).catch(() => false);
          return { ...p, userLiked: hasLiked };
        }));
        setPosts(postsWithLikeStatus);
      } else {
        setPosts(userPosts || []);
      }
    } catch {
      toast.error("Failed to load user profile");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId || username) fetchUserProfile();
  }, [userId, username, currentUser]);

  const handleFollow = async () => {
    if (!currentUser || !profile?.userId) return;
    try {
      await api.follows.followUser(currentUser.id, profile.userId);
      setIsFollowing(true);
      setProfile((prev) => prev ? { ...prev, followersCount: prev.followersCount + 1 } : prev);
      toast.success("Followed!");
    } catch (error) {
      toast.error(error?.message || "Failed to follow");
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser || !profile?.userId) return;
    try {
      await api.follows.unfollowUser(currentUser.id, profile.userId);
      setIsFollowing(false);
      setProfile((prev) => prev ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) } : prev);
      toast.success("Unfollowed!");
    } catch (error) {
      toast.error(error?.message || "Failed to unfollow");
    }
  };

  const openSocialModal = async (type) => {
    if (!profile?.userId) return;
    setSocialModal(type);
    setSocialLoading(true);
    setSocialUsers([]);
    try {
      const follows = type === "followers"
        ? await api.follows.getFollowers(profile.userId)
        : await api.follows.getFollowing(profile.userId);
      const hydratedUsers = await Promise.all(
        (Array.isArray(follows) ? follows : [])
          .map((follow) => getUserIdFromFollow(follow, type))
          .filter(Number.isFinite)
          .map((id) => api.auth.getPublicProfile(id).catch(() => null))
      );
      setSocialUsers(hydratedUsers.filter(Boolean));
    } catch {
      toast.error(`Failed to load ${type}`);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleLike = async (postId) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.postId === postId);
    if (!post) return;
    setPosts(posts.map((p) => p.postId === postId ? { ...p, userLiked: !p.userLiked, likesCount: p.userLiked ? p.likesCount - 1 : p.likesCount + 1 } : p));
    try {
      if (post.userLiked) await api.likes.unlikePost(postId, currentUser.id);
      else await api.likes.likePost(postId, currentUser.id);
    } catch {
      setPosts(posts.map((p) => p.postId === postId ? { ...p, userLiked: post.userLiked, likesCount: post.likesCount } : p));
      toast.error("Action failed");
    }
  };

  const updatePostMetric = (postId, field, valueOrUpdater) => {
    setPosts((currentPosts) => currentPosts.map((post) => {
      if (Number(post.postId) !== Number(postId)) return post;
      const currentValue = Number(post[field] || 0);
      const nextValue = typeof valueOrUpdater === "function" ? valueOrUpdater(currentValue) : Number(valueOrUpdater || 0);
      return { ...post, [field]: Math.max(0, nextValue) };
    }));
  };

  if (loading) return (<><Header /><main className="app-shell-muted"><div className="app-page max-w-5xl flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></main></>);
  if (!profile) return (<><Header /><main className="app-shell-muted"><div className="app-page max-w-5xl"><button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-primary hover:text-primary/70 mb-4"><ArrowLeft className="w-4 h-4" />Go Back</button><div className="text-center p-8 text-muted-foreground">User not found</div></div></main></>);

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-5xl">
          <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-primary hover:text-primary/70 mb-5"><ArrowLeft className="w-4 h-4" /> Back</button>
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-border mb-6">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white font-bold text-4xl sm:text-5xl">
                  {profile.profilePicUrl ? <img src={profile.profilePicUrl} alt={profile.username} className="w-full h-full object-cover" /> : profile.fullName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div><h1 className="text-2xl sm:text-3xl font-bold mb-2">{profile.fullName}</h1><p className="text-muted-foreground mb-3">@{profile.username}</p></div>
                  {currentUser && currentUser.id !== profile.userId && (
                    <div className="flex gap-2">
                      {isFollowing ? <Button variant="outline" onClick={handleUnfollow} className="rounded-full">Following</Button> : <Button onClick={handleFollow} className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white rounded-full">Follow</Button>}
                    </div>
                  )}
                  {currentUser && currentUser.id === profile.userId && (
                    <Button type="button" variant="outline" onClick={() => navigate("/profile/edit")} className="rounded-full gap-2">
                      <Settings className="w-4 h-4" /> Edit Profile
                    </Button>
                  )}
                </div>
                <p className="text-foreground mb-4">{profile.bio}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4"><div className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Joined {new Date(profile.createdAt).toLocaleDateString()}</div></div>
                <div className="flex gap-6">
                  <div><div className="text-lg sm:text-xl font-bold">{profile.postsCount}</div><div className="text-xs sm:text-sm text-muted-foreground">Posts</div></div>
                  <button type="button" onClick={() => openSocialModal("following")} className="text-left rounded-lg hover:bg-muted/60 px-2 py-1 -mx-2 -my-1 transition">
                    <div className="text-lg sm:text-xl font-bold">{profile.followingCount}</div><div className="text-xs sm:text-sm text-muted-foreground">Following</div>
                  </button>
                  <button type="button" onClick={() => openSocialModal("followers")} className="text-left rounded-lg hover:bg-muted/60 px-2 py-1 -mx-2 -my-1 transition">
                    <div className="text-lg sm:text-xl font-bold">{profile.followersCount}</div><div className="text-xs sm:text-sm text-muted-foreground">Followers</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Posts</h2>
            {posts.length === 0 ? (<div className="bg-white p-8 rounded-2xl text-center text-muted-foreground border border-border">No posts yet</div>) : posts.map((post) => (
              <PostCard key={post.postId} post={post} onLike={handleLike} onCommentClick={() => setActiveCommentPostId(post.postId)} onRefresh={fetchUserProfile} showFollowButton={false} onShareChange={(postId, value) => updatePostMetric(postId, "sharesCount", value)} />
            ))}
          </div>
        </div>
      </main>

      <Dialog open={!!socialModal} onOpenChange={(open) => !open && setSocialModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{socialModal === "followers" ? "Followers" : "Following"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            {socialLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : socialUsers.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No users to show yet</div>
            ) : socialUsers.map((person) => (
              <button
                key={person.userId}
                type="button"
                onClick={() => {
                  setSocialModal(null);
                  navigate(`/users/${person.userId}`);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left transition"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white text-sm font-bold">
                  {person.profilePicUrl ? <img src={person.profilePicUrl} alt="" className="w-full h-full object-cover" /> : (person.fullName || person.username || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{person.fullName || person.username}</div>
                  <div className="text-xs text-muted-foreground truncate">@{person.username}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {activeCommentPostId !== null && (<CommentModal isOpen={true} onClose={() => setActiveCommentPostId(null)} postId={activeCommentPostId} onCommentCountChange={(postId, value) => updatePostMetric(postId, "commentsCount", value)} />)}
    </>
  );
}
