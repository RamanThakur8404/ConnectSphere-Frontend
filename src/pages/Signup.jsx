import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Orbit, Loader2, Eye, EyeOff, Mail, Lock, User, AtSign, ArrowRight, Check, X, ShieldCheck } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiUrl } from "@/lib/apiBase";

const PASSWORD_CHECKS = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One digit", test: (pw) => /\d/.test(pw) },
  { label: "One special character (@#$%^&+=!)", test: (pw) => /[@#$%^&+=!]/.test(pw) },
];

export default function Signup() {
  const [formData, setFormData] = useState({ fullName: "", username: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouse = (e) => { setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }); };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const handleChange = (e) => { const { name, value } = e.target; setFormData((prev) => ({ ...prev, [name]: value })); };

  const usernameValid = useMemo(() => {
    if (!formData.username) return null;
    return /^[a-zA-Z0-9_]{3,30}$/.test(formData.username);
  }, [formData.username]);

  const passwordStrength = useMemo(() => {
    const passed = PASSWORD_CHECKS.filter((c) => c.test(formData.password)).length;
    return { passed, total: PASSWORD_CHECKS.length, percent: (passed / PASSWORD_CHECKS.length) * 100 };
  }, [formData.password]);

  const passwordsMatch = formData.confirmPassword && formData.password === formData.confirmPassword;
  const strengthColor = passwordStrength.percent <= 40 ? "var(--strength-weak)" : passwordStrength.percent <= 80 ? "var(--strength-medium)" : "var(--strength-strong)";
  const strengthLabel = passwordStrength.percent <= 40 ? "Weak" : passwordStrength.percent <= 80 ? "Fair" : "Strong";
  const canProceedStep1 = formData.fullName.trim() && formData.username.trim() && usernameValid && formData.email.trim();
  const canSubmit = canProceedStep1 && passwordStrength.percent === 100 && passwordsMatch && agreed;

  const goToStep2 = () => {
    if (!formData.fullName.trim()) { toast.error("Full name is required"); return; }
    if (!formData.username.trim()) { toast.error("Username is required"); return; }
    if (!usernameValid) { toast.error("Username must be 3-30 characters (letters, digits, underscores)"); return; }
    if (!formData.email.trim()) { toast.error("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { toast.error("Please enter a valid email"); return; }
    setStep(2);
  };

  const handleSignup = async () => {
    if (!canSubmit) { toast.error("Please complete all fields correctly"); return; }
    setLoading(true);
    try {
      await api.auth.register({ fullName: formData.fullName.trim(), username: formData.username.trim(), email: formData.email.trim(), password: formData.password });
      toast.success("Account created! Please sign in.");
      navigate("/auth/login");
    } catch (error) {
      toast.error(error.message || "Unable to connect to server.");
    } finally { setLoading(false); }
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
            <div className="login-branding__logo"><div className="login-branding__icon"><Orbit className="w-8 h-8 text-white" /></div><span className="login-branding__name">ConnectSphere</span></div>
            <h2 className="login-branding__title">Start your journey<br />with us today</h2>
            <p className="login-branding__subtitle">Join thousands of creators, thinkers, and changemakers who share their stories every day.</p>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-mobile-logo"><div className="login-branding__icon login-branding__icon--sm"><Orbit className="w-6 h-6 text-white" /></div><span className="login-branding__name login-branding__name--sm">ConnectSphere</span></div>
            <div className="login-header"><h1 className="login-header__title">Create your account</h1><p className="login-header__subtitle">{step === 1 ? "Let's start with your basic info" : "Now, secure your account"}</p></div>
            <div className="signup-steps">
              <div className={`signup-step ${step >= 1 ? "signup-step--active" : ""}`}><div className="signup-step__dot">{step > 1 ? <Check className="w-3 h-3" /> : "1"}</div><span className="signup-step__label">Profile</span></div>
              <div className="signup-step__line" />
              <div className={`signup-step ${step >= 2 ? "signup-step--active" : ""}`}><div className="signup-step__dot">2</div><span className="signup-step__label">Security</span></div>
            </div>
            {step === 1 && (
              <div className="login-fields signup-fields--animate">
                <div className={`login-field ${focusedField === "fullName" ? "login-field--focused" : ""} ${formData.fullName ? "login-field--filled" : ""}`}>
                  <div className="login-field__icon"><User className="w-4 h-4" /></div>
                  <div className="login-field__inner"><label className="login-field__label" htmlFor="signup-fullname">Full Name</label><input id="signup-fullname" type="text" name="fullName" value={formData.fullName} onChange={handleChange} onFocus={() => setFocusedField("fullName")} onBlur={() => setFocusedField(null)} placeholder="John Doe" className="login-field__input" autoComplete="name" /></div>
                </div>
                <div className={`login-field ${focusedField === "username" ? "login-field--focused" : ""} ${formData.username ? (usernameValid ? "login-field--valid" : "login-field--invalid") : ""}`}>
                  <div className="login-field__icon"><AtSign className="w-4 h-4" /></div>
                  <div className="login-field__inner"><label className="login-field__label" htmlFor="signup-username">Username</label><input id="signup-username" type="text" name="username" value={formData.username} onChange={handleChange} onFocus={() => setFocusedField("username")} onBlur={() => setFocusedField(null)} placeholder="johndoe" className="login-field__input" autoComplete="username" /></div>
                  {formData.username && (<div className={`login-field__status ${usernameValid ? "login-field__status--valid" : "login-field__status--invalid"}`}>{usernameValid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}</div>)}
                </div>
                {formData.username && !usernameValid && (<p className="login-field__hint login-field__hint--error">3-30 characters, only letters, digits & underscores</p>)}
                <div className={`login-field ${focusedField === "email" ? "login-field--focused" : ""} ${formData.email ? "login-field--filled" : ""}`}>
                  <div className="login-field__icon"><Mail className="w-4 h-4" /></div>
                  <div className="login-field__inner"><label className="login-field__label" htmlFor="signup-email">Email address</label><input id="signup-email" type="email" name="email" value={formData.email} onChange={handleChange} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)} placeholder="you@example.com" className="login-field__input" autoComplete="email" /></div>
                </div>
                <div className="login-divider"><div className="login-divider__line" /><span className="login-divider__text">or sign up with</span><div className="login-divider__line" /></div>
                <div className="login-oauth">
                  <button type="button" className="login-oauth__btn" onClick={handleGoogleLogin}><svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span>Google</span></button>
                </div>
                <Button onClick={goToStep2} disabled={!canProceedStep1} className="login-submit">Continue<ArrowRight className="w-4 h-4 ml-2 login-submit__arrow" /></Button>
              </div>
            )}
            {step === 2 && (
              <div className="login-fields signup-fields--animate">
                <div className={`login-field ${focusedField === "password" ? "login-field--focused" : ""} ${formData.password ? "login-field--filled" : ""}`}>
                  <div className="login-field__icon"><Lock className="w-4 h-4" /></div>
                  <div className="login-field__inner"><label className="login-field__label" htmlFor="signup-password">Password</label><input id="signup-password" type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)} placeholder="••••••••" className="login-field__input" autoComplete="new-password" /></div>
                  <button type="button" className="login-field__toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                {formData.password && (
                  <div className="signup-strength"><div className="signup-strength__bar"><div className="signup-strength__fill" style={{ width: `${passwordStrength.percent}%`, background: strengthColor }} /></div><span className="signup-strength__label" style={{ color: strengthColor }}>{strengthLabel}</span></div>
                )}
                {formData.password && (
                  <div className="signup-checks">
                    {PASSWORD_CHECKS.map((check, i) => {
                      const passed = check.test(formData.password);
                      return (<div key={i} className={`signup-check ${passed ? "signup-check--pass" : "signup-check--fail"}`}>{passed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}<span>{check.label}</span></div>);
                    })}
                  </div>
                )}
                <div className={`login-field ${focusedField === "confirmPassword" ? "login-field--focused" : ""} ${formData.confirmPassword ? (passwordsMatch ? "login-field--valid" : "login-field--invalid") : ""}`}>
                  <div className="login-field__icon"><ShieldCheck className="w-4 h-4" /></div>
                  <div className="login-field__inner"><label className="login-field__label" htmlFor="signup-confirm">Confirm Password</label><input id="signup-confirm" type={showConfirm ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} onFocus={() => setFocusedField("confirmPassword")} onBlur={() => setFocusedField(null)} onKeyDown={(e) => e.key === "Enter" && handleSignup()} placeholder="••••••••" className="login-field__input" autoComplete="new-password" /></div>
                  <button type="button" className="login-field__toggle" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                {formData.confirmPassword && !passwordsMatch && (<p className="login-field__hint login-field__hint--error">Passwords do not match</p>)}
                <label className="signup-terms" htmlFor="signup-agree"><input type="checkbox" id="signup-agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="signup-terms__checkbox" /><span className="signup-terms__text">I agree to the <a href="#" className="signup-terms__link">Terms of Service</a> and <a href="#" className="signup-terms__link">Privacy Policy</a></span></label>
                <div className="signup-actions">
                  <button type="button" className="signup-back" onClick={() => setStep(1)}>← Back</button>
                  <Button onClick={handleSignup} disabled={loading || !canSubmit} className="login-submit signup-submit--flex">
                    {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>) : (<>Create Account<ArrowRight className="w-4 h-4 ml-2 login-submit__arrow" /></>)}
                  </Button>
                </div>
              </div>
            )}
            <p className="login-footer">Already have an account?{" "}<Link to="/auth/login" className="login-footer__link">Sign in<ArrowRight className="w-3.5 h-3.5 inline ml-1 login-footer__arrow" /></Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
