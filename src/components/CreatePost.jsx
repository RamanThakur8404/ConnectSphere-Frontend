import { Button } from "@/components/ui/button";
import { ImagePlus, Video, Smile, Loader2, X, Film } from "lucide-react";
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/service-helpers";
import { toast } from "sonner";

const EMOJI_LIST = [
  "😀","😂","😍","🥰","😎","🤔","😢","😡","🎉","🔥","❤️","👍",
  "👏","🙏","✨","🌟","💯","🚀","🎊","💪","😊","🤗","😅","🥳",
  "😏","🤩","😴","🤣","😇","🙌","💖","🌈","🎯","💡","🌙","⭐",
];

export function CreatePost({ user, onSubmit, loading = false, placeholder = "What's on your mind?" }) {
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleSubmit = async () => {
    if (!content.trim() && !mediaUrl) return;
    await onSubmit(content, mediaUrl, mediaType);
    setContent("");
    setMediaUrl("");
    setMediaType(null);
    setIsExpanded(false);
    setShowEmoji(false);
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return;
    const maxSize = type === "video" ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`${type === "video" ? "Video" : "Image"} must be under ${type === "video" ? "100MB" : "10MB"}`);
      return;
    }
    setUploading(true);
    try {
      // media.upload(file, uploaderId, postId?) — postId is null for new posts
      const result = await api.media.upload(file, user.id);
      const url = resolveMediaUrl(result);
      if (!url) throw new Error("No URL returned from media service");
      setMediaUrl(url);
      setMediaType(type);
      setIsExpanded(true);
      toast.success(`${type === "video" ? "Video" : "Image"} uploaded!`);
    } catch (err) {
      toast.error(err?.message || "Upload failed — is the media service running?");
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, "image");
    e.target.value = "";
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, "video");
    e.target.value = "";
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) { setContent((c) => c + emoji); setShowEmoji(false); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + emoji + content.slice(end);
    setContent(newContent);
    setShowEmoji(false);
    setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + emoji.length; textarea.focus(); }, 0);
  };

  if (!user) return null;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-border mb-4 sm:mb-6">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0 text-sm sm:text-base">
            {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
          </div>
          <textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            rows={isExpanded ? 3 : 1}
            className="flex-1 bg-muted rounded-2xl py-2.5 sm:py-3 px-4 outline-none text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all resize-none"
          />
        </div>

        {mediaUrl && (
          <div className="relative ml-13 rounded-xl overflow-hidden bg-black/5 border border-border">
            {mediaType === "video" ? (
              <video src={mediaUrl} controls className="w-full max-h-64 rounded-xl object-contain" />
            ) : (
              <img src={mediaUrl} alt="Attachment" className="w-full max-h-64 object-cover rounded-xl" />
            )}
            <button type="button" onClick={() => { setMediaUrl(""); setMediaType(null); }} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition" aria-label="Remove media">
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
              {mediaType === "video" ? <Film className="w-3 h-3" /> : <ImagePlus className="w-3 h-3" />}
              {mediaType === "video" ? "Video" : "Image"}
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border relative">
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading} title="Upload image" className="p-2 hover:bg-muted rounded-full transition text-muted-foreground hover:text-primary disabled:opacity-50">
                {uploading && mediaType !== "video" ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploading} title="Upload video" className="p-2 hover:bg-muted rounded-full transition text-muted-foreground hover:text-primary disabled:opacity-50">
                {uploading && mediaType === "video" ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <div className="relative">
                <button type="button" onClick={() => setShowEmoji(!showEmoji)} title="Add emoji" className={`p-2 rounded-full transition ${showEmoji ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}>
                  <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                {showEmoji && (
                  <div className="absolute left-0 bottom-full mb-2 bg-white border border-border shadow-xl rounded-2xl p-3 z-50 w-64">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Pick an emoji</p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {EMOJI_LIST.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="p-1.5 text-lg hover:bg-muted rounded-lg transition leading-none">{emoji}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setContent(""); setMediaUrl(""); setMediaType(null); setIsExpanded(false); setShowEmoji(false); }} className="rounded-full px-4 sm:px-6 text-sm">Cancel</Button>
              <Button disabled={(!content.trim() && !mediaUrl) || loading || uploading} onClick={handleSubmit} className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white rounded-full px-5 sm:px-6 text-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
