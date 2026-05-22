import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Orbit, Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, Palette, Lightbulb } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { apiUrl } from "@/lib/apiBase";
import { isAdminRole, resolvePostLoginPath } from "@/lib/auth-utils";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [loginMode, setLoginMode] = useState("password");
  const [otpStep, setOtpStep] = useState("request");
  const [otpCode, setOtpCode] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = typeof location.state?.from === "string" ? location.state.from : null;

  useEffect(() => {
    const handleMouse = (e) => { setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }); };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const finishLogin = async () => {
    const profile = await login();
    if (!profile) {
      throw new Error("Signed in, but failed to load your profile.");
    }
    const nextPath = resolvePostLoginPath(profile, requestedPath);

    if (requestedPath === "/admin" && !isAdminRole(profile?.role)) {
      toast.error("This account does not have admin access.");
    } else {
      toast.success("Welcome back!");
    }

    navigate(nextPath, { replace: true });
  };

  const handleLogin = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email address"); return; }
    if (!password) { toast.error("Password is required"); return; }
    setLoading(true);
    try {
      await api.auth.login({ email, password });
      await finishLogin();
    } catch (error) {
      toast.error(error.message || "Unable to connect to server.");
    } finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email address"); return; }
    setLoading(true);
    try { await api.auth.sendOtp({ email }); toast.success("OTP sent to your email"); setOtpStep("verify"); }
    catch (error) { toast.error(error.message || "Unable to send OTP."); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) { toast.error("Please enter the 6-digit OTP"); return; }
    setLoading(true);
    try { await api.auth.verifyOtp({ email, otp: otpCode }); await finishLogin(); }
    catch (error) { toast.error(error.message || "Invalid or expired OTP."); }
    finally { setLoading(false); }
  };

  const handlePrimaryAction = () => {
    if (loginMode === "otp") { if (otpStep === "request") handleSendOtp(); else handleVerifyOtp(); }
    else { handleLogin(); }
  };

  const handleGoogleLogin = () => { window.location.href = apiUrl("/oauth2/authorization/google"); };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb--1" style={{ transform: `translate(${mousePos.x * 40 - 20}px, ${mousePos.y * 40 - 20}px)` }} />
        <div className="login-orb login-orb--2" style={{ transform: `translate(${mousePos.x * -30 + 15}px, ${mousePos.y * -30 + 15}px)` }} />
        <div className="login-orb login-orb--3" />
        <div className="login-grid" />
      </div>
      <div className="login-container">
        <div className="login-branding">
          <div className="login-branding__content">
            <div className="login-branding__logo">
              <div className="login-branding__icon"><Orbit className="w-8 h-8 text-white" /></div>
              <span className="login-branding__name">ConnectSphere</span>
            </div>
            <h2 className="login-branding__title">Where ideas connect<br />and communities thrive</h2>
            <p className="login-branding__subtitle">Share moments, build meaningful connections, and inspire the world around you.</p>
            <div className="login-branding__cards">
              <div className="login-testimonial login-testimonial--1">
                <div className="login-testimonial__avatar"><Palette className="w-5 h-5" /></div>
                <div><p className="login-testimonial__text">"Best platform for creative networking!"</p><span className="login-testimonial__author">- Sarah, Designer</span></div>
              </div>
              <div className="login-testimonial login-testimonial--2">
                <div className="login-testimonial__avatar"><Lightbulb className="w-5 h-5" /></div>
                <div><p className="login-testimonial__text">"Found my tribe here. Absolutely love it."</p><span className="login-testimonial__author">- Alex, Developer</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-mobile-logo">
              <div className="login-branding__icon login-branding__icon--sm"><Orbit className="w-6 h-6 text-white" /></div>
              <span className="login-branding__name login-branding__name--sm">ConnectSphere</span>
            </div>
            <div className="login-header">
              <h1 className="login-header__title">{loginMode === "otp" && otpStep === "verify" ? "Verify Code" : "Welcome back"}</h1>
              <p className="login-header__subtitle">{loginMode === "otp" && otpStep === "verify" ? `Enter the code sent to ${email}` : "Sign in to continue your journey"}</p>
            </div>
            <div className="login-oauth">
              <button type="button" className="login-oauth__btn" onClick={handleGoogleLogin} id="google-login-btn">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                <span>Google</span>
              </button>
            </div>
            <div className="login-divider"><div className="login-divider__line" /><span className="login-divider__text">{loginMode === "otp" ? "sign in with code" : "or sign in with email"}</span><div className="login-divider__line" /></div>
            <div className="login-fields">
              {!(loginMode === "otp" && otpStep === "verify") && (
                <div className={`login-field ${focusedField === "email" ? "login-field--focused" : ""} ${email ? "login-field--filled" : ""}`}>
                  <div className="login-field__icon"><Mail className="w-4 h-4" /></div>
                  <div className="login-field__inner">
                    <label className="login-field__label" htmlFor="login-email">Email address</label>
                    <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)} onKeyDown={(e) => e.key === "Enter" && handlePrimaryAction()} placeholder="you@example.com" className="login-field__input" autoComplete="email" />
                  </div>
                </div>
              )}
              {loginMode === "password" && (
                <div className={`login-field ${focusedField === "password" ? "login-field--focused" : ""} ${password ? "login-field--filled" : ""}`}>
                  <div className="login-field__icon"><Lock className="w-4 h-4" /></div>
                  <div className="login-field__inner">
                    <label className="login-field__label" htmlFor="login-password">Password</label>
                    <input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)} onKeyDown={(e) => e.key === "Enter" && handlePrimaryAction()} placeholder="••••••••" className="login-field__input" autoComplete="current-password" />
                  </div>
                  <button type="button" className="login-field__toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
              {loginMode === "otp" && otpStep === "verify" && (
                <div className={`login-field ${focusedField === "otpCode" ? "login-field--focused" : ""} ${otpCode ? "login-field--filled" : ""}`}>
                  <div className="login-field__icon"><Lock className="w-4 h-4" /></div>
                  <div className="login-field__inner">
                    <label className="login-field__label" htmlFor="login-otp">6-Digit Code</label>
                    <input id="login-otp" type="text" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} onFocus={() => setFocusedField("otpCode")} onBlur={() => setFocusedField(null)} onKeyDown={(e) => e.key === "Enter" && handlePrimaryAction()} placeholder="000000" className="login-field__input tracking-widest" autoComplete="one-time-code" />
                  </div>
                </div>
              )}
              <div className="login-forgot" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                {loginMode === "password" ? (
                  <>
                    <button type="button" onClick={() => setLoginMode("otp")} className="login-forgot__link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>Use one-time code</button>
                    <Link to="/auth/forgot-password" className="login-forgot__link">Forgot password?</Link>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setLoginMode("password"); setOtpStep("request"); }} className="login-forgot__link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>Sign in with password</button>
                    {otpStep === "verify" && <button type="button" onClick={handleSendOtp} className="login-forgot__link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>Resend Code</button>}
                  </>
                )}
              </div>
            </div>
            <Button onClick={handlePrimaryAction} disabled={loading} className="login-submit" id="login-submit-btn">
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Please wait...</>) : (<>{loginMode === "password" ? "Sign In" : otpStep === "request" ? "Send Login Code" : "Verify & Sign In"}<ArrowRight className="w-4 h-4 ml-2 login-submit__arrow" /></>)}
            </Button>
            <p className="login-footer">Don&apos;t have an account?{" "}<Link to="/auth/signup" className="login-footer__link">Create one<ArrowRight className="w-3.5 h-3.5 inline ml-1 login-footer__arrow" /></Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
