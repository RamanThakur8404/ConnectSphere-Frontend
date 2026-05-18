import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Shield, Users, Flag, AlertTriangle, CheckCircle, Clock,
  Loader2, TrendingUp, XCircle, BarChart3, Activity,
  UserPlus, UserCheck, UserX, Search, Mail, AtSign, Bell, Send, Receipt, Trash2,
  RefreshCw, Filter, FileSearch, ExternalLink,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { isAdminRole } from "@/lib/auth-utils";
import { formatInrAmount } from "@/lib/service-helpers";

const CHART_COLORS = ["#0f8aa5", "#1fb5a6", "#f46d43", "#f59e0b", "#ef4444"];
const NOTIFICATION_TYPES = ["POST", "COMMENT", "LIKE", "FOLLOW", "REPLY", "MENTION", "BROADCAST", "REPORT_ACTION"];
const TARGET_TYPES = ["POST", "COMMENT", "USER", "MESSAGE"];
const TARGET_OPTIONS_BY_TYPE = {
  POST: ["POST"],
  COMMENT: ["COMMENT"],
  LIKE: ["POST"],
  FOLLOW: ["USER"],
  REPLY: ["COMMENT"],
  MENTION: ["POST", "COMMENT", "USER"],
  MESSAGE: ["MESSAGE"],
  BROADCAST: [],
  REPORT_ACTION: ["POST", "COMMENT", "USER"],
};
const REPORT_STATUS_FILTERS = ["ALL", "PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];

const getListFromResponse = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.content)) return value.data.content;
  if (Array.isArray(value?.data?.data)) return value.data.data;
  return [];
};

const getTotalFromPage = (value, fallbackList = []) => (
  Number(value?.totalElements ?? value?.total ?? value?.data?.totalElements ?? value?.data?.total ?? fallbackList.length ?? 0)
);

const getErrorMessage = (error) => error?.message || "Service unavailable";
const isRuleBasedAnalysis = (report) => String(report?.aiAnalysis || "").toLowerCase().includes("rule-based");
const isGeminiAnalysis = (report) => String(report?.aiAnalysis || "").toLowerCase().includes("gemini analysis");
const moderationAnalysisLabel = (report) => {
  if (isRuleBasedAnalysis(report)) return "Rule-Based Analysis";
  if (isGeminiAnalysis(report)) return "Gemini Analysis";
  return "AI Analysis";
};
const parseRecipientIds = (value) => Array.from(new Set(
  String(value || "")
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
));

