import { Button } from "@/components/ui/button";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export function UserCard({ userId, onFollow, onUnfollow, isLoading = false }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFetchingProfile(true);
      try {
        const [pub, counts] = await Promise.all([
          api.auth.getPublicProfile(userId).catch(() => null),
          api.follows.getFollowCounts(userId).catch(() => null),
        ]);
        if (cancelled) return;
        if (pub) setProfile(pub);
        if (counts) setFollowerCount(counts.followerCount ?? 0);
        if (currentUser && currentUser.id !== userId) {
          const following = await api.follows.isFollowing(currentUser.id, userId).catch(() => false);
          if (!cancelled) setIsFollowing(!!following);
        }
      } finally {
        if (!cancelled) setFetchingProfile(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser, userId]);

  const handleFollow = async () => {
    if (!currentUser) {
      navigate("/auth/login");
      return;
    }

    try {
      if (onFollow) {
        await onFollow();
      } else {
        await api.follows.followUser(currentUser.id, userId);
      }
      setIsFollowing(true);
      setFollowerCount((count) => count + 1);
    } catch (error) {
      toast.error(error?.message || "Failed to follow user");
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser) {
      navigate("/auth/login");
      return;
    }

    try {
      if (onUnfollow) {
        await onUnfollow();
      } else {
        await api.follows.unfollowUser(currentUser.id, userId);
      }
      setIsFollowing(false);
      setFollowerCount((count) => Math.max(0, count - 1));
    } catch (error) {
      toast.error(error?.message || "Failed to unfollow user");
    }
  };

  if (fetchingProfile) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-border shadow-sm animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-2 w-32 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded-full" />
        </div>
      </div>
    );
  }

  const displayName = profile?.fullName || profile?.username || `User ${userId}`;
  const username = profile?.username || `user_${userId}`;
  const bio = profile?.bio || "A ConnectSphere member";
  const isSelf = currentUser?.id === userId;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col items-center text-center mb-4 cursor-pointer" onClick={() => navigate(`/users/${userId}`)}>
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white font-bold text-lg mb-3 flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-bold text-sm sm:text-base mb-0.5 line-clamp-1 hover:underline flex items-center justify-center gap-1">
          {displayName}
          {profile?.isPremium && <VerifiedBadge />}
        </h3>
        <p className="text-xs text-muted-foreground mb-1">@{username}</p>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">{bio}</p>
        <div className="text-xs font-semibold text-primary mb-4">{followerCount.toLocaleString()} followers</div>
      </div>
      {!isSelf && isFollowing ? (
        <Button variant="outline" size="sm" onClick={handleUnfollow} disabled={isLoading} className="w-full rounded-full gap-2 text-xs">
          <Check className="w-3 h-3" /> Following
        </Button>
      ) : !isSelf ? (
        <Button size="sm" onClick={handleFollow} disabled={isLoading} className="w-full rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white gap-2 text-xs">
          <UserPlus className="w-3 h-3" /> Follow
        </Button>
      ) : null}
    </div>
  );
}
