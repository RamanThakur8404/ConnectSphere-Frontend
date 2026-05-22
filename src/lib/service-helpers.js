const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"];

export function resolveMediaUrl(payload) {
  let current = payload;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object") return "";

    const url = current.url || current.mediaUrl || current.cdnUrl || current.secureUrl || current.secure_url;
    if (url) return url;

    current = current.data;
  }

  return "";
}

export function toDisplayMediaUrl(url = "") {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    const isLocalMediaUrl = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)
      && parsedUrl.pathname.startsWith("/api/v1/media/");

    if (isLocalMediaUrl) {
      return `${parsedUrl.pathname}${parsedUrl.search}`;
    }
  } catch {
    // Relative URLs are already suitable for the current frontend origin.
  }

  return url;
}

export function isVideoUrl(url = "") {
  const normalized = String(url || "").toLowerCase();
  const pathOnly = normalized.split("?")[0];
  return pathOnly.includes("/video/upload/")
    || pathOnly.includes("/video/")
    || VIDEO_EXTENSIONS.some((extension) => pathOnly.endsWith(extension) || pathOnly.includes(`${extension}/`));
}

export function getPostMediaItems(post) {
  if (Array.isArray(post?.mediaUrls) && post.mediaUrls.length > 0) {
    return post.mediaUrls
      .map((item) => {
        if (typeof item === "string") {
          return { url: toDisplayMediaUrl(item), kind: isVideoUrl(item) ? "video" : "image" };
        }

        const url = resolveMediaUrl(item);
        const mediaType = String(item?.mediaTypes || item?.mediaType || item?.type || "").toUpperCase();
        return {
          url: toDisplayMediaUrl(url),
          kind: mediaType === "VIDEO" || isVideoUrl(url) ? "video" : "image",
        };
      })
      .filter((item) => Boolean(item.url));
  }

  const fallbackItems = [];
  if (post?.imageUrl) fallbackItems.push({ url: toDisplayMediaUrl(post.imageUrl), kind: "image" });
  if (post?.videoUrl) fallbackItems.push({ url: toDisplayMediaUrl(post.videoUrl), kind: "video" });
  if (post?.image) fallbackItems.push({ url: toDisplayMediaUrl(post.image), kind: "image" });
  return fallbackItems;
}

export function resolveNotificationPath(notification) {
  if (notification?.deepLinkUrl) {
    return notification.deepLinkUrl;
  }

  const targetId = notification?.targetId;
  const targetType = String(notification?.targetType || "").toUpperCase();

  if (!targetId) {
    return null;
  }

  if (targetType === "USER") {
    return `/users/${targetId}`;
  }

  if (targetType === "POST") {
    return `/posts/${targetId}`;
  }

  if (targetType === "COMMENT") {
    return "/feed";
  }

  if (targetType === "MESSAGE") {
    return "/messages";
  }

  return null;
}

export function getStoryMediaType(story) {
  return String(story?.mediaTypes || story?.mediaType || "").toUpperCase();
}

export function getStoryViews(story) {
  return story?.viewsCount ?? story?.viewCount ?? 0;
}

export function normalizeStoryList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["data", "content", "items", "stories", "results"]) {
    const nested = normalizeStoryList(payload[key]);
    if (nested.length > 0) return nested;
  }

  return Object.values(payload)
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        if (Array.isArray(value.stories)) return value.stories;
        if (Array.isArray(value.items)) return value.items;
        if (value.mediaUrl || value.storyId || value.id) return [value];
      }
      return [];
    });
}

export function inferPlanId(subscription, history = []) {
  const amount = Number(subscription?.amount ?? history?.[0]?.amount ?? 0);
  const normalizedAmount = amount >= 10000 ? amount / 100 : amount;

  if (!subscription?.active && !subscription?.renewalDue) {
    return "free";
  }

  if (normalizedAmount >= 1499) {
    return "business";
  }

  if (normalizedAmount >= 499) {
    return "premium";
  }

  return "premium";
}

export function formatInrAmount(amount) {
  const numeric = Number(amount ?? 0);
  const normalized = numeric >= 10000 ? numeric / 100 : numeric;
  return `\u20B9${normalized.toFixed(2)}`;
}
