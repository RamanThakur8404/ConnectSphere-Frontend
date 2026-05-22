import { apiUrl } from "./apiBase";

const API_BASE = "/api/v1";
const ACCESS_TOKEN_KEY = "connectsphere_access_token";
const REFRESH_TOKEN_KEY = "connectsphere_refresh_token";

const getStoredToken = (key) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const getStoredAccessToken = () => getStoredToken(ACCESS_TOKEN_KEY);
const getStoredRefreshToken = () => getStoredToken(REFRESH_TOKEN_KEY);

export const storeAuthTokens = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  try {
    if (payload.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    if (payload.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  } catch {
    // Browser storage can fail, but cookies remain as the backend fallback.
  }
  return payload;
};

const clearAuthTokens = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing else to clean up if browser storage is unavailable.
  }
};

const withAuthHeader = (headers = {}) => {
  const nextHeaders = new Headers(headers);
  const token = getStoredAccessToken();
  if (token && !nextHeaders.has("Authorization")) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }
  return nextHeaders;
};

// ─── Token-refresh mutex ──────────────────────────────────────────────────────
// Prevents multiple concurrent requests from each triggering their own refresh.
let _isRefreshing = false;
let _refreshQueue = []; // queued { resolve, reject } callbacks

function subscribeToRefresh(onSuccess, onFailure) {
  _refreshQueue.push({ resolve: onSuccess, reject: onFailure });
}

function drainRefreshQueue(success) {
  _refreshQueue.forEach((cb) => (success ? cb.resolve() : cb.reject()));
  _refreshQueue = [];
}

