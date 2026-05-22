import { Header } from "@/components/Header";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CreditCard, Crown, Loader2, CheckCircle, Star, Zap,
  ArrowLeft, Sparkles, Receipt, BadgeCheck,
} from "lucide-react";
import { formatInrAmount, inferPlanId } from "@/lib/service-helpers";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    icon: Star,
    color: "from-gray-400 to-gray-500",
    features: ["5 posts per day", "Basic search", "Follow up to 500 users", "Standard support"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 499,
    period: "/month",
    icon: Crown,
    color: "from-primary to-secondary",
    popular: true,
    features: ["Unlimited posts", "Advanced analytics", "Priority in search", "Verified badge", "Story highlights", "Ad-free experience"],
  },
  {
    id: "business",
    name: "Business",
    price: 1499,
    period: "/month",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
    features: ["Everything in Premium", "API access", "Team collaboration", "Custom branding", "Dedicated support", "Promoted posts"],
  },
];

let razorpayScriptPromise = null;

const isValidRazorpayKey = (key) => /^rzp_(test|live)_[A-Za-z0-9]+$/.test(String(key || ""));
const isValidRazorpayOrderId = (orderId) => /^order_[A-Za-z0-9]+$/.test(String(orderId || ""));

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-razorpay-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.razorpaySdk = "true";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

export default function Payments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("plans");
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  const pollPaymentUpdate = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      try {
        await fetchData();
        return;
      } catch {
        // Keep polling briefly; webhook processing can lag behind checkout success.
      }
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth/login");
      return;
    }
    void fetchData();
  }, [navigate, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sub, hist] = await Promise.all([
        api.payments.getSubscriptionStatus().catch(() => null),
        api.payments.getHistory(0, 20).catch(() => null),
      ]);
      setSubscription(sub);
      setHistory(hist?.content || (Array.isArray(hist) ? hist : []));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!user || plan.id === "free") return;
    setPurchasing(plan.id);
    let checkoutOpened = false;
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay checkout.");
      }

      const order = await api.payments.createOrder({
        amount: plan.price * 100,
        currency: "INR",
        paymentType: "SUBSCRIPTION",
        description: `${plan.name} Plan - Monthly`,
      });

      if (!order?.razorpayKeyId || !order?.razorpayOrderId) {
        throw new Error("Payment service did not return Razorpay checkout details.");
      }

      if (!isValidRazorpayKey(order.razorpayKeyId)) {
        throw new Error("Razorpay key is not configured correctly. Check RAZORPAY_KEY_ID in payment-service.");
      }

      if (!isValidRazorpayOrderId(order.razorpayOrderId)) {
        throw new Error("Payment service returned an invalid Razorpay order ID.");
      }

      const checkoutAmount = Number(order.amount ?? plan.price * 100);
      if (!Number.isFinite(checkoutAmount) || checkoutAmount <= 0) {
        throw new Error("Payment service returned an invalid checkout amount.");
      }

      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: checkoutAmount,
        currency: order.currency || "INR",
        name: "ConnectSphere",
        description: order.description || `${plan.name} Plan - Monthly`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: user.fullName || user.username || "",
          email: user.email || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setPurchasing(null);
            toast.message("Payment checkout closed.");
          },
        },
        handler: async (response) => {
          try {
            await api.payments.verifyPayment({
              razorpayOrderId: response?.razorpay_order_id || order?.razorpayOrderId,
              razorpayPaymentId: response?.razorpay_payment_id,
              razorpaySignature: response?.razorpay_signature,
            });
            await fetchData();
            toast.success("Payment completed successfully.");
          } catch (verificationError) {
            toast.message("Payment received. Waiting for confirmation...");
            await pollPaymentUpdate();
            await fetchData().catch(() => null);
            if (!response?.razorpay_payment_id) {
              throw verificationError;
            }
          } finally {
            setPurchasing(null);
          }
        },
      });

      razorpay.on("payment.failed", (response) => {
        const description =
          response?.error?.description ||
          response?.error?.reason ||
          "Razorpay reported a payment failure.";
        setPurchasing(null);
        toast.error(description);
      });

      checkoutOpened = true;
      razorpay.open();
    } catch (error) {
      setPurchasing(null);
      toast.error(error?.message || "Payment failed");
      await fetchData().catch(() => null);
    } finally {
      if (!checkoutOpened) {
        setPurchasing(null);
      }
    }
  };

  const currentPlanId = inferPlanId(subscription, history);
  const currentPlan = PLANS.find((plan) => plan.id === currentPlanId) || PLANS[0];

  return (
    <>
      <Header />
      <main className="app-shell-muted">
        <div className="app-page max-w-6xl">
          <div className="flex items-center gap-4 mb-6">
            <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white border border-transparent hover:border-border transition-all">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><CreditCard className="w-7 h-7 text-primary" /> Payments</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription and billing</p>
            </div>
          </div>

          {subscription?.active && (
            <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-5 sm:p-6 text-white mb-8 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <BadgeCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">{currentPlan.name} Plan</div>
                    <div className="text-white/80 text-sm">
                      {subscription.renewalDue
                        ? `Renews ${new Date(subscription.renewalDue).toLocaleDateString()}`
                        : subscription.subscribedAt
                          ? `Started ${new Date(subscription.subscribedAt).toLocaleDateString()}`
                          : "Active"}
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  ACTIVE
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-6">
            {[{ id: "plans", label: "Plans", icon: Sparkles }, { id: "history", label: "Payment History", icon: Receipt }].map((section) => (
              <Button key={section.id} variant={tab === section.id ? "default" : "outline"} size="sm" className="rounded-full gap-2" onClick={() => setTab(section.id)}>
                <section.icon className="w-4 h-4" />{section.label}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : tab === "plans" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {PLANS.map((plan) => (
                <div key={plan.id} className={`relative bg-white rounded-2xl border ${plan.popular ? "border-primary shadow-xl shadow-primary/10 scale-[1.02]" : "border-border shadow-sm"} p-6 flex flex-col transition-all hover:shadow-lg`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                      Most Popular
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                    <plan.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold">{plan.price === 0 ? "Free" : `₹${plan.price}`}</span>
                    {plan.price > 0 && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />{feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={purchasing === plan.id || currentPlan.id === plan.id}
                    className={`w-full rounded-xl h-11 ${plan.popular ? "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {purchasing === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : currentPlan.id === plan.id ? "Current Plan" : plan.price === 0 ? "Get Started" : "Subscribe"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              {history.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">No payments yet</h3>
                  <p className="text-muted-foreground text-sm">Your payment history will appear here once you subscribe.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left">
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Description</th>
                        <th className="px-4 py-3 font-semibold">Amount</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((payment, index) => (
                        <tr key={payment.paymentId || payment.id || index} className="border-b border-border hover:bg-muted/20 transition">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {new Date(payment.createdAt || payment.paymentDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">{payment.description || payment.paymentType || "Payment"}</td>
                          <td className="px-4 py-3 font-semibold">{formatInrAmount(payment.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${payment.status === "SUCCESS" || payment.status === "COMPLETED" ? "bg-green-100 text-green-700" : payment.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {payment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
