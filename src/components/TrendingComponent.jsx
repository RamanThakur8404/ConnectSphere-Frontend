import { TrendingUp, Hash, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function TrendingComponent({ hashtags, onHashtagClick, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
          <h3 className="font-bold text-base sm:text-lg">Trending Topics</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />))}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
        <h3 className="font-bold text-base sm:text-lg">Trending Topics</h3>
      </div>
      {hashtags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <Hash className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">No trending topics yet</p>
          <p className="text-xs text-muted-foreground mt-1">Use hashtags in posts and they will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hashtags.map((item, idx) => (
            <Link key={idx} to={`/explore?q=${encodeURIComponent(item.tag)}`} onClick={() => onHashtagClick?.(item.tag)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-xl transition border border-transparent hover:border-border group">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors flex-shrink-0">
                  <Hash className="w-4 h-4 sm:w-5 sm:h-5 text-secondary group-hover:text-white transition-colors" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-semibold text-sm truncate">#{item.tag}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{item.postCount} {item.postCount === 1 ? "post" : "posts"}</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
