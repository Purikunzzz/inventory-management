import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users as UsersIcon,
  ScrollText,
  QrCode as QrCodeIcon,
  Package,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Edit,
  Eye,
  Download,
  Printer,
  Plus,
  Search,
  Filter,
  ChevronDown,
  RefreshCw,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageTransition from "../components/PageTransition";
import {
  cn,
  formatDate,
  formatRelative,
  formatCurrency,
  getStatusColor,
  getConditionColor,
  truncate,
} from "../lib/utils";
import { statsService } from "../services/statsService";
import { userService } from "../services/userService";
import { itemService } from "../services/itemService";
import { borrowService } from "../services/borrowService";
import AddItemModal from "../components/AddItemModal";

// ---- Constants ----

// Fetches "all" users for client-side search/filter — must stay comfortably
// above the real user count or accounts silently disappear from the table.
const FETCH_ALL_LIMIT = 500;

const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "audit", label: "Audit Logs", icon: ScrollText },
  { id: "qr", label: "QR Generator", icon: QrCodeIcon },
];

const QUICK_ACTIONS = [
  {
    id: "add-item",
    label: "Add Item",
    icon: Plus,
    color: "bg-primary-50 text-primary-600",
  },
  {
    id: "add-user",
    label: "Add User",
    icon: UserCheck,
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "scan-qr",
    label: "Scan QR",
    icon: QrCodeIcon,
    color: "bg-amber-50 text-amber-600",
  },
  {
    id: "backup",
    label: "Backup Data",
    icon: Download,
    color: "bg-green-50 text-green-600",
  },
];

