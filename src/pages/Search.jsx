import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { UserCard } from "@/components/UserCard";
import {
  Search as SearchIcon, Hash, Users, FileText,
  TrendingUp, Loader2, X
} from "lucide-react";

const TABS = [
  { key: "posts", label: "Posts", icon: FileText },
  { key: "users", label: "People", icon: Users },
  { key: "hashtags", label: "Hashtags", icon: Hash },
];

export default function Search() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("posts");
  const [postResults, setPostResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [hashtagResults, setHashtagResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.searchAPI.getTrending()
      .then((data) => setTrending(data || []))
      .catch(() => {});
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setPostResults([]);
      setUserResults([]);
      setHashtagResults([]);
      return;
    }

    setLoading(true);
    try {
      const [postData, userData, hashtagData] = await Promise.allSettled([
        api.searchAPI.searchPostIds(searchQuery),
        api.auth.searchUsers(searchQuery),
        api.searchAPI.searchHashtags(searchQuery),
      ]);

      // Resolve posts
      if (postData.status === "fulfilled" && postData.value?.postIds) {
        const posts = await Promise.all(
          postData.value.postIds.slice(0, 15).map((id) =>
            api.posts.getPostById(id).catch(() => null)
          )
        );
        setPostResults(posts.filter(Boolean));
      }

      // Auth-service user search returns real profile objects, so the UI no longer
      // depends on the search-service user-search stub.
      if (userData.status === "fulfilled") {
        setUserResults(Array.isArray(userData.value) ? userData.value.slice(0, 15) : []);
      }

      // Hashtags
      if (hashtagData.status === "fulfilled") {
        setHashtagResults(hashtagData.value || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setSearchParams({ q: query });
        performSearch(query);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (initialQuery) performSearch(initialQuery);
  }, []);

  const clearSearch = () => {
    setQuery("");
    setSearchParams({});
    setPostResults([]);
    setUserResults([]);
    setHashtagResults([]);
  };

  const resultCounts = {
    posts: postResults.length,
    users: userResults.length,
    hashtags: hashtagResults.length,
  };

  return (
    <>
      <Header />
      <div className="app-shell">
        <div className="app-page max-w-2xl mx-auto">
          {/* Search Bar */}
          <div className="relative mb-6">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts, people, hashtags..."
              className="w-full pl-12 pr-10 py-3.5 bg-white border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all"
              autoFocus
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Show trending when no query */}
          {!query.trim() && trending.length > 0 && (
            <div className="mb-8">
              <h2 className="flex items-center gap-2 font-semibold text-lg mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                Trending Hashtags
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {trending.slice(0, 8).map((item) => (
                  <Link
                    key={item.tag}
                    to={`/hashtag/${encodeURIComponent(item.tag)}`}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center group-hover:from-primary/20 group-hover:to-secondary/20 transition-colors">
                      <Hash className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">#{item.tag}</p>
                      <p className="text-xs text-muted-foreground">{item.postCount} posts</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          {query.trim() && (
            <>
              <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6">
                {TABS.map((tab) => (
                  <button type="button"
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {resultCounts[tab.key] > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                        {resultCounts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Results */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {activeTab === "posts" && (
                    <div className="space-y-4">
                      {postResults.length === 0 ? (
                        <EmptyResult type="posts" query={query} />
                      ) : (
                        postResults.map((post) => (
                          <PostCard key={post.postId || post.id} post={post} currentUser={user} />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "users" && (
                    <div className="space-y-3">
                      {userResults.length === 0 ? (
                        <EmptyResult type="people" query={query} />
                      ) : (
                        userResults.map((u) => (
                          <UserCard key={u.userId || u.id} user={u} currentUser={user} />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "hashtags" && (
                    <div className="space-y-3">
                      {hashtagResults.length === 0 ? (
                        <EmptyResult type="hashtags" query={query} />
                      ) : (
                        hashtagResults.map((h) => (
                          <Link
                            key={h.tag}
                            to={`/hashtag/${encodeURIComponent(h.tag)}`}
                            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
                          >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
                              <Hash className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold">#{h.tag}</p>
                              <p className="text-sm text-muted-foreground">{h.postCount} posts</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyResult({ type, query }) {
  return (
    <div className="text-center py-12">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
        <SearchIcon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">No {type} found</h3>
      <p className="text-sm text-muted-foreground">
        No results for &quot;{query}&quot;. Try a different search term.
      </p>
    </div>
  );
}