const getActiveUserIds = (users) => Array.from(new Set(
  (users || [])
    .filter((item) => item.active !== false)
    .map((item) => Number(item.userId || item.id))
    .filter((id) => Number.isInteger(id) && id > 0)
));
const getTargetOptionsForType = (type) => TARGET_OPTIONS_BY_TYPE[type] ?? TARGET_TYPES;
const findUserById = (users, userId) => {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return (users || []).find((item) => Number(item.userId || item.id) === id) || null;
};

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { adminTab } = useParams();
  const tab = adminTab || "overview";
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [reports, setReports] = useState([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportStats, setReportStats] = useState(null);
  const [adminHealth, setAdminHealth] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminDataErrors, setAdminDataErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", fullName: "" });
  const [newUserRole, setNewUserRole] = useState("MODERATOR");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [notificationForm, setNotificationForm] = useState({
    recipientId: "",
    actorId: "",
    type: "BROADCAST",
    message: "",
    targetId: "",
    targetType: "",
    deepLinkUrl: "",
  });
  const [bulkForm, setBulkForm] = useState({ audience: "ALL", recipientIds: "", actorId: "", type: "BROADCAST", message: "" });
  const [emailForm, setEmailForm] = useState({ toEmail: "", subject: "", body: "" });
  const [sendingNotification, setSendingNotification] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [refundForm, setRefundForm] = useState({ paymentId: "", refundAmount: "", refundNote: "" });
  const [issuingRefund, setIssuingRefund] = useState(false);
  const [approvingPaymentId, setApprovingPaymentId] = useState(null);
  const [cancelingPaymentId, setCancelingPaymentId] = useState(null);
  const refundFormRef = useRef(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
  const [reportPage, setReportPage] = useState(0);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportLoading, setSelectedReportLoading] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(0);
  const [auditFilterMode, setAuditFilterMode] = useState("all");
  const [auditFilterInput, setAuditFilterInput] = useState("");
  const [auditAppliedFilter, setAuditAppliedFilter] = useState("");
  const loggedDashboardViewRef = useRef(false);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const adminPageSize = 20;

  const logAdminAction = async ({ action, details, targetType, targetId = null, status = "SUCCESS" }) => {
    try {
      await api.admin.createAuditLog({
        action,
        details,
        targetType,
        targetId,
        status,
      });
    } catch {
      // Audit logging should never block the admin operation itself.
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth/login", { replace: true, state: { from: location.pathname } });
      return;
    }
    if (!isAdminRole(user.role)) {
      navigate("/feed", { replace: true });
      return;
    }

    let ignore = false;

    const loadAdminData = async () => {
      setLoading(true);
      const errors = [];

      const [statsResult, summaryResult, notificationsResult, healthResult] = await Promise.allSettled([
        api.reports.getStats(),
        api.payments.getAdminSummary(),
        api.notifications.getAll(),
        api.admin.health(),
      ]);

      if (ignore) return;

      if (statsResult.status === "fulfilled") {
        setReportStats(statsResult.value);
      } else {
        setReportStats(null);
        errors.push(`Reports: ${getErrorMessage(statsResult.reason)}`);
      }

      if (summaryResult.status === "fulfilled") {
        setPaymentSummary(summaryResult.value);
      } else {
        setPaymentSummary(null);
        errors.push(`Payments: ${getErrorMessage(summaryResult.reason)}`);
      }

      if (notificationsResult.status === "fulfilled") {
        setAdminNotifications(getListFromResponse(notificationsResult.value));
      } else {
        setAdminNotifications([]);
        errors.push(`Notifications: ${getErrorMessage(notificationsResult.reason)}`);
      }

      if (healthResult.status === "fulfilled") {
        setAdminHealth(healthResult.value);
      } else {
        setAdminHealth(null);
        errors.push(`Admin health: ${getErrorMessage(healthResult.reason)}`);
      }

      setAdminDataErrors(errors);
      setNotificationForm((currentForm) => ({ ...currentForm, actorId: String(user.id || currentForm.actorId || "") }));
      setBulkForm((currentForm) => ({ ...currentForm, actorId: String(user.id || currentForm.actorId || "") }));
      if (errors.length > 0) toast.error("Some admin data could not be loaded", { id: "admin-data-load-error" });
      setLoading(false);
    };

    void loadAdminData();

    return () => {
      ignore = true;
    };
  }, [authLoading, location.pathname, navigate, reloadKey, user]);

  useEffect(() => {
    if (!user || !isAdminRole(user.role) || loggedDashboardViewRef.current) return;
    loggedDashboardViewRef.current = true;
    void logAdminAction({
      action: "DASHBOARD_VIEWED",
      details: "Admin opened the dashboard",
      targetType: "DASHBOARD",
      targetId: null,
    }).finally(() => fetchAgain());
  }, [user]);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;

    let ignore = false;

    const loadReports = async () => {
      setReportsLoading(true);
      try {
        const queuePage = await api.reports.getQueue(reportStatusFilter === "ALL" ? null : reportStatusFilter, reportPage, adminPageSize);
        if (ignore) return;
        const nextReports = getListFromResponse(queuePage);
        setReports(nextReports);
        setReportsTotal(getTotalFromPage(queuePage, nextReports));
        if (nextReports.length === 0) {
          setSelectedReport(null);
        }
        setSelectedReportId((currentReportId) => {
          const hasCurrent = nextReports.some((report) => (report.reportId || report.id) === currentReportId);
          if (hasCurrent) return currentReportId;
          return nextReports[0]?.reportId || nextReports[0]?.id || null;
        });
      } catch {
        if (!ignore) {
          setReports([]);
          setReportsTotal(0);
        }
      } finally {
        if (!ignore) {
          setReportsLoading(false);
        }
      }
    };

    void loadReports();

    return () => {
      ignore = true;
    };
  }, [adminPageSize, reportPage, reportStatusFilter, reloadKey, user]);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;

    let ignore = false;

    const loadAuditLogs = async () => {
      setAuditLoading(true);
      try {
        let page;
        if (auditFilterMode === "admin" && auditAppliedFilter) {
          page = await api.admin.getAuditLogsByAdmin(auditAppliedFilter, auditPage, adminPageSize);
        } else if (auditFilterMode === "target" && auditAppliedFilter) {
          page = await api.admin.getAuditLogsByTargetType(auditAppliedFilter.toUpperCase(), auditPage, adminPageSize);
        } else if (auditFilterMode === "action" && auditAppliedFilter) {
          page = await api.admin.getAuditLogsByAction(auditAppliedFilter, auditPage, adminPageSize);
        } else {
          page = await api.admin.getAuditLogs(auditPage, adminPageSize);
        }

        if (!ignore) {
          const nextAuditLogs = getListFromResponse(page);
          setAuditLogs(nextAuditLogs);
          setAuditTotal(getTotalFromPage(page, nextAuditLogs));
        }
      } catch {
        if (!ignore) {
          setAuditLogs([]);
          setAuditTotal(0);
        }
      } finally {
        if (!ignore) {
          setAuditLoading(false);
        }
      }
    };

    void loadAuditLogs();

    return () => {
      ignore = true;
    };
  }, [adminPageSize, auditAppliedFilter, auditFilterMode, auditPage, reloadKey, user]);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;

    let ignore = false;

    const loadPayments = async () => {
      setPaymentsLoading(true);
      try {
        const page = await api.payments.getAllPayments(paymentsPage, adminPageSize);
        if (!ignore) {
          const nextPayments = getListFromResponse(page);
          setPayments(nextPayments);
          setPaymentsTotal(getTotalFromPage(page, nextPayments));
        }
      } catch {
        if (!ignore) {
          setPayments([]);
          setPaymentsTotal(0);
        }
      } finally {
        if (!ignore) {
          setPaymentsLoading(false);
        }
      }
    };

    void loadPayments();

    return () => {
      ignore = true;
    };
  }, [adminPageSize, paymentsPage, reloadKey, user]);

  useEffect(() => {
    if (!user || !isAdminRole(user.role)) return;

    let ignore = false;

    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const users = await api.auth.getAllUsers();
        if (!ignore) {
          setAllUsers(Array.isArray(users) ? users : []);
        }
      } catch {
        if (!ignore) {
          setAllUsers([]);
        }
      } finally {
        if (!ignore) {
          setUsersLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      ignore = true;
    };
  }, [reloadKey, user]);

  useEffect(() => {
    if (!selectedReportId || !user || !isAdminRole(user.role)) {
      return;
    }

    let ignore = false;

    const loadSelectedReport = async () => {
      setSelectedReportLoading(true);
      try {
        const report = await api.reports.getReportById(selectedReportId);
        if (!ignore) {
          setSelectedReport(report);
          setResolutionNote(report?.resolutionNote || "");
        }
      } catch {
        if (!ignore) {
          setSelectedReport(null);
          setResolutionNote("");
        }
      } finally {
        if (!ignore) {
          setSelectedReportLoading(false);
        }
      }
    };

    void loadSelectedReport();

    return () => {
      ignore = true;
    };
  }, [reloadKey, selectedReportId, user]);

  const fetchAgain = () => setReloadKey((currentKey) => currentKey + 1);

  const applyAuditFilter = () => {
    if (auditFilterMode === "all") {
      setAuditFilterInput("");
      setAuditAppliedFilter("");
      setAuditPage(0);
      return;
    }

    const trimmedValue = auditFilterInput.trim();
    if (!trimmedValue) {
      toast.error("Enter a filter value first");
      return;
    }

    setAuditPage(0);
    setAuditAppliedFilter(trimmedValue);
  };

  const resetAuditFilter = () => {
    setAuditFilterMode("all");
    setAuditFilterInput("");
    setAuditAppliedFilter("");
    setAuditPage(0);
  };

  const openSelectedReportTarget = () => {
    if (!selectedReport?.targetId) return;
    const targetType = String(selectedReport.targetType || "").toUpperCase();

    if (targetType === "POST") {
      navigate(`/posts/${selectedReport.targetId}`);
      return;
    }

    if (targetType === "USER") {
      navigate(`/users/${selectedReport.targetId}`);
    }
  };

  const handleResolve = async (reportId, note = resolutionNote) => {
    if (!user) return;
    const finalNote = note.trim() || "Content reviewed and action taken";
    setReportActionLoading(true);
    try {
      await api.reports.resolveReport(reportId, { resolutionNote: finalNote }, user.id);
      await logAdminAction({
        action: "REPORT_RESOLVED",
        details: finalNote,
        targetType: "REPORT",
        targetId: Number(reportId),
      });
      toast.success("Report resolved");
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to resolve report");
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleDismiss = async (reportId) => {
    if (!user) return;
    setReportActionLoading(true);
    try {
      await api.reports.dismissReport(reportId, user.id);
      await logAdminAction({
        action: "REPORT_DISMISSED",
        details: "Report dismissed by admin",
        targetType: "REPORT",
        targetId: Number(reportId),
      });
      toast.success("Report dismissed");
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to dismiss report");
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleMarkUnderReview = async (reportId) => {
    if (!user) return;
    setReportActionLoading(true);
    try {
      await api.reports.markUnderReview(reportId, user.id);
      await logAdminAction({
        action: "REPORT_UNDER_REVIEW",
        details: "Report marked under review",
        targetType: "REPORT",
        targetId: Number(reportId),
      });
      toast.success("Report marked under review");
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to mark report under review");
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleRetryAiAnalysis = async (reportId) => {
    if (!user) return;
    setReportActionLoading(true);
    try {
      const updatedReport = await api.reports.retryAiAnalysis(reportId, user.id);
      setSelectedReport(updatedReport);
      toast.success("Moderation analysis queued");
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to retry moderation analysis");
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleSearchUsers = async (event) => {
    event?.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearchedUsers(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await api.auth.searchUsers(searchQuery);
      setSearchResults(Array.isArray(results) ? results : []);
      setHasSearchedUsers(true);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDeactivateUser = async (userId) => {
    try {
      await api.auth.deactivateUser(userId);
      await logAdminAction({
        action: "USER_DEACTIVATED",
        details: `User #${userId} deactivated`,
        targetType: "USER",
        targetId: Number(userId),
      });
      toast.success(`User #${userId} deactivated`);
      if (searchQuery) void handleSearchUsers();
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to deactivate user");
    }
  };

  const handleActivateUser = async (userId) => {
    try {
      await api.auth.activateUser(userId);
      await logAdminAction({
        action: "USER_ACTIVATED",
        details: `User #${userId} activated`,
        targetType: "USER",
        targetId: Number(userId),
      });
      toast.success(`User #${userId} activated`);
      if (searchQuery) void handleSearchUsers();
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to activate user");
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setCreatingUser(true);
    try {
      await api.auth.createPrivilegedUser(newUser, newUserRole);
      await logAdminAction({
        action: "PRIVILEGED_USER_CREATED",
        details: `${newUserRole} account created for ${newUser.email}`,
        targetType: "USER",
        targetId: null,
      });
      toast.success(`${newUserRole} user created`);
      setNewUser({ username: "", email: "", password: "", fullName: "" });
      setShowCreateForm(false);
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateNotification = async (event) => {
    event.preventDefault();
    setSendingNotification(true);
    try {
      const targetType = notificationTargetOptions.includes(notificationForm.targetType)
        ? notificationForm.targetType
        : "";
      const targetId = notificationForm.targetId ? Number(notificationForm.targetId) : null;

      await api.notifications.create({
        recipientId: Number(notificationForm.recipientId),
        actorId: Number(notificationForm.actorId || user?.id),
        type: notificationForm.type,
        message: notificationForm.message,
        targetId: targetType && targetId ? targetId : null,
        targetType: targetType || null,
        deepLinkUrl: notificationForm.deepLinkUrl || null,
      });
      await logAdminAction({
        action: "NOTIFICATION_CREATED",
        details: notificationForm.message,
        targetType: "NOTIFICATION",
        targetId: notificationForm.recipientId ? Number(notificationForm.recipientId) : null,
      });
      toast.success("Notification created");
      setNotificationForm((currentForm) => ({
        ...currentForm,
        recipientId: "",
        message: "",
        targetId: "",
        deepLinkUrl: "",
      }));
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to create notification");
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSendBulk = async (event) => {
    event.preventDefault();
    setSendingBulk(true);
    try {
      const recipientIds = bulkForm.audience === "ALL"
        ? getActiveUserIds(allUsers)
        : parseRecipientIds(bulkForm.recipientIds);

      if (!recipientIds.length) {
        toast.error(bulkForm.audience === "ALL"
          ? "No active users are loaded for broadcast"
          : "Enter at least one valid recipient ID");
        return;
      }

      await api.notifications.sendBulk({
        recipientIds,
        actorId: Number(bulkForm.actorId || user?.id),
        type: bulkForm.type,
        message: bulkForm.message,
      });
      await logAdminAction({
        action: "BULK_NOTIFICATION_SENT",
        details: `Sent to ${recipientIds.length} recipient(s): ${bulkForm.message}`,
        targetType: "NOTIFICATION",
        targetId: null,
      });
      toast.success("Bulk notifications sent");
      setBulkForm((currentForm) => ({ ...currentForm, recipientIds: "", message: "" }));
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to send bulk notifications");
    } finally {
      setSendingBulk(false);
    }
  };

  const handleSendEmail = async (event) => {
    event.preventDefault();
    setSendingEmail(true);
    try {
      await api.notifications.sendEmailAlert(emailForm);
      await logAdminAction({
        action: "EMAIL_ALERT_SENT",
        details: `Email alert sent to ${emailForm.toEmail}: ${emailForm.subject}`,
        targetType: "EMAIL",
        targetId: null,
      });
      toast.success("Email alert sent");
      setEmailForm({ toEmail: "", subject: "", body: "" });
    } catch (error) {
      toast.error(error?.message || "Failed to send email alert");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleIssueRefund = async (event) => {
    event.preventDefault();
    const paymentId = Number(refundForm.paymentId);
    const refundAmount = Number(refundForm.refundAmount || 0);

    if (!paymentId || refundAmount <= 0) {
      toast.error("Enter a valid payment ID and refund amount");
      return;
    }

    setIssuingRefund(true);
    try {
      await api.payments.refund(paymentId, {
        refundAmount: Math.round(refundAmount * 100),
        refundNote: refundForm.refundNote,
      });
      await logAdminAction({
        action: "PAYMENT_REFUNDED",
        details: refundForm.refundNote,
        targetType: "PAYMENT",
        targetId: paymentId,
      });
      toast.success("Refund processed successfully");
      setRefundForm({ paymentId: "", refundAmount: "", refundNote: "" });
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to issue refund");
    } finally {
      setIssuingRefund(false);
    }
  };

  const prefillRefundForm = (payment) => {
    const amount = Number(payment.amount || 0);
    const amountInInr = amount / 100;
    setRefundForm({
      paymentId: String(payment.paymentId || ""),
      refundAmount: String(amountInInr.toFixed(2)),
      refundNote: `Refund for payment #${payment.paymentId || ""}`.trim(),
    });
    toast.info("Refund form filled. Review the amount before submitting.");
    setTimeout(() => refundFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const handleApprovePayment = async (payment) => {
    const paymentId = payment?.paymentId;
    if (!paymentId) return;

    const confirmed = window.confirm(`Approve payment #${paymentId} and mark it as SUCCESS?`);
    if (!confirmed) return;

    setApprovingPaymentId(paymentId);
    try {
      await api.payments.approvePayment(paymentId);
      await logAdminAction({
        action: "PAYMENT_APPROVED",
        details: `Payment #${paymentId} approved`,
        targetType: "PAYMENT",
        targetId: Number(paymentId),
      });
      toast.success("Payment approved successfully");
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to approve payment");
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const handleCancelPayment = async (payment) => {
    const paymentId = payment?.paymentId;
    if (!paymentId) return;

    const confirmed = window.confirm(`Cancel payment #${paymentId}? This removes it from the pending approval flow.`);
    if (!confirmed) return;

    setCancelingPaymentId(paymentId);
    try {
      await api.payments.cancelPayment(paymentId);
      await logAdminAction({
        action: "PAYMENT_CANCELLED",
        details: `Payment #${paymentId} cancelled`,
        targetType: "PAYMENT",
        targetId: Number(paymentId),
      });
      toast.success("Payment cancelled successfully");
      fetchAgain();
    } catch (error) {
      toast.error(error?.message || "Failed to cancel payment");
    } finally {
      setCancelingPaymentId(null);
    }
  };

  const handleDeleteAdminNotification = async (notificationId) => {
    try {
      await api.notifications.adminDelete(notificationId);
      await logAdminAction({
        action: "NOTIFICATION_DELETED",
        details: `Notification #${notificationId} deleted`,
        targetType: "NOTIFICATION",
        targetId: Number(notificationId),
      });
      toast.success("Notification deleted");
      setAdminNotifications((currentNotifications) => currentNotifications.filter((notification) => (notification.notificationId || notification.id) !== notificationId));
    } catch (error) {
      toast.error(error?.message || "Failed to delete notification");
    }
  };

  const statCards = [
    { label: "Pending Reports", value: reportStats?.pendingCount ?? reports.filter((report) => report.status === "PENDING").length, icon: Flag, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Audit Logs", value: auditTotal, icon: Activity, color: "text-primary", bg: "bg-primary/10" },
    { label: "Net Revenue", value: paymentSummary ? formatInrAmount(paymentSummary.netRevenue) : "-", icon: Receipt, color: "text-green-600", bg: "bg-green-50" },
    { label: "Active Subs", value: paymentSummary?.activeSubscriptions ?? 0, icon: CheckCircle, color: "text-secondary", bg: "bg-secondary/10" },
  ];

  // Tabs are now driven by the sidebar in AdminLayout via URL

  const reportChartData = reportStats ? [
    { name: "Pending", value: reportStats.pendingCount || reportStats.pending || 0 },
    { name: "Resolved", value: reportStats.resolvedCount || reportStats.resolved || 0 },
    { name: "Dismissed", value: reportStats.dismissedCount || reportStats.dismissed || 0 },
  ].filter((item) => item.value > 0) : [];

  const activityData = auditLogs.slice(0, 7).map((log, index) => ({
    name: new Date(log.createdAt || log.timestamp).toLocaleDateString("en", { weekday: "short" }),
    actions: index + 1,
  }));

  const displayedUsers = hasSearchedUsers ? searchResults : allUsers;
  const activeUserIds = getActiveUserIds(allUsers);
  const specificRecipientIds = parseRecipientIds(bulkForm.recipientIds);
  const bulkRecipientCount = bulkForm.audience === "ALL" ? activeUserIds.length : specificRecipientIds.length;
  const selectedNotificationRecipient = findUserById(allUsers, notificationForm.recipientId);
  const notificationTargetOptions = getTargetOptionsForType(notificationForm.type);
  const getPaymentStatusClass = (status) => {
    if (status === "SUCCESS") return "bg-green-100 text-green-700";
    if (status === "FAILED") return "bg-red-100 text-red-700";
    if (status === "REFUNDED") return "bg-amber-100 text-amber-700";
    if (status === "PENDING") return "bg-blue-100 text-blue-700";
    if (status === "CANCELLED") return "bg-slate-100 text-slate-700";
    return "bg-muted text-muted-foreground";
  };

  if (authLoading || loading) {
    return (
      <AdminLayout activeTab={tab}>
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab={tab}>
      <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Shield className="w-7 h-7 text-primary" /> {tab === "overview" ? "Dashboard" : tab === "reports" ? "Reports & Moderation" : tab === "audit" ? "Audit Logs" : tab === "users" ? "User Management" : tab === "notifications" ? "Notifications" : "Payments"}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Full platform control — manage users, reports, notifications, and payments</p>
            </div>
          </div>

          {adminDataErrors.length > 0 && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <div className="font-semibold">Some database-backed admin data could not be loaded.</div>
                  <div className="mt-1 text-amber-800">
                    {adminDataErrors.join(" | ")}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="ml-auto rounded-full bg-white" onClick={fetchAgain}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {tab === "overview" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">{card.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{card.label}</div>
              </div>
            ))}
          </div>
          )}

          {tab === "overview" && adminHealth && (
            <div className="bg-white rounded-2xl p-5 border border-border shadow-sm mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Admin Service Health
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {adminHealth.service || "admin-service"} is reporting {adminHealth.status || "UP"}.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  {adminHealth.status || "UP"}
                </span>
              </div>
            </div>
          )}

          {tab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Recent Activity</h3>
                <div className="h-64">
                  {activityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="actions" fill="#0f8aa5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No activity data</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Flag className="w-5 h-5 text-amber-500" /> Report Distribution</h3>
                {reportChartData.length > 0 ? (
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={reportChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {reportChartData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No report data available</div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-green-600" /> Payment Snapshot</h3>
                {paymentSummary ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Total revenue</span><span className="font-semibold">{formatInrAmount(paymentSummary.totalRevenue)}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Refunded</span><span className="font-semibold">{formatInrAmount(paymentSummary.totalRefunded)}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Transactions</span><span className="font-semibold">{paymentSummary.totalTransactions}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Successful</span><span className="font-semibold text-green-600">{paymentSummary.successfulTransactions}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Failed</span><span className="font-semibold text-red-600">{paymentSummary.failedTransactions}</span></div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">Payment summary unavailable</div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-secondary" /> Latest Notifications</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {adminNotifications.slice(0, 8).map((notification) => (
                    <div key={notification.notificationId || notification.id} className="p-3 rounded-xl bg-muted/30">
                      <div className="text-sm font-medium">{notification.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">{notification.type} · {new Date(notification.createdAt || notification.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                  {adminNotifications.length === 0 && <div className="text-center text-muted-foreground py-8">No notifications found</div>}
                </div>
              </div>
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-4 border border-border shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {REPORT_STATUS_FILTERS.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant={reportStatusFilter === status ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          setReportPage(0);
                          setReportStatusFilter(status);
                        }}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Showing {reports.length} of {reportsTotal} database report{reportsTotal === 1 ? "" : "s"}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-full gap-2" onClick={fetchAgain}>
                  <RefreshCw className="w-4 h-4" />
                  Refresh queue
                </Button>
              </div>

              {reportsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : reports.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl text-center border border-border shadow-sm">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
                  <h3 className="font-bold text-lg mb-2">All clear</h3>
                  <p className="text-muted-foreground text-sm">
                    No {reportStatusFilter === "ALL" ? "" : reportStatusFilter.toLowerCase()} reports to review.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Real reports appear here after a user opens a post menu and submits Report post.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="rounded-full gap-2 mt-5" onClick={() => navigate("/feed")}>
                    <ExternalLink className="w-4 h-4" />
                    Open feed
                  </Button>
                </div>
              ) : reports.map((report) => {
                const reportId = report.reportId || report.id;
                return (
                  <div
                    key={reportId}
                    onClick={() => setSelectedReportId(reportId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedReportId(reportId);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left bg-white rounded-2xl p-4 sm:p-6 border shadow-sm transition ${
                      reportId === selectedReportId ? "border-primary ring-2 ring-primary/10 shadow-primary/10" : "border-border hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
                        <div>
                          <div className="font-semibold text-sm">{report.reason || "Report"}</div>
                          <div className="text-xs text-muted-foreground">Target: {report.targetType} #{report.targetId} · Reporter: #{report.reporterId || report.userId}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${report.status === "PENDING" ? "bg-amber-100 text-amber-700" : report.status === "UNDER_REVIEW" ? "bg-blue-100 text-blue-700" : report.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{report.status}</span>
                    </div>
                    {report.description && <p className="text-sm text-muted-foreground mb-4">{report.description}</p>}
                    <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {moderationAnalysisLabel(report)}
                        </div>
                        <div className="flex items-center gap-2">
                          {report.aiSeverityScore ? (
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                              report.aiSeverityScore >= 8
                                ? "bg-red-100 text-red-700"
                                : report.aiSeverityScore >= 5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              Severity {report.aiSeverityScore}/10
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              Pending
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={reportActionLoading}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRetryAiAnalysis(reportId);
                            }}
                            className="w-7 h-7 rounded-full border border-border bg-white hover:bg-muted flex items-center justify-center disabled:opacity-60"
                            title="Retry moderation analysis"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground">
                        {report.aiAnalysis || "Moderation analysis has not completed yet for this report."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span>
                      {(report.status === "PENDING" || report.status === "UNDER_REVIEW") && (
                        <div className="flex gap-2">
                          {report.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={reportActionLoading}
                              className="rounded-full gap-1.5 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMarkUnderReview(reportId);
                              }}
                            >
                              <Clock className="w-3.5 h-3.5" /> Review
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reportActionLoading}
                            className="rounded-full gap-1.5 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDismiss(reportId);
                            }}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Dismiss
                          </Button>
                          <Button
                            size="sm"
                            disabled={reportActionLoading}
                            className="rounded-full gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolve(reportId, "Content reviewed and action taken");
                            }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {!reportsLoading && reportsTotal > adminPageSize && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={reportPage === 0}
                    onClick={() => setReportPage((currentPage) => Math.max(0, currentPage - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {reportPage + 1} of {Math.max(1, Math.ceil(reportsTotal / adminPageSize))}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={(reportPage + 1) * adminPageSize >= reportsTotal}
                    onClick={() => setReportPage((currentPage) => currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <FileSearch className="w-5 h-5 text-primary" />
                    Report Details
                  </h3>
                  {selectedReportId && (
                    <Button type="button" variant="outline" size="sm" className="rounded-full gap-2" onClick={fetchAgain}>
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </Button>
                  )}
                </div>

                {selectedReportLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : !selectedReport ? (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    Select a report to inspect the full moderation payload.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">{selectedReport.reason || "Report"}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Report #{selectedReport.reportId || selectedReport.id} / reporter #{selectedReport.reporterId || selectedReport.userId}
                          </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${selectedReport.status === "PENDING" ? "bg-amber-100 text-amber-700" : selectedReport.status === "UNDER_REVIEW" ? "bg-blue-100 text-blue-700" : selectedReport.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {selectedReport.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Target</div>
                        <div className="font-medium">{selectedReport.targetType} #{selectedReport.targetId}</div>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Created</div>
                        <div className="font-medium">{new Date(selectedReport.createdAt).toLocaleString()}</div>
                      </div>
                    </div>

                    {selectedReport.description && (
                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reporter Notes</div>
                        <p className="text-sm leading-relaxed">{selectedReport.description}</p>
                      </div>
                    )}

                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {moderationAnalysisLabel(selectedReport)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                            selectedReport.aiSeverityScore >= 8
                              ? "bg-red-100 text-red-700"
                              : selectedReport.aiSeverityScore >= 5
                              ? "bg-amber-100 text-amber-700"
                              : selectedReport.aiSeverityScore
                              ? "bg-green-100 text-green-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {selectedReport.aiSeverityScore ? `Severity ${selectedReport.aiSeverityScore}/10` : "Pending"}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={reportActionLoading}
                            className="rounded-full gap-1.5 text-xs"
                            onClick={() => handleRetryAiAnalysis(selectedReport.reportId || selectedReport.id)}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground">
                        {selectedReport.aiAnalysis || "Moderation analysis has not completed yet for this report."}
                      </p>
                    </div>

                    {(selectedReport.resolutionNote || selectedReport.resolvedAt || selectedReport.resolvedBy) && (
                      <div className="rounded-xl border border-border bg-green-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">Resolution</div>
                        <p className="text-sm leading-relaxed">{selectedReport.resolutionNote || "This report has been reviewed."}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {selectedReport.resolvedBy ? `Resolved by admin #${selectedReport.resolvedBy}` : "Resolved"}
                          {selectedReport.resolvedAt ? ` / ${new Date(selectedReport.resolvedAt).toLocaleString()}` : ""}
                        </div>
                      </div>
                    )}

                    {(selectedReport.status === "PENDING" || selectedReport.status === "UNDER_REVIEW") && (
                      <div className="rounded-xl border border-border bg-white p-4">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                          Resolution Note
                        </label>
                        <textarea
                          value={resolutionNote}
                          onChange={(event) => setResolutionNote(event.target.value)}
                          rows={3}
                          placeholder="Write what was reviewed and what action was taken"
                          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {(selectedReport.targetType === "POST" || selectedReport.targetType === "USER") && (
                        <Button type="button" variant="outline" size="sm" className="rounded-full gap-2" onClick={openSelectedReportTarget}>
                          <ExternalLink className="w-4 h-4" />
                          Open target
                        </Button>
                      )}
                      {(selectedReport.status === "PENDING" || selectedReport.status === "UNDER_REVIEW") && (
                        <>
                          {selectedReport.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={reportActionLoading}
                              className="rounded-full gap-1.5 text-xs"
                              onClick={() => handleMarkUnderReview(selectedReport.reportId || selectedReport.id)}
                            >
                              <Clock className="w-3.5 h-3.5" /> Start Review
                            </Button>
                          )}
                          <Button variant="outline" size="sm" disabled={reportActionLoading} className="rounded-full gap-1.5 text-xs" onClick={() => handleDismiss(selectedReport.reportId || selectedReport.id)}>
                            <XCircle className="w-3.5 h-3.5" /> Dismiss
                          </Button>
                          <Button size="sm" disabled={reportActionLoading} className="rounded-full gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleResolve(selectedReport.reportId || selectedReport.id)}>
                            {reportActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Resolve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Filter Audit Logs</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto_auto] gap-3">
                  <select
                    value={auditFilterMode}
                    onChange={(event) => {
                      const nextMode = event.target.value;
                      setAuditPage(0);
                      setAuditFilterMode(nextMode);
                      if (nextMode === "all") {
                        setAuditFilterInput("");
                        setAuditAppliedFilter("");
                      }
                    }}
                    className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="all">All logs</option>
                    <option value="admin">By admin ID</option>
                    <option value="target">By target type</option>
                    <option value="action">By action</option>
                  </select>
                  <input
                    type="text"
                    value={auditFilterInput}
                    onChange={(event) => setAuditFilterInput(event.target.value)}
                    disabled={auditFilterMode === "all"}
                    placeholder={
                      auditFilterMode === "admin"
                        ? "Enter admin user ID"
                        : auditFilterMode === "target"
                        ? "Enter target type like POST or USER"
                        : auditFilterMode === "action"
                        ? "Enter action name"
                        : "Select a filter type"
                    }
                    className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  />
                  <Button type="button" className="rounded-xl gap-2" onClick={applyAuditFilter}>
                    <Search className="w-4 h-4" />
                    Apply
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={resetAuditFilter}>
                    <RefreshCw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
                {(auditFilterMode !== "all" && auditAppliedFilter) && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Active filter: {auditFilterMode} = {auditAppliedFilter}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                {auditLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-3 font-semibold">Action</th>
                          <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Target</th>
                          <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Admin</th>
                          <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Details</th>
                          <th className="text-left px-4 py-3 font-semibold">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, index) => (
                          <tr key={log.auditId || log.id || index} className="border-b border-border hover:bg-muted/20 transition">
                            <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">{log.action || log.actionType}</span></td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{log.targetType} #{log.targetId}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{log.adminUsername || `#${log.adminUserId || "-"}`}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-xs truncate">{log.description || log.details || "-"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.createdAt || log.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {auditLogs.length === 0 && <div className="text-center text-muted-foreground py-12">No audit logs found</div>}
                    {auditTotal > adminPageSize && (
                      <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={auditPage === 0}
                          onClick={() => setAuditPage((currentPage) => Math.max(0, currentPage - 1))}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Page {auditPage + 1} of {Math.max(1, Math.ceil(auditTotal / adminPageSize))}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={(auditPage + 1) * adminPageSize >= auditTotal}
                          onClick={() => setAuditPage((currentPage) => currentPage + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-primary" /> User Directory</h3>
                <form onSubmit={handleSearchUsers} className="flex gap-3 mb-4">
                  <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by username..." className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  <Button type="submit" disabled={searchLoading} className="rounded-xl gap-2">{searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search</Button>
                  {hasSearchedUsers && (
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setSearchQuery(""); setSearchResults([]); setHasSearchedUsers(false); }}>
                      Show All
                    </Button>
                  )}
                </form>
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                  <span>{hasSearchedUsers ? `Search results for "${searchQuery}"` : "All registered users"}</span>
                  <span>{displayedUsers.length} user{displayedUsers.length === 1 ? "" : "s"}</span>
                </div>
                {(usersLoading && !hasSearchedUsers) || searchLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : displayedUsers.length > 0 ? (
                  <div className="space-y-2">
                    {displayedUsers.map((result) => (
                      <div key={result.userId || result.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(result.fullName || result.username || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{result.fullName || result.username}</div>
                          <div className="text-xs text-muted-foreground">@{result.username} · {result.email}</div>
                          <div className="text-xs mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${result.role === "ADMIN" ? "bg-primary/10 text-primary" : result.role === "MODERATOR" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>{result.role || "USER"}</span>
                            {result.active === false && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">DEACTIVATED</span>}
                          </div>
                        </div>
                        {result.active === false && result.role !== "ADMIN" && (
                          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleActivateUser(result.userId || result.id)}>
                            <UserCheck className="w-3.5 h-3.5" /> Activate
                          </Button>
                        )}
                        {result.active !== false && result.role !== "ADMIN" && (
                          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDeactivateUser(result.userId || result.id)}>
                            <UserX className="w-3.5 h-3.5" /> Deactivate
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    {hasSearchedUsers ? "No users matched your search" : "No users found"}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2"><UserPlus className="w-5 h-5 text-green-600" /> Create Admin/Moderator</h3>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowCreateForm(!showCreateForm)}>{showCreateForm ? "Cancel" : "New User"}</Button>
                </div>
                {showCreateForm && (
                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Full Name</label>
                      <input type="text" value={newUser.fullName} onChange={(event) => setNewUser({ ...newUser, fullName: event.target.value })} required placeholder="Jane Doe" className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Username</label>
                      <div className="relative"><AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><input type="text" value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} required placeholder="janedoe" className="w-full pl-8 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Email</label>
                      <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><input type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required placeholder="jane@example.com" className="w-full pl-8 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Password</label>
                      <input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required minLength={8} placeholder="Min 8 characters" className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Role</label>
                      <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value)} className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" disabled={creatingUser} className="w-full rounded-xl gap-2 bg-green-600 hover:bg-green-700 text-white">{creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create {newUserRole}</Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Create Notification</h3>
                  <form onSubmit={handleCreateNotification} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium mb-1.5">Recipient</label>
                      <input type="number" min="1" list="admin-notification-recipients" value={notificationForm.recipientId} onChange={(event) => setNotificationForm({ ...notificationForm, recipientId: event.target.value })} required placeholder="User ID" className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                      <datalist id="admin-notification-recipients">
                        {allUsers.map((item) => (
                          <option key={item.userId || item.id} value={item.userId || item.id}>
                            {item.fullName || item.username || item.email || `User ${item.userId || item.id}`}
                          </option>
                        ))}
                      </datalist>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {selectedNotificationRecipient
                          ? `${selectedNotificationRecipient.fullName || selectedNotificationRecipient.username || selectedNotificationRecipient.email} #${selectedNotificationRecipient.userId || selectedNotificationRecipient.id}`
                          : "Pick a user ID from the loaded admin user list"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Actor</label>
                      <input type="number" min="1" value={notificationForm.actorId} onChange={(event) => setNotificationForm({ ...notificationForm, actorId: event.target.value })} placeholder={`Defaults to ${user?.id || "current admin"}`} className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Type</label>
                      <select value={notificationForm.type} onChange={(event) => {
                        const nextType = event.target.value;
                        const nextTargets = getTargetOptionsForType(nextType);
                        setNotificationForm({
                          ...notificationForm,
                          type: nextType,
                          targetType: nextTargets.includes(notificationForm.targetType) ? notificationForm.targetType : "",
                          targetId: nextTargets.length ? notificationForm.targetId : "",
                        });
                      }} className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                        {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    {notificationTargetOptions.length > 0 && (
                      <>
                        <div>
                          <label className="block text-xs font-medium mb-1.5">Target</label>
                          <select value={notificationForm.targetType} onChange={(event) => setNotificationForm({ ...notificationForm, targetType: event.target.value })} className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                            <option value="">No target</option>
                            {notificationTargetOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5">Target ID</label>
                          <input type="number" min="1" value={notificationForm.targetId} onChange={(event) => setNotificationForm({ ...notificationForm, targetId: event.target.value })} disabled={!notificationForm.targetType} required={Boolean(notificationForm.targetType)} placeholder={notificationForm.targetType ? `${notificationForm.targetType} ID` : "Select a target first"} className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60" />
                        </div>
                      </>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium mb-1.5">Deep Link</label>
                      <input type="url" value={notificationForm.deepLinkUrl} onChange={(event) => setNotificationForm({ ...notificationForm, deepLinkUrl: event.target.value })} placeholder="Optional URL" className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <textarea value={notificationForm.message} onChange={(event) => setNotificationForm({ ...notificationForm, message: event.target.value })} required placeholder="Notification message" rows={3} className="sm:col-span-2 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                    <Button type="submit" disabled={sendingNotification} className="sm:col-span-2 rounded-xl gap-2">
                      {sendingNotification ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Notification
                    </Button>
                  </form>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-secondary" /> Bulk Notification</h3>
                  <form onSubmit={handleSendBulk} className="grid grid-cols-1 gap-4">
                    <div className="inline-flex rounded-xl bg-muted p-1">
                      {[
                        { value: "ALL", label: "All active users" },
                        { value: "SPECIFIC", label: "Specific users" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={bulkForm.audience === option.value}
                          onClick={() => setBulkForm({ ...bulkForm, audience: option.value })}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                            bulkForm.audience === option.value ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {bulkForm.audience === "SPECIFIC" && (
                      <input
                        type="text"
                        value={bulkForm.recipientIds}
                        onChange={(event) => setBulkForm({ ...bulkForm, recipientIds: event.target.value })}
                        required
                        placeholder="Recipient IDs, comma or space separated"
                        className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {bulkForm.audience === "ALL"
                          ? usersLoading ? "Loading active users..." : `${bulkRecipientCount} active user(s) will receive this`
                          : `${bulkRecipientCount} valid recipient ID(s) detected`}
                      </span>
                      <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                        Sent as #{bulkForm.actorId || user?.id || "admin"}
                      </span>
                    </div>
                    <input type="number" min="1" value={bulkForm.actorId} onChange={(event) => setBulkForm({ ...bulkForm, actorId: event.target.value })} placeholder={`Actor user ID (defaults to ${user?.id || "current admin"})`} className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    <select value={bulkForm.type} onChange={(event) => setBulkForm({ ...bulkForm, type: event.target.value })} className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                      {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <textarea value={bulkForm.message} onChange={(event) => setBulkForm({ ...bulkForm, message: event.target.value })} required placeholder="Broadcast message" rows={3} className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                    <Button type="submit" disabled={sendingBulk || !bulkRecipientCount} className="rounded-xl gap-2 bg-secondary hover:bg-secondary/90 text-white">
                      {sendingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to {bulkRecipientCount || 0}
                    </Button>
                  </form>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Mail className="w-5 h-5 text-green-600" /> Email Alert</h3>
                  <form onSubmit={handleSendEmail} className="grid grid-cols-1 gap-4">
                    <input type="email" value={emailForm.toEmail} onChange={(event) => setEmailForm({ ...emailForm, toEmail: event.target.value })} required placeholder="recipient@example.com" className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    <input type="text" value={emailForm.subject} onChange={(event) => setEmailForm({ ...emailForm, subject: event.target.value })} required placeholder="Subject" className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                    <textarea value={emailForm.body} onChange={(event) => setEmailForm({ ...emailForm, body: event.target.value })} required placeholder="Email body" rows={4} className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                    <Button type="submit" disabled={sendingEmail} className="rounded-xl gap-2 bg-green-600 hover:bg-green-700 text-white">
                      {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send Email
                    </Button>
                  </form>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> All Notifications</h3>
                <div className="space-y-3 max-h-[900px] overflow-y-auto">
                  {adminNotifications.map((notification) => {
                    const notificationId = notification.notificationId || notification.id;
                    return (
                      <div key={notificationId} className="p-4 rounded-xl bg-muted/30 border border-border">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{notification.message}</div>
                            <div className="text-xs text-muted-foreground mt-1">{notification.type} · recipient #{notification.recipientId}</div>
                            <div className="text-xs text-muted-foreground mt-1">{new Date(notification.createdAt || notification.timestamp).toLocaleString()}</div>
                            {notification.deepLinkUrl && <div className="text-xs text-primary mt-1 truncate">{notification.deepLinkUrl}</div>}
                          </div>
                          <button type="button" onClick={() => handleDeleteAdminNotification(notificationId)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {adminNotifications.length === 0 && <div className="text-center text-muted-foreground py-12">No notifications found</div>}
                </div>
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {paymentSummary ? [
                  { label: "Total Revenue", value: formatInrAmount(paymentSummary.totalRevenue), tone: "text-green-600" },
                  { label: "Refunded", value: formatInrAmount(paymentSummary.totalRefunded), tone: "text-red-600" },
                  { label: "Net Revenue", value: formatInrAmount(paymentSummary.netRevenue), tone: "text-primary" },
                  { label: "Active Subscriptions", value: paymentSummary.activeSubscriptions, tone: "text-secondary" },
                  { label: "Total Transactions", value: paymentSummary.totalTransactions, tone: "text-foreground" },
                  { label: "Successful", value: paymentSummary.successfulTransactions, tone: "text-green-600" },
                  { label: "Failed", value: paymentSummary.failedTransactions, tone: "text-red-600" },
                  { label: "Refunded Txns", value: paymentSummary.refundedTransactions, tone: "text-amber-600" },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-2xl p-5 border border-border shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{item.label}</div>
                    <div className={`text-2xl font-bold ${item.tone}`}>{item.value}</div>
                  </div>
                )) : (
                  <div className="bg-white rounded-2xl p-12 border border-border shadow-sm text-center text-muted-foreground md:col-span-2 xl:col-span-4">
                    Payment summary unavailable.
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-primary" />
                      All Payment Transactions
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Showing {payments.length} of {paymentsTotal} transactions
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={fetchAgain} className="rounded-xl gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>

                {paymentsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[860px] divide-y divide-border">
                      <div className="grid grid-cols-[1fr_0.8fr_0.9fr_0.9fr_1.2fr_1fr] gap-3 px-3 pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Payment</span>
                        <span>User</span>
                        <span>Amount</span>
                        <span>Status</span>
                        <span>Order</span>
                        <span>Action</span>
                      </div>
                      {payments.map((payment) => {
                        const isPending = payment.status === "PENDING";
                        const canRefund = payment.status === "SUCCESS" && Boolean(payment.razorpayPaymentId);

                        return (
                        <div key={payment.paymentId} className="grid grid-cols-[1fr_0.8fr_0.9fr_0.9fr_1.2fr_1fr] gap-3 items-center px-3 py-4 text-sm">
                          <div className="min-w-0">
                            <div className="font-semibold">#{payment.paymentId}</div>
                            <div className="text-xs text-muted-foreground">{payment.paymentType || "Payment"}</div>
                            <div className="text-xs text-muted-foreground">{payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "No date"}</div>
                          </div>
                          <div className="font-medium">#{payment.userId}</div>
                          <div className="font-semibold">{formatInrAmount(payment.amount)}</div>
                          <div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getPaymentStatusClass(payment.status)}`}>
                              {payment.status || "PENDING"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{payment.razorpayOrderId || "No order id"}</div>
                            {payment.razorpayPaymentId && (
                              <div className="truncate text-xs text-muted-foreground">{payment.razorpayPaymentId}</div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {isPending && (
                              <Button
                                type="button"
                                variant="default"
                                disabled={approvingPaymentId === payment.paymentId || cancelingPaymentId === payment.paymentId}
                                onClick={() => handleApprovePayment(payment)}
                                className="rounded-xl text-xs px-3 bg-green-600 hover:bg-green-700 text-white"
                              >
                                {approvingPaymentId === payment.paymentId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Approve"}
                              </Button>
                            )}
                            {isPending ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={approvingPaymentId === payment.paymentId || cancelingPaymentId === payment.paymentId}
                                onClick={() => handleCancelPayment(payment)}
                                className="rounded-xl text-xs px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                {cancelingPaymentId === payment.paymentId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={!canRefund}
                                title={payment.status === "SUCCESS" && !payment.razorpayPaymentId ? "Refund requires a captured Razorpay payment ID" : undefined}
                                onClick={() => prefillRefundForm(payment)}
                                className="rounded-xl text-xs px-3"
                              >
                                Refund
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">No payment transactions found</div>
                )}

                {paymentsTotal > adminPageSize && (
                  <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={paymentsPage === 0 || paymentsLoading}
                      onClick={() => setPaymentsPage((currentPage) => Math.max(0, currentPage - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {paymentsPage + 1} of {Math.max(1, Math.ceil(paymentsTotal / adminPageSize))}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={(paymentsPage + 1) * adminPageSize >= paymentsTotal || paymentsLoading}
                      onClick={() => setPaymentsPage((currentPage) => currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>

              <div ref={refundFormRef} className="bg-white rounded-2xl p-6 border border-border shadow-sm max-w-2xl">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Issue Refund
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The payment service supports admin refunds by payment ID. Enter the amount in INR and we will send it to the backend in paise.
                </p>
                <form onSubmit={handleIssueRefund} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="number"
                    min="1"
                    value={refundForm.paymentId}
                    onChange={(event) => setRefundForm({ ...refundForm, paymentId: event.target.value })}
                    required
                    placeholder="Payment ID"
                    className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundForm.refundAmount}
                    onChange={(event) => setRefundForm({ ...refundForm, refundAmount: event.target.value })}
                    required
                    placeholder="Refund amount (INR)"
                    className="bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <textarea
                    value={refundForm.refundNote}
                    onChange={(event) => setRefundForm({ ...refundForm, refundNote: event.target.value })}
                    required
                    rows={3}
                    placeholder="Refund note"
                    className="sm:col-span-2 bg-muted rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <Button type="submit" disabled={issuingRefund} className="sm:col-span-2 rounded-xl gap-2 bg-primary hover:bg-primary/90 text-white">
                    {issuingRefund ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                    Submit Refund
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
    </AdminLayout>
  );
}