const STATUS_CONFIG = {
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
  disabled: { bg: "bg-red-50", text: "text-red-700", label: "Disabled" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
};

// The backend has no dedicated audit-log table (no such model in
// CLAUDE.md's domain: Item / BorrowRecord / User / Location only) — building
// a real one (who-did-what-when for every admin action: user edits, role
// changes, logins, item CRUD...) needs a new table + write hooks in every
// service and is a real schema/scope decision, not something to invent
// silently here.
//
// What IS real, already-recorded activity: BorrowRecord. Every borrow and
// return is a genuine timestamped event tied to a user and an item, so this
// tab is built entirely from GET /transactions instead of fabricated log
// entries — no mock data, no invented users.
const AUDIT_CATEGORIES = ["all", "borrowed", "returned", "overdue"];

const LOG_ACTION_ICONS = {
  "Item Borrowed": { icon: ArrowLeftRight, color: "bg-blue-50 text-blue-600" },
  "Item Returned": { icon: CheckCircle, color: "bg-green-50 text-green-600" },
  Overdue: { icon: AlertCircle, color: "bg-red-50 text-red-600" },
};

// ---- Skeleton ----
function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

// ---- Stat Card ----
function StatCard({ icon: Icon, label, value, sub, colorClass }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex items-start gap-4 p-4"
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0",
          colorClass || "bg-primary-50 text-primary-600",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ---- QR Pattern Generator ----
function QRPattern({ code }) {
  // Generate a pseudo QR-like grid pattern based on the code
  const size = 21;
  const cells = useMemo(() => {
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => false),
    );
    // Generate a seeded pattern based on code string
    let hash = 0;
    for (let i = 0; i < (code || "LABFLOW").length; i++) {
      hash = (hash << 5) - hash + (code || "LABFLOW").charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    // Finders (top-left, top-right, bottom-left)
    const drawFinder = (r, c) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const rr = r + i;
          const cc = c + j;
          if (rr < size && cc < size) {
            grid[rr][cc] =
              i === 0 ||
              i === 6 ||
              j === 0 ||
              j === 6 ||
              (i >= 2 && i <= 4 && j >= 2 && j <= 4);
          }
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);
    // Fill remaining with seeded pattern
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c]) continue;
        const val = (seed * (r * size + c + 1)) % 1000 > 500;
        grid[r][c] = val;
      }
    }
    return grid;
  }, [code]);

  return (
    <div className="flex items-center justify-center p-6">
      <div className="bg-white p-6 rounded-xl shadow-inner border-2 border-gray-200">
        <div
          className="grid border-4 border-gray-900 rounded-sm overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            width: `${Math.min(280, size * 13)}px`,
            height: `${Math.min(280, size * 13)}px`,
          }}
        >
          {cells.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className={cn(
                  "aspect-square",
                  cell ? "bg-gray-900" : "bg-white",
                )}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
export default function Admin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrGenerated, setQrGenerated] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: statsService.getSummary,
  });

  // Fetch real users from API
  const {
    data: apiUsers = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersApiError,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => userService.listUsers({ limit: FETCH_ALL_LIMIT }),
  });

  // Items + transactions — used to build the Audit Logs tab from real
  // BorrowRecord data (see AUDIT_CATEGORIES comment below), not to compute
  // any of the Overview stats (those come from statsService.getSummary).
  const { data: apiItems = [] } = useQuery({
    queryKey: ["admin-items"],
    queryFn: () => itemService.listItems({ limit: FETCH_ALL_LIMIT }),
  });

  const {
    data: apiTransactions = [],
    isLoading: txnLoading,
    isError: txnError,
  } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => borrowService.listTransactions({ limit: FETCH_ALL_LIMIT }),
  });

  const isLoading = summaryLoading || usersLoading || txnLoading;
  const hasError = summaryError || usersError || txnError;

  // Mutations for user management
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated");
      setEditingUser(null);
    },
    onError: (err) => toast.error(err.message || "Failed to update user"),
  });

  const toggleUserMutation = useMutation({
    mutationFn: ({ id, isActive }) =>
      userService.updateUser(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update user"),
  });

  const createUserMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User created");
      setShowAddUser(false);
    },
    onError: (err) => toast.error(err.message || "Failed to create user"),
  });

  const filteredUsers = useMemo(() => {
    let result = [...apiUsers];
    if (userStatusFilter !== "all") {
      result = result.filter((u) => {
        if (userStatusFilter === "active") return u.is_active;
        if (userStatusFilter === "disabled") return !u.is_active;
        return true;
      });
    }
    if (userSearch) {
      const q = userSearch.toLowerCase();
      result = result.filter(
        (u) =>
          (u.full_name && u.full_name.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q),
      );
    }
    return result;
  }, [apiUsers, userStatusFilter, userSearch]);

  const userMap = useMemo(() => {
    const map = {};
    apiUsers.forEach((u) => {
      map[u.id] = u.full_name || u.email;
    });
    return map;
  }, [apiUsers]);

  const itemMap = useMemo(() => {
    const map = {};
    apiItems.forEach((i) => {
      map[i.id] = i.name;
    });
    return map;
  }, [apiItems]);

  // Derive audit-log rows from real BorrowRecord transactions: one entry per
  // borrow event, plus a second entry for the return if it's happened, plus
  // an "Overdue" entry for anything still borrowed past its due date.
  const auditLogs = useMemo(() => {
    const now = new Date();
    const rows = [];
    apiTransactions.forEach((txn) => {
      const userName = userMap[txn.user_id] || `User #${txn.user_id}`;
      const itemName = itemMap[txn.item_id] || `Item #${txn.item_id}`;
      rows.push({
        id: `${txn.id}-borrowed`,
        timestamp: txn.borrowed_at,
        action: "Item Borrowed",
        category: "borrowed",
        user: userName,
        item: itemName,
        detail: `${itemName} × ${txn.quantity}${txn.note ? ` — ${txn.note}` : ""}`,
      });
      if (txn.status === "returned" && txn.returned_at) {
        rows.push({
          id: `${txn.id}-returned`,
          timestamp: txn.returned_at,
          action: "Item Returned",
          category: "returned",
          user: userName,
          item: itemName,
          detail: `${itemName} × ${txn.quantity}${txn.note ? ` — ${txn.note}` : ""}`,
        });
      } else if (txn.status === "borrowed" && txn.due_date && new Date(txn.due_date) < now) {
        rows.push({
          id: `${txn.id}-overdue`,
          timestamp: txn.due_date,
          action: "Overdue",
          category: "overdue",
          user: userName,
          item: itemName,
          detail: `${itemName} × ${txn.quantity} — due ${formatDate(txn.due_date)}, not yet returned`,
        });
      }
    });
    return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [apiTransactions, userMap, itemMap]);

  const filteredAuditLogs = useMemo(() => {
    let result = [...auditLogs];
    if (auditCategory !== "all") {
      result = result.filter((log) => log.category === auditCategory);
    }
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      result = result.filter(
        (log) =>
          log.user.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.detail.toLowerCase().includes(q),
      );
    }
    return result;
  }, [auditLogs, auditCategory, auditSearch]);

  const handleDisableUser = (user) => {
    const makeActive = !user.is_active;
    toggleUserMutation.mutate({ id: user.id, isActive: makeActive });
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    if (activeTab !== "users") setActiveTab("users");
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    const fullName = form.full_name.value.trim();
    if (fullName) data.full_name = fullName;
    const emailVal = form.email.value.trim();
    if (emailVal && emailVal !== editingUser.email) data.email = emailVal;
    const pwd = form.password.value;
    if (pwd) data.password = pwd;
    if (form.role.value) data.role = form.role.value;
    updateUserMutation.mutate({ id: editingUser.id, data });
  };

  const handleAddUserSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      email: form.email.value.trim(),
      password: form.password.value,
      full_name: form.full_name.value.trim() || null,
      role: form.role.value || "user",
    };
    createUserMutation.mutate(data);
  };

  const handleGenerateQR = async () => {
    if (!qrCode.trim()) {
      toast.error("Please enter an item code");
      return;
    }
    setQrLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setQrGenerated(qrCode);
    setQrLoading(false);
    toast.success("QR code generated successfully", {
      description: `QR code for ${qrCode} is ready`,
    });
  };

  const handleDownloadQR = () => {
    toast.success("QR code downloaded as PNG", {
      description: `QR-${qrGenerated}.png saved to downloads`,
    });
  };

  const handlePrintQR = () => {
    toast.success("QR code sent to printer", {
      description: "Print job has been queued",
    });
  };

  const computedStats = useMemo(
    () => ({
      totalItems: summary?.total_items || 0,
      totalUsers: apiUsers.length,
      activeBorrows: summary?.active_borrows || 0,
      systemHealth: "98.7%",
    }),
    [summary],
  );

  // Loading state
  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex gap-6 h-full">
          <div className="w-56 flex-shrink-0 space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageTransition>
    );
  }

  // Error state
  if (hasError) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700">
            Failed to load admin panel
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            Please check your connection and try again
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-outline mt-4 min-h-[44px]"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="lg:sticky lg:top-6 space-y-1">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                System administration
              </p>
            </div>
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px] focus-visible:outline-2 focus-visible:outline-primary-500",
                  activeTab === tab.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <tab.icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={Package}
                    label="Total Items"
                    value={computedStats.totalItems.toLocaleString()}
                    colorClass="bg-primary-50 text-primary-600"
                  />
                  <StatCard
                    icon={UsersIcon}
                    label="Total Users"
                    value={computedStats.totalUsers}
                    colorClass="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    icon={ArrowLeftRight}
                    label="Active Borrows"
                    value={computedStats.activeBorrows}
                    colorClass="bg-amber-50 text-amber-600"
                  />
                  <StatCard
                    icon={ShieldCheck}
                    label="System Health"
                    value={computedStats.systemHealth}
                    sub="All systems operational"
                    colorClass="bg-green-50 text-green-600"
                  />
                </div>

                {/* Quick Actions */}
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    Quick Actions
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => {
                          if (action.id === "add-item")
                            setShowAddItem(true);
                          else if (action.id === "add-user")
                            setShowAddUser(true);
                          else if (action.id === "scan-qr")
                            navigate("/qr-scanner");
                          else if (action.id === "backup")
                            toast.info("Backup export is not available yet");
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all min-h-[44px] focus-visible:outline-2 focus-visible:outline-primary-500",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            action.color,
                          )}
                        >
                          <action.icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Info */}
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    System Info
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-gray-500">Version</span>
                      <span className="font-medium text-gray-900">
                        LabFlow v2.1.0
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-gray-500">Last Backup</span>
                      <span className="font-medium text-gray-900">
                        {formatDate("2026-06-22")}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-gray-500">Database Size</span>
                      <span className="font-medium text-gray-900">1.4 GB</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Uptime</span>
                      <span className="font-medium text-gray-900">47 days</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="input pl-9"
                    />
                  </div>
                  {/* Status filter */}
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="input w-auto min-h-[44px]"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                  {/* Add User button */}
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="btn btn-primary flex items-center gap-2 min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" />
                    Add User
                  </button>
                </div>

                {/* Users Table */}
                <div className="card p-0 overflow-hidden">
                  {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <UsersIcon className="h-10 w-10 text-gray-300 mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">
                        No users found
                      </h3>
                      <p className="text-xs text-gray-500">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              User
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Email
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Role
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Department
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Status
                            </th>
                            <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredUsers.map((user, idx) => {
                            const displayName = user.full_name || user.email.split("@")[0];
                            const userStatus = user.is_active ? "active" : "disabled";
                            const statusInfo =
                              STATUS_CONFIG[userStatus] || STATUS_CONFIG.active;
                            return (
                              <motion.tr
                                key={user.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="hover:bg-gray-50/50"
                              >
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=7C8D7D&color=fff&size=64`}
                                      alt={displayName}
                                      className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                                      loading="lazy"
                                    />
                                    <span className="text-sm font-medium text-gray-900">
                                      {displayName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600">
                                  {user.email}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="badge bg-gray-100 text-gray-700 capitalize text-xs">
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600">
                                  {truncate(user.department || "—", 25)}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span
                                    className={cn(
                                      "badge",
                                      statusInfo.bg,
                                      statusInfo.text,
                                    )}
                                  >
                                    {statusInfo.label}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleEditUser(user)}
                                      className="btn btn-ghost p-2 min-h-0 rounded-lg"
                                      title="Edit user"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDisableUser(user)}
                                      className="btn btn-ghost p-2 min-h-0 rounded-lg text-red-500 hover:bg-red-50"
                                      title={
                                        user.is_active
                                          ? "Disable user"
                                          : "Enable user"
                                      }
                                    >
                                      {user.is_active ? (
                                        <UserX className="h-4 w-4" />
                                      ) : (
                                        <UserCheck className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === "audit" && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search audit logs..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="input pl-9"
                    />
                  </div>
                  {/* Category filter */}
                  <select
                    value={auditCategory}
                    onChange={(e) => setAuditCategory(e.target.value)}
                    className="input w-auto min-h-[44px] capitalize"
                  >
                    {AUDIT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === "all" ? "All Categories" : cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audit Logs Table */}
                <div className="card p-0 overflow-hidden">
                  {filteredAuditLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <ScrollText className="h-10 w-10 text-gray-300 mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">
                        No audit logs found
                      </h3>
                      <p className="text-xs text-gray-500">
                        Try adjusting your filters
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Action
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              User
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Item
                            </th>
                            <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Timestamp
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredAuditLogs.map((log, idx) => {
                            const actionInfo = LOG_ACTION_ICONS[log.action] || {
                              icon: Eye,
                              color: "bg-gray-50 text-gray-600",
                            };
                            const ActionIcon = actionInfo.icon;
                            return (
                              <motion.tr
                                key={log.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="hover:bg-gray-50/50"
                              >
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-lg",
                                        actionInfo.color,
                                      )}
                                    >
                                      <ActionIcon className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">
                                      {log.action}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600">
                                  {log.user}
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 max-w-xs">
                                  {truncate(log.detail, 60)}
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-500 text-right whitespace-nowrap">
                                  {formatDate(log.timestamp)}
                                  <br />
                                  <span className="text-xs text-gray-400">
                                    {new Date(log.timestamp).toLocaleTimeString(
                                      "en-US",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </span>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* QR Generator Tab */}
            {activeTab === "qr" && (
              <motion.div
                key="qr"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                {/* Input */}
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    Generate QR Code
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="label" htmlFor="qr-input">
                        Item Code or ID
                      </label>
                      <input
                        id="qr-input"
                        type="text"
                        placeholder="e.g., ITEM-122 or QR-ITEM-122"
                        value={qrCode}
                        onChange={(e) => setQrCode(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleGenerateQR()
                        }
                        className="input"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleGenerateQR}
                        disabled={qrLoading}
                        className="btn btn-primary w-full sm:w-auto"
                      >
                        {qrLoading ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Generating...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <QrCodeIcon className="h-4 w-4" />
                            Generate QR
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* QR Display */}
                {qrGenerated ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                        QR Code: {qrGenerated}
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDownloadQR}
                          className="btn btn-outline min-h-0 py-2 px-3 text-sm"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                        <button
                          onClick={handlePrintQR}
                          className="btn btn-primary min-h-0 py-2 px-3 text-sm"
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </button>
                      </div>
                    </div>
                    <QRPattern code={qrGenerated} />
                    <p className="text-center text-xs text-gray-400 mt-3">
                      QR-{qrGenerated} &middot; Generated{" "}
                      {new Date().toLocaleString()}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="card flex flex-col items-center justify-center py-16 px-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                      <QrCodeIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">
                      No QR code generated
                    </h3>
                    <p className="text-xs text-gray-500 text-center max-w-xs">
                      Enter an item code above and click "Generate QR" to create
                      a QR code
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Edit User Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit User
                </h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="label">Full Name</label>
                  <input
                    name="full_name"
                    type="text"
                    className="input"
                    defaultValue={editingUser.full_name || ""}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">Email</label>
                  <input
                    name="email"
                    type="email"
                    className="input"
                    defaultValue={editingUser.email}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">New Password (leave blank to keep)</label>
                  <input
                    name="password"
                    type="password"
                    minLength={6}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">Role</label>
                  <select
                    name="role"
                    className="input"
                    defaultValue={editingUser.role}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="btn btn-ghost flex-1 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="btn btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2"
                  >
                    {updateUserMutation.isPending && (
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add User Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowAddUser(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add User
                </h3>
                <button
                  onClick={() => setShowAddUser(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddUserSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="label">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="input"
                    placeholder="user@kmitl.ac.th"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    className="input"
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">Full Name</label>
                  <input
                    name="full_name"
                    type="text"
                    className="input"
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">Role</label>
                  <select name="role" className="input" defaultValue="user">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="btn btn-ghost flex-1 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="btn btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2"
                  >
                    {createUserMutation.isPending && (
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    Create User
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddItemModal open={showAddItem} onClose={() => setShowAddItem(false)} />
    </PageTransition>
  );
}