async function attemptTokenRefresh() {
  try {
    const refreshToken = getStoredRefreshToken();
    // Calls /api/v1/auth/refresh with credentials (cookies) — server sets new jwt cookie
    const response = await fetch(apiUrl(`${API_BASE}/auth/refresh`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    if (!response.ok) {
      throw new Error("Refresh token is invalid or expired");
    }
    const responseText = await response.text();
    if (responseText) {
      storeAuthTokens(unwrap(JSON.parse(responseText)));
    }
    drainRefreshQueue(true);
    return true;
  } catch {
    clearAuthTokens();
    drainRefreshQueue(false);
    document.dispatchEvent(new Event("auth:logout"));
    return false;
  } finally {
    _isRefreshing = false;
  }
}

function shouldRefreshAfterUnauthorized(endpoint) {
  return ![
    "/auth/login",
    "/auth/login/otp/send",
    "/auth/login/otp/verify",
    "/auth/register",
    "/auth/refresh",
    "/auth/forget-password",
    "/auth/reset-password",
  ].includes(endpoint);
}

/**
 * Core fetch wrapper — handles JSON serialization, cookie credentials,
 * 401 auto-refresh (with fallback to logout), and response body parsing.
 */
const apiFetch = async (endpoint, options = {}, _isRetry = false) => {
  const url = apiUrl(`${API_BASE}${endpoint}`);
  const headers = withAuthHeader(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const responseText = await response.text();

  if (!response.ok) {
    // ── 401 handling with single-flight refresh ──────────────────────────────
    if (response.status === 401 && !_isRetry && shouldRefreshAfterUnauthorized(endpoint)) {
      if (_isRefreshing) {
        // Another request is already refreshing — wait for it
        await new Promise((resolve, reject) => subscribeToRefresh(resolve, reject));
        // Retry the original request after refresh succeeded
        return apiFetch(endpoint, options, true);
      }

      _isRefreshing = true;
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        return apiFetch(endpoint, options, true);
      }
      // refresh failed — logout already dispatched in attemptTokenRefresh
      throw new Error("Session expired. Please log in again.");
    }

    // ── Other error responses ────────────────────────────────────────────────
    let errorMsg = `${options.method || "GET"} ${url} → ${response.status}`;
    try {
      if (responseText) {
        const err = JSON.parse(responseText);
        errorMsg = err.message || (err.fields ? Object.values(err.fields).join(", ") : null) || err.error || errorMsg;
      }
    } catch {
      if (responseText) errorMsg = `${errorMsg} — ${responseText}`;
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204 || !responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
};

/**
 * Like apiFetch but without the Content-Type header override so multipart
 * requests work (browser sets boundary automatically).
 */
const apiFetchRaw = async (endpoint, options = {}) => {
  const url = apiUrl(`${API_BASE}${endpoint}`);
  const response = await fetch(url, {
    ...options,
    headers: withAuthHeader(options.headers || {}),
    credentials: "include",
  });
  const responseText = await response.text();
  if (!response.ok) {
    let errorMsg = `${options.method || "GET"} ${url} → ${response.status}`;
    try { if (responseText) { const err = JSON.parse(responseText); errorMsg = err.message || err.error || errorMsg; } } catch { if (responseText) errorMsg = `${errorMsg} — ${responseText}`; }
    if (response.status === 401) {
      clearAuthTokens();
      document.dispatchEvent(new Event("auth:logout"));
    }
    throw new Error(errorMsg);
  }
  if (response.status === 204 || !responseText) return null;
  try { return JSON.parse(responseText); } catch { return responseText; }
};

/**
 * Unwrap an ApiResponse<T> envelope: { success, message, data } → data
 */
const unwrap = (result) => {
  if (result && typeof result === "object" && "data" in result && "success" in result) {
    return result.data;
  }
  return result;
};

const unwrapFetch = async (endpoint, options = {}) => {
  const result = await apiFetch(endpoint, options);
  return unwrap(result);
};

const _realApi = {
  // ==========================================================================
  // AUTH SERVICE  /api/v1/auth
  // ==========================================================================
  auth: {
    /** POST /auth/register */
    register: (data) =>
      unwrapFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),

    /** POST /auth/login — sets jwt + refreshToken cookies */
    login: (data) =>
      unwrapFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }).then(storeAuthTokens),

    /** POST /auth/login/otp/send */
    sendOtp: (data) =>
      unwrapFetch("/auth/login/otp/send", { method: "POST", body: JSON.stringify(data) }),

    /** POST /auth/login/otp/verify — sets jwt + refreshToken cookies */
    verifyOtp: (data) =>
      unwrapFetch("/auth/login/otp/verify", { method: "POST", body: JSON.stringify(data) }).then(storeAuthTokens),

    /** GET /auth/users/profile (authenticated) */
    getProfile: () => unwrapFetch("/auth/users/profile"),

    /** GET /auth/users/public/{userId} — public, no auth */
    getPublicProfile: (userId) => unwrapFetch(`/auth/users/public/${userId}`),

    /** GET /auth/users/public/username/{username} — public, no auth */
    getPublicProfileByUsername: (username) =>
      unwrapFetch(`/auth/users/public/username/${encodeURIComponent(username)}`),

    /** PUT /auth/users/update */
    updateProfile: (data) =>
      unwrapFetch("/auth/users/update", { method: "PUT", body: JSON.stringify(data) }),

    /** PATCH /auth/users/password */
    changePassword: (data) =>
      unwrapFetch("/auth/users/password", { method: "PATCH", body: JSON.stringify(data) }),

    /** GET /auth/search?username= */
    searchUsers: (username) =>
      unwrapFetch(`/auth/search?username=${encodeURIComponent(username)}`),

    /** GET /auth/admin/users (ADMIN only) */
    getAllUsers: () => unwrapFetch("/auth/admin/users"),

    /** POST /auth/logout */
    logout: () => unwrapFetch("/auth/logout", { method: "POST" }).finally(clearAuthTokens),

    /** POST /auth/refresh — rolling refresh token */
    refresh: (refreshToken) =>
      unwrapFetch("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }).then(storeAuthTokens),

    /** POST /auth/forget-password */
    forgetPassword: (email) =>
      unwrapFetch("/auth/forget-password", { method: "POST", body: JSON.stringify({ email }) }),

    /** POST /auth/reset-password */
    resetPassword: (token, newPassword) =>
      unwrapFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) }),

    // --- Admin-only ---

    /** POST /auth/admin/users/create?role=ADMIN|MODERATOR */
    createPrivilegedUser: (data, role) =>
      unwrapFetch(`/auth/admin/users/create?role=${role}`, { method: "POST", body: JSON.stringify(data) }),

    /** PATCH /auth/admin/users/deactivate?userId= */
    deactivateUser: (userId) =>
      unwrapFetch(`/auth/admin/users/deactivate?userId=${userId}`, { method: "PATCH" }),

    /** PATCH /auth/admin/users/activate?userId= */
    activateUser: (userId) =>
      unwrapFetch(`/auth/admin/users/activate?userId=${userId}`, { method: "PATCH" }),
  },

  // ==========================================================================
  // POST SERVICE  /api/v1/posts
  // ==========================================================================
  posts: {
    /** POST /posts  — CreatePostRequest: { authorId, content, imageUrl?, videoUrl?, visibility? } */
    createPost: (data) =>
      unwrapFetch("/posts", { method: "POST", body: JSON.stringify(data) }),

    /** GET /posts/{postId} */
    getPostById: (postId) => unwrapFetch(`/posts/${postId}`),

    /** GET /posts/user/{authorId} */
    getUserPosts: (authorId) => unwrapFetch(`/posts/user/${authorId}`),

    /** POST /posts/feed  — FeedRequest: { followeeIds, cursor?, limit? } */
    getFeed: (followeeIds, cursor, limit = 20) =>
      unwrapFetch("/posts/feed", {
        method: "POST",
        body: JSON.stringify({ followeeIds, cursor, limit }),
      }),

    /** GET /posts/public?cursor=&limit= */
    getPublicFeed: (cursor, limit = 20) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor != null) params.set("cursor", String(cursor));
      return unwrapFetch(`/posts/public?${params}`);
    },

    /** PUT /posts/{postId}  — UpdatePostRequest: { content?, visibility? } */
    updatePost: (postId, data) =>
      unwrapFetch(`/posts/${postId}`, { method: "PUT", body: JSON.stringify(data) }),

    /** DELETE /posts/{postId} */
    deletePost: (postId) => unwrapFetch(`/posts/${postId}`, { method: "DELETE" }),

    /** GET /posts/search?keyword= */
    search: (keyword) => unwrapFetch(`/posts/search?keyword=${encodeURIComponent(keyword)}`),

    /** PUT /posts/{postId}/visibility?visibility=PUBLIC|PRIVATE|FOLLOWERS_ONLY */
    changeVisibility: (postId, visibility) =>
      unwrapFetch(`/posts/${postId}/visibility?visibility=${visibility}`, { method: "PUT" }),

    /** POST /posts/{postId}/share  — SharePostRequest: { authorId, content? } */
    sharePost: (postId, data) =>
      unwrapFetch(`/posts/${postId}/share`, { method: "POST", body: JSON.stringify(data) }),

    /** GET /posts/{postId}/shares */
    getSharesOfPost: (postId) => unwrapFetch(`/posts/${postId}/shares`),

    /**
     * POST /posts/{postId}/bookmark
     * Endpoint reads X-User-Id from header — NOT request body.
     */
    bookmarkPost: (userId, postId) =>
      unwrapFetch(`/posts/${postId}/bookmark`, {
        method: "POST",
        headers: { "X-User-Id": String(userId) },
      }),

    /**
     * DELETE /posts/{postId}/bookmark
     * Endpoint reads X-User-Id from header.
     */
    removeBookmark: (userId, postId) =>
      unwrapFetch(`/posts/${postId}/bookmark`, {
        method: "DELETE",
        headers: { "X-User-Id": String(userId) },
      }),

    /** GET /posts/bookmarks  (authenticated user) */
    getBookmarks: (userId) =>
      unwrapFetch("/posts/bookmarks", {
        headers: userId ? { "X-User-Id": String(userId) } : {},
      }),

    /** GET /posts/count/{authorId}  → { postCount: N } */
    getPostCount: (authorId) => unwrapFetch(`/posts/count/${authorId}`),
  },

  // ==========================================================================
  // LIKE SERVICE  /api/v1/likes
  // ==========================================================================
  likes: {
    /**
     * POST /likes
     * Body: { userId, targetId, targetType: "POST"|"COMMENT", reactionType: "LIKE"|"LOVE"|... }
     * Returns ApiResponse<LikeResponseDTO>
     */
    likePost: (postId, userId, reactionType = "LIKE") =>
      unwrapFetch("/likes", {
        method: "POST",
        body: JSON.stringify({ userId, targetId: postId, targetType: "POST", reactionType }),
      }),

    likeComment: (commentId, userId, reactionType = "LIKE") =>
      unwrapFetch("/likes", {
        method: "POST",
        body: JSON.stringify({ userId, targetId: commentId, targetType: "COMMENT", reactionType }),
      }),

    /**
     * DELETE /likes?userId=&targetId=&targetType=
     */
    unlikePost: (postId, userId) =>
      unwrapFetch(`/likes?userId=${userId}&targetId=${postId}&targetType=POST`, { method: "DELETE" }),

    unlikeComment: (commentId, userId) =>
      unwrapFetch(`/likes?userId=${userId}&targetId=${commentId}&targetType=COMMENT`, { method: "DELETE" }),

    /**
     * GET /likes/has-liked?userId=&targetId=&targetType=
     * Returns ApiResponse<Boolean>
     */
    hasLiked: (postId, userId) =>
      unwrapFetch(`/likes/has-liked?userId=${userId}&targetId=${postId}&targetType=POST`),

    hasLikedBatch: (postIds, userId) =>
      unwrapFetch(`/likes/has-liked-batch?userId=${userId}&targetType=POST`, {
        method: "POST",
        body: JSON.stringify(postIds),
      }),

    hasLikedComment: (commentId, userId) =>
      unwrapFetch(`/likes/has-liked?userId=${userId}&targetId=${commentId}&targetType=COMMENT`),

    /**
     * GET /likes/count?targetId=&targetType=
     * Returns ApiResponse<Integer>
     */
    getLikeCount: (postId) =>
      unwrapFetch(`/likes/count?targetId=${postId}&targetType=POST`),

    getCommentLikeCount: (commentId) =>
      unwrapFetch(`/likes/count?targetId=${commentId}&targetType=COMMENT`),

    /**
     * GET /likes/count/by-type?targetId=&targetType=&reactionType=
     */
    getLikeCountByType: (targetId, targetType, reactionType) =>
      unwrapFetch(`/likes/count/by-type?targetId=${targetId}&targetType=${targetType}&reactionType=${reactionType}`),

    /**
     * GET /likes/summary/{targetId}?targetType=
     * Returns ApiResponse<ReactionSummaryDTO>
     */
    getReactionSummary: (postId) =>
      unwrapFetch(`/likes/summary/${postId}?targetType=POST`),

    /**
     * GET /likes/target/{targetId}?targetType=
     * Returns ApiResponse<List<LikeResponseDTO>>
     */
    getLikesByTarget: (postId) =>
      unwrapFetch(`/likes/target/${postId}?targetType=POST`),

    /**
     * GET /likes/user/{userId}
     * Returns ApiResponse<List<LikeResponseDTO>>
     */
    getLikesByUser: (userId) =>
      unwrapFetch(`/likes/user/${userId}`),

    /**
     * PUT /likes/change-reaction
     * Body: { userId, targetId, targetType, newReactionType }
     */
    changeReaction: (userId, targetId, targetType, newReactionType) =>
      unwrapFetch("/likes/change-reaction", {
        method: "PUT",
        body: JSON.stringify({ userId, targetId, targetType, newReactionType }),
      }),
  },

  // ==========================================================================
  // COMMENT SERVICE  /api/v1/comments
  // ==========================================================================
  comments: {
    /** GET /comments/post/{postId} */
    getPostComments: (postId) => unwrapFetch(`/comments/post/${postId}`),

    /** GET /comments/{commentId} */
    getCommentById: (commentId) => unwrapFetch(`/comments/${commentId}`),

    /** GET /comments/{commentId}/replies */
    getReplies: (commentId) => unwrapFetch(`/comments/${commentId}/replies`),

    /** GET /comments/post/{postId}/count */
    getCommentCount: (postId) => unwrapFetch(`/comments/post/${postId}/count`),

    /** GET /comments/user/{authorId} (auth required) */
    getCommentsByUser: (authorId) => unwrapFetch(`/comments/user/${authorId}`),

    /**
     * POST /comments (auth required)
     * Body: { postId, authorId, content, parentCommentId? }
     * Note: backend overrides authorId from X-User-Id gateway header
     */
    createComment: (data) =>
      unwrapFetch("/comments", { method: "POST", body: JSON.stringify(data) }),

    /** PUT /comments/{commentId} (auth, own comment) */
    updateComment: (commentId, data) =>
      unwrapFetch(`/comments/${commentId}`, { method: "PUT", body: JSON.stringify(data) }),

    /** DELETE /comments/{commentId} (auth, own comment or admin) */
    deleteComment: (commentId) =>
      unwrapFetch(`/comments/${commentId}`, { method: "DELETE" }),

    /** POST /comments/{commentId}/like */
    likeComment: (commentId) =>
      unwrapFetch(`/comments/${commentId}/like`, { method: "POST" }),

    /** POST /comments/{commentId}/unlike */
    unlikeComment: (commentId) =>
      unwrapFetch(`/comments/${commentId}/unlike`, { method: "POST" }),
  },

  // ==========================================================================
  // FOLLOW SERVICE  /api/v1/follows
  // ==========================================================================
  follows: {
    /** POST /follows  — body: { followerId, followeeId } */
    followUser: (followerId, followeeId) =>
      unwrapFetch("/follows", { method: "POST", body: JSON.stringify({ followerId, followeeId }) }),

    /** DELETE /follows/{followerId}/{followeeId} */
    unfollowUser: (followerId, followeeId) =>
      unwrapFetch(`/follows/${followerId}/${followeeId}`, { method: "DELETE" }),

    /** GET /follows/status/{followerId}/{followeeId} → Boolean */
    isFollowing: (followerId, followeeId) =>
      unwrapFetch(`/follows/status/${followerId}/${followeeId}`),

    /** GET /follows/followers/{userId} → List<FollowResponseDTO> */
    getFollowers: (userId) => unwrapFetch(`/follows/followers/${userId}`),

    /** GET /follows/following/{userId} → List<FollowResponseDTO> */
    getFollowing: (userId) => unwrapFetch(`/follows/following/${userId}`),

    /** GET /follows/counts/{userId} → { followerCount, followingCount } */
    getFollowCounts: (userId) => unwrapFetch(`/follows/counts/${userId}`),

    /** GET /follows/follower-count/{userId} → Integer */
    getFollowerCount: (userId) => unwrapFetch(`/follows/follower-count/${userId}`),

    /** GET /follows/following-count/{userId} → Integer */
    getFollowingCount: (userId) => unwrapFetch(`/follows/following-count/${userId}`),

    /** GET /follows/mutual/{userId}/{otherUserId} → List<Integer> */
    getMutualFollows: (userId, otherUserId) =>
      unwrapFetch(`/follows/mutual/${userId}/${otherUserId}`),

    /** GET /follows/suggested/{userId} → List<Integer> (user IDs) */
    getSuggested: (userId) => unwrapFetch(`/follows/suggested/${userId}`),
  },

  // ==========================================================================
  // NOTIFICATION SERVICE  /api/v1/notifications
  // ==========================================================================
  notifications: {
    create: (data) =>
      unwrapFetch("/notifications", { method: "POST", body: JSON.stringify(data) }),

    sendBulk: (data) =>
      unwrapFetch("/notifications/bulk", { method: "POST", body: JSON.stringify(data) }),

    sendEmailAlert: (data) =>
      unwrapFetch("/notifications/email", { method: "POST", body: JSON.stringify(data) }),

    /**
     * GET /notifications/recipient/{recipientId}?unreadOnly=
     * Returns ApiResponse<List<ResponseDTO>>
     */
    getForUser: (userId, unreadOnly = false) =>
      unwrapFetch(`/notifications/recipient/${userId}?unreadOnly=${unreadOnly}`),

    /**
     * GET /notifications/recipient/{recipientId}/paged?page=&size=
     * Returns ApiResponse<List<SummaryDTO>>
     */
    getForUserPaged: (userId, page = 0, size = 20) =>
      unwrapFetch(`/notifications/recipient/${userId}/paged?page=${page}&size=${size}`),

    /**
     * GET /notifications/recipient/{recipientId}/unread-count
     * Returns ApiResponse<Integer>
     */
    getUnreadCount: (userId) =>
      unwrapFetch(`/notifications/recipient/${userId}/unread-count`),

    /**
     * PUT /notifications/{notificationId}/read
     */
    markAsRead: (notificationId) =>
      unwrapFetch(`/notifications/${notificationId}/read`, { method: "PUT" }),

    /**
     * PUT /notifications/recipient/{recipientId}/read-all
     */
    markAllRead: (userId) =>
      unwrapFetch(`/notifications/recipient/${userId}/read-all`, { method: "PUT" }),

    /**
     * DELETE /notifications/{notificationId}
     */
    deleteNotification: (notificationId) =>
      unwrapFetch(`/notifications/${notificationId}`, { method: "DELETE" }),

    /**
     * GET /notifications/all  (ADMIN only)
     */
    getAll: () => unwrapFetch("/notifications/all"),

    /**
     * DELETE /notifications/admin/{notificationId}  (ADMIN only)
     */
    adminDelete: (notificationId) =>
      unwrapFetch(`/notifications/admin/${notificationId}`, { method: "DELETE" }),
  },

  // ==========================================================================
  // SEARCH SERVICE  /api/v1
  // NOTE: searchPosts and searchUsers return POST IDs / USER IDs only.
  //       Callers must then fetch full objects via posts.getPostById / auth.getPublicProfile.
  // ==========================================================================
  searchAPI: {
    /**
     * GET /hashtags/trending
     * Returns ApiResponseDto<List<HashtagSummaryDto>>  → unwrap → List<{ tag, postCount }>
     */
    getTrending: () => unwrapFetch("/hashtags/trending"),

    /**
     * GET /hashtags?fragment=
     * Returns ApiResponseDto<List<HashtagResponseDto>> → unwrap → List<{ tag, postCount }>
     */
    searchHashtags: (fragment) =>
      unwrapFetch(`/hashtags?fragment=${encodeURIComponent(fragment)}`),

    /**
     * GET /hashtags/{tag}/posts
     * Returns ApiResponseDto<PostIdListResponseDto> → unwrap → { postIds: [], total: N }
     */
    getPostsByHashtag: (tag) =>
      unwrapFetch(`/hashtags/${encodeURIComponent(tag)}/posts`),

    /**
     * GET /hashtags/{tag}/count
     * Returns ApiResponseDto<Integer>
     */
    getHashtagCount: (tag) =>
      unwrapFetch(`/hashtags/${encodeURIComponent(tag)}/count`),

    /**
     * GET /posts/{postId}/hashtags
     * Returns ApiResponseDto<List<HashtagResponseDto>>
     */
    getHashtagsForPost: (postId) =>
      unwrapFetch(`/posts/${postId}/hashtags`),

    /**
     * GET /search/posts?keyword=
     * Returns ApiResponseDto<PostIdListResponseDto> → unwrap → { postIds: [], total: N }
     * NOTE: Frontend must then fetch each post by ID.
     */
    searchPostIds: (keyword) =>
      unwrapFetch(`/search/posts?keyword=${encodeURIComponent(keyword)}`),

    /**
     * GET /search/users?query=
     * Returns ApiResponseDto<UserIdListResponseDto> → unwrap → { userIds: [], total: N }
     * NOTE: Frontend must then fetch each user by ID.
     */
    searchUserIds: (query) =>
      unwrapFetch(`/search/users?query=${encodeURIComponent(query)}`),
  },

  // ==========================================================================
  // REPORT SERVICE  /api/v1/reports
  // NOTE: create, resolve, dismiss all require X-User-Id header (gateway provides
  //       this from JWT; we pass it explicitly for direct calls).
  // ==========================================================================
  reports: {
    /**
     * POST /reports
     * Body: CreateReportRequestDto { targetId, targetType, reason, description }
     * Header: X-User-Id (reporter's ID)
     */
    createReport: (data, userId) =>
      unwrapFetch("/reports", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "X-User-Id": String(userId) },
      }),

    /** GET /reports/{reportId} */
    getReportById: (reportId) => unwrapFetch(`/reports/${reportId}`),

    /** POST /reports/{reportId}/ai-analysis/retry */
    retryAiAnalysis: (reportId, userId) =>
      unwrapFetch(`/reports/${reportId}/ai-analysis/retry`, {
        method: "POST",
        headers: { "X-User-Id": String(userId) },
      }),

    /**
     * GET /reports/queue?status=&page=&size=
     * status is optional; backend uses Spring Pageable defaults (size=20, sort=createdAt)
     */
    getQueue: (status, page = 0, size = 20) => {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (status) params.set("status", status);
      return unwrapFetch(`/reports/queue?${params}`);
    },

    /**
     * PUT /reports/{reportId}/resolve
     * Body: ResolveReportRequestDto { resolutionNote }
     * Header: X-User-Id (admin ID)
     */
    resolveReport: (reportId, data, userId) =>
      unwrapFetch(`/reports/${reportId}/resolve`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "X-User-Id": String(userId) },
      }),

    /**
     * PUT /reports/{reportId}/review
     * Header: X-User-Id (admin ID)
     */
    markUnderReview: (reportId, userId) =>
      unwrapFetch(`/reports/${reportId}/review`, {
        method: "PUT",
        headers: { "X-User-Id": String(userId) },
      }),

    /**
     * PUT /reports/{reportId}/dismiss
     * Header: X-User-Id (admin ID)
     */
    dismissReport: (reportId, userId) =>
      unwrapFetch(`/reports/${reportId}/dismiss`, {
        method: "PUT",
        headers: { "X-User-Id": String(userId) },
      }),

    /** GET /reports/user/{userId}  (paginated) */
    getUserReports: (userId, page = 0, size = 20) =>
      unwrapFetch(`/reports/user/${userId}?page=${page}&size=${size}`),

    /** GET /reports/stats */
    getStats: () => unwrapFetch("/reports/stats"),
  },

  // ==========================================================================
  // MEDIA SERVICE  /api/v1
  // POST /media/upload requires multipart with BOTH "file" and "metadata" parts.
  // ==========================================================================
  media: {
    /**
     * POST /media/upload
     * Sends a multipart/form-data request with:
     *   - file: the binary file
     *   - metadata: JSON blob { uploaderId, linkedPostId?, mediaTypes? }
     */
    upload: (file, uploaderId, postId = null) => {
      const formData = new FormData();
      formData.append("file", file);
      const metadata = { uploaderId, mediaTypes: file.type.startsWith("video/") ? "VIDEO" : "IMAGE" };
      if (postId) metadata.linkedPostId = postId;
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      return apiFetchRaw("/media/upload", { method: "POST", body: formData }).then(unwrap);
    },

    /** GET /media/{mediaId} */
    getById: (mediaId) => unwrapFetch(`/media/${mediaId}`),

    /** GET /media/post/{postId} */
    getByPost: (postId) => unwrapFetch(`/media/post/${postId}`),

    /** DELETE /media/{mediaId} */
    delete: (mediaId) => unwrapFetch(`/media/${mediaId}`, { method: "DELETE" }),

    // --- Stories ---

    /**
     * POST /stories
     * Body: StoryRequestDto { authorId, mediaUrl, mediaTypes? }
     */
    createStory: (data) =>
      unwrapFetch("/stories", { method: "POST", body: JSON.stringify(data) }),

    /**
     * GET /stories/active?authorIds=1,2,3
     * Returns List<StoryResponseDto>
     */
    getActiveStories: (authorIds) =>
      unwrapFetch(`/stories/active?authorIds=${authorIds.join(",")}`),

    /**
     * GET /stories/user/{authorId}
     */
    getStoriesByUser: (authorId) => unwrapFetch(`/stories/user/${authorId}`),

    /**
     * POST /stories/{storyId}/view?viewerId=
     */
    viewStory: (storyId, viewerId) =>
      unwrapFetch(`/stories/${storyId}/view?viewerId=${viewerId}`, { method: "POST" }),

    /**
     * DELETE /stories/{storyId}
     */
    deleteStory: (storyId) =>
      unwrapFetch(`/stories/${storyId}`, { method: "DELETE" }),
  },

  // ==========================================================================
  // PAYMENT SERVICE  /api/v1/payments
  // NOTE: userId is extracted from JWT by backend — NOT from body/header.
  // ==========================================================================
  payments: {
    /**
     * POST /payments/order
     * Body: CreateOrderRequest { amount, currency, paymentType, description? }
     */
    createOrder: (data) =>
      unwrapFetch("/payments/order", { method: "POST", body: JSON.stringify(data) }),

    /**
     * GET /payments/history  (paginated, auth-only)
     * NOTE: The backend endpoint is /history, NOT /user/{userId}
     */
    getHistory: (page = 0, size = 10) =>
      unwrapFetch(`/payments/history?page=${page}&size=${size}`),

    /**
     * GET /payments/subscription/status
     */
    getSubscriptionStatus: () => unwrapFetch("/payments/subscription/status"),

    /**
     * POST /payments/verify
     * Body: VerifyPaymentRequest { razorpayOrderId, razorpayPaymentId, razorpaySignature }
     */
    verifyPayment: (data) =>
      unwrapFetch("/payments/verify", { method: "POST", body: JSON.stringify(data) }),

    /**
     * POST /payments/admin/refund/{paymentId}  (ADMIN only)
     */
    refund: (paymentId, data) =>
      unwrapFetch(`/payments/admin/refund/${paymentId}`, { method: "POST", body: JSON.stringify(data) }),

    /**
     * POST /payments/admin/approve/{paymentId}  (ADMIN only)
     */
    approvePayment: (paymentId) =>
      unwrapFetch(`/payments/admin/approve/${paymentId}`, { method: "POST" }),

    /**
     * POST /payments/admin/cancel/{paymentId}  (ADMIN only)
     */
    cancelPayment: (paymentId) =>
      unwrapFetch(`/payments/admin/cancel/${paymentId}`, { method: "POST" }),

    /**
     * GET /payments/admin/history  (ADMIN only, paginated)
     */
    getAllPayments: (page = 0, size = 20) =>
      unwrapFetch(`/payments/admin/history?page=${page}&size=${size}`),

    /**
     * GET /payments/admin/summary  (ADMIN only)
     */
    getAdminSummary: () => unwrapFetch("/payments/admin/summary"),
  },

  // ==========================================================================
  // ADMIN SERVICE  /api/v1/admin
  // ==========================================================================
  admin: {
    /** GET /admin/health */
    health: () => unwrapFetch("/admin/health"),

    /**
     * GET /admin/dashboard  (ADMIN only)
     * Returns a static welcome payload — not real analytics.
     */
    getDashboard: () => unwrapFetch("/admin/dashboard"),

    /**
     * POST /admin/logs  (ADMIN only)
     * Body: { action, details, targetType, targetId?, status }
     */
    createAuditLog: (data) =>
      unwrapFetch("/admin/logs", { method: "POST", body: JSON.stringify(data) }),

    /**
     * GET /admin/logs?page=&size=  (ADMIN only, Spring Pageable)
     * Returns Page<AuditLogResponse>
     */
    getAuditLogs: (page = 0, size = 20) =>
      unwrapFetch(`/admin/logs?page=${page}&size=${size}`),

    /**
     * GET /admin/logs/admin/{adminUserId}?page=&size=  (ADMIN only)
     */
    getAuditLogsByAdmin: (adminUserId, page = 0, size = 20) =>
      unwrapFetch(`/admin/logs/admin/${adminUserId}?page=${page}&size=${size}`),

    /**
     * GET /admin/logs/target/{targetType}?page=&size=  (ADMIN only)
     * targetType: USER | POST | COMMENT | etc.
     */
    getAuditLogsByTargetType: (targetType, page = 0, size = 20) =>
      unwrapFetch(`/admin/logs/target/${targetType}?page=${page}&size=${size}`),

    /**
     * GET /admin/logs/action/{action}?page=&size=  (ADMIN only)
     */
    getAuditLogsByAction: (action, page = 0, size = 20) =>
      unwrapFetch(`/admin/logs/action/${action}?page=${page}&size=${size}`),
  },

  // ==========================================================================
  // MESSAGE SERVICE  /api/v1/messages
  // ==========================================================================
  messages: {
    getConversations: () => unwrapFetch("/messages/conversations"),
    
    getOrCreateConversation: (otherUserId) => 
      unwrapFetch(`/messages/conversations/${otherUserId}`, { method: "POST" }),
    
    getMessages: (conversationId, page = 0, size = 50) => 
      unwrapFetch(`/messages/conversations/${conversationId}/messages?page=${page}&size=${size}`),
    
    sendMessage: (conversationId, content) => 
      unwrapFetch(`/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content })
      }),

    updateMessage: (messageId, content) =>
      unwrapFetch(`/messages/messages/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({ content })
      }),

    deleteMessage: (messageId) =>
      unwrapFetch(`/messages/messages/${messageId}`, { method: "DELETE" }),
    
    markAsRead: (conversationId) => 
      unwrapFetch(`/messages/conversations/${conversationId}/read`, { method: "PUT" }),
    
    getUnreadCount: () => unwrapFetch("/messages/unread-count"),
  },
};

export const api = _realApi;
