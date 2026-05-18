import { UserCard } from "./UserCard";
import { Search, Users } from "lucide-react";

export function SuggestedUsers({ userIds, onFollow, onUnfollow, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          <h3 className="font-bold text-base sm:text-lg">Suggested For You</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (<div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />))}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
        <h3 className="font-bold text-base sm:text-lg">Suggested For You</h3>
      </div>
      {userIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <Search className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">No suggestions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Follow a few people or explore public posts to unlock better recommendations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {userIds.map((userId) => (
            <UserCard key={userId} userId={userId} onFollow={() => onFollow?.(userId)} onUnfollow={() => onUnfollow?.(userId)} />
          ))}
        </div>
      )}
    </div>
  );
}
