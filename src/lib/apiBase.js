const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");
const ensureLeadingSlash = (value) => (value.startsWith("/") ? value : `/${value}`);

export const apiBaseUrl = stripTrailingSlash(rawApiBaseUrl);

export const apiUrl = (path) => {
  const normalizedPath = ensureLeadingSlash(path);
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
};
