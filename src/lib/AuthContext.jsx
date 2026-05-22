import { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

const AuthContext = createContext(undefined);
const OAUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Provides authentication state across the app.
 * When backend is unreachable, user remains unauthenticated (null).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(null);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await api.auth.getProfile();
      if (data && (data.userId || data.id)) {
        let isPremium = false;
        try {
          const sub = await api.payments.getSubscriptionStatus();
          // Check for sub.active or if the unwrapped payload is successful
          isPremium = sub && (sub.active === true || sub.status === 'ACTIVE');
        } catch (e) {
          console.warn("Could not fetch premium status:", e.message);
        }

        const mappedUser = mapUserProfile(data, isPremium);
        setUser(mappedUser);
        setBackendAvailable(true);
        return mappedUser;
      }
      setUser(null);
      setBackendAvailable(false);
      return null;
    } catch {
      // Backend is down or user is not authenticated — keep user as null
      setUser(null);
      setBackendAvailable(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (window.location.pathname !== OAUTH_CALLBACK_PATH) {
      void fetchProfile();
    } else {
      setIsLoading(false);
    }

    const handleAutoLogout = () => {
      setUser(null);
    };
    document.addEventListener("auth:logout", handleAutoLogout);
    return () => document.removeEventListener("auth:logout", handleAutoLogout);
  }, []);

  const login = async () => {
    return fetchProfile();
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
  };

  const refreshProfile = async () => {
    return fetchProfile();
  };

  const updateUser = (profile) => {
    setUser((current) => {
      const mapped = mapUserProfile(profile, current?.isPremium ?? false);
      return current ? { ...current, ...mapped } : mapped;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        backendAvailable,
        login,
        logout,
        refreshProfile,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function resolveProfilePicUrl(data = {}) {
  return data.profilePicUrl || data.profileImageUrl || data.avatarUrl || data.photoUrl || data.picture || "";
}

function mapUserProfile(data = {}, isPremium = false) {
  return {
    id: data.userId || data.id,
    email: data.email,
    fullName: data.fullName || "",
    username: data.username || "",
    bio: data.bio || "",
    profilePicUrl: resolveProfilePicUrl(data),
    role: data.role || "USER",
    isPremium,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
