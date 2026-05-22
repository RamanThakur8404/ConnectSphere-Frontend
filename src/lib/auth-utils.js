export function isAdminRole(role) {
  return role === "ADMIN" || role === "ROLE_ADMIN";
}

export function resolvePostLoginPath(user, requestedPath) {
  if (requestedPath && !requestedPath.startsWith("/auth")) {
    if (requestedPath === "/admin" && !isAdminRole(user?.role)) {
      return "/feed";
    }
    return requestedPath;
  }

  return isAdminRole(user?.role) ? "/admin" : "/feed";
}
