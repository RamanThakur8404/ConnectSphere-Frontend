import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Save, Globe, Lock, Users, Loader2 } from "lucide-react";

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public", icon: Globe },
  { value: "FOLLOWERS_ONLY", label: "Followers Only", icon: Users },
  { value: "PRIVATE", label: "Private", icon: Lock },
];

export default function EditPost() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPost = async () => {
      try {
        const data = await api.posts.getPostById(postId);
        if (data.authorId !== user?.id) {
          toast.error("You can only edit your own posts");
          navigate(-1);
          return;
        }
        setPost(data);
        setContent(data.content || "");
        setVisibility(data.visibility || "PUBLIC");
      } catch (err) {
        toast.error("Failed to load post");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    if (user) loadPost();
  }, [postId, user]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Post content cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await api.posts.updatePost(postId, { content: content.trim(), visibility });
      toast.success("Post updated!");
      navigate(`/posts/${postId}`);
    } catch (err) {
      toast.error(err.message || "Failed to update post");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="app-shell">
          <div className="app-page flex items-center justify-center app-page-fill">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="app-shell">
        <div className="app-page max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Edit Post
            </h1>
            <div className="w-16" />
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[200px] resize-none text-[15px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none bg-transparent"
                placeholder="Edit your post..."
              />
            </div>

            <div className="px-4 pb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Visibility</label>
              <div className="flex gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button type="button"
                    key={opt.value}
                    onClick={() => setVisibility(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      visibility === opt.value
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"
                    }`}
                  >
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border bg-muted/30">
              <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl transition-colors">
                Cancel
              </button>
              <button type="button"
                onClick={handleSave}
                disabled={saving || !content.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
