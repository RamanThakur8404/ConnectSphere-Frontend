import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Orbit, Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.auth.forgetPassword(email);
      setSent(true);
      toast.success("Password reset email sent!");
    } catch (err) {
      toast.error(err?.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/5 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Orbit className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">ConnectSphere</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-border p-8">
          {sent ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Check your email</h2>
              <p className="text-muted-foreground text-sm mb-6">
                We've sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the instructions.
              </p>
              <div className="space-y-3">
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setSent(false)}>
                  Send again
                </Button>
                <Link to="/auth/login">
                  <Button variant="ghost" className="w-full rounded-xl gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mb-2">Forgot password?</h2>
              <p className="text-center text-muted-foreground text-sm mb-6">
                Enter your email and we'll send you a reset link
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition" />
                  </div>
                </div>
                <Button type="submit" disabled={loading || !email.trim()} className="w-full rounded-xl h-11 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-medium">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/auth/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
