import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Orbit, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { resolvePostLoginPath } from "@/lib/auth-utils";
import { storeAuthTokens } from "@/lib/api";

export default function OAuth2Redirect() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [errorDetails, setErrorDetails] = useState(null);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");

        if (accessToken) {
          storeAuthTokens({ accessToken, refreshToken });
          window.history.replaceState({}, document.title, "/auth/callback");
        } else {
          throw new Error("OAuth callback did not include an access token. Rebuild and redeploy auth-service.");
        }

        const profile = await login();
        if (!profile) {
          throw new Error("Signed in, but failed to load your profile.");
        }
        navigate(resolvePostLoginPath(profile), { replace: true });
      } catch (err) { setErrorDetails(`Network Error: ${err.message}`); }
    };
    verifyAuth();
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center"><div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg animate-pulse"><Orbit className="w-9 h-9 text-white" /></div></div>
        {errorDetails ? (
          <div className="space-y-4 max-w-sm mx-auto shadow-sm border p-4 bg-red-50 text-red-700 text-sm rounded-lg whitespace-pre-wrap break-words">
            <strong>Authentication Verification Failed:</strong><p>{errorDetails}</p>
            <button type="button" onClick={() => navigate("/auth/login")} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Go Back to Login</button>
          </div>
        ) : (
          <><div className="space-y-2"><h1 className="text-2xl font-bold text-foreground">Welcome to ConnectSphere!</h1><p className="text-muted-foreground">Authentication successful. Redirecting you...</p></div><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></>
        )}
      </div>
    </div>
  );
}
