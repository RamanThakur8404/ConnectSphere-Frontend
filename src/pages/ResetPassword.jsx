import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Orbit, Loader2, Lock, Eye, EyeOff, CheckCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-amber-500", "bg-primary", "bg-green-500"][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      toast.success("Password reset successfully!");
    } catch (err) {
      toast.error(err?.message || "Failed to reset password. Token may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/5 px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-border p-8 max-w-md w-full text-center">
          <ShieldCheck className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
          <p className="text-muted-foreground text-sm mb-6">This reset link is invalid or has expired.</p>
          <Link to="/auth/forgot-password"><Button className="rounded-xl">Request a new link</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/5 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg"><Orbit className="w-6 h-6 text-white" /></div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ConnectSphere</span>
          </Link>
        </div>
        <div className="bg-white rounded-3xl shadow-xl border border-border p-8">
          {done ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
              <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
              <p className="text-muted-foreground text-sm mb-6">Your password has been changed successfully.</p>
              <Link to="/auth/login"><Button className="w-full rounded-xl h-11 bg-gradient-to-r from-primary to-secondary text-white">Sign In</Button></Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Set new password</h2>
              <p className="text-center text-muted-foreground text-sm mb-6">Choose a strong password for your account</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 text-sm transition" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">{[1,2,3,4].map((i) => (<div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-gray-200"}`} />))}</div>
                      <p className={`text-xs ${strength >= 3 ? "text-green-600" : strength >= 2 ? "text-amber-600" : "text-red-500"}`}>{strengthLabel}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm your password" required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 text-sm transition" />
                  </div>
                  {confirm && password !== confirm && <p className="text-xs text-destructive mt-1">Passwords don't match</p>}
                </div>
                <Button type="submit" disabled={loading || !password || password !== confirm} className="w-full rounded-xl h-11 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-medium">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/auth/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back to login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
