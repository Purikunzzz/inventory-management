import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package,
  CheckCircle,
  ArrowLeftRight,
  Wrench,
  Plus,
  QrCode,
  Search,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  Bell,
  Info,
  AlertCircle,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import PageTransition from "../components/PageTransition";
import {
  cn,
  formatDate,
  formatRelative,
  getStatusColor,
  getPlaceholderImage,
} from "../lib/utils";
import { statsService } from "../services/statsService";
import { borrowService } from "../services/borrowService";
import { useAuth } from "../hooks/useAuth";

const DONUT_COLORS = [
  "#7C8D7D",
  "#C2CCD6",
  "#D9966E",
  "#B294A0",
  "#8B9DC3",
  "#A3C4A3",
  "#D4A89C",
  "#C4B5A5",
];

function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

function StatCard({ icon: Icon, label, value, trend, trendUp, colorClass }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="card flex items-start justify-between"
    >
      <div className="space-y-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            colorClass || "bg-primary-50 text-primary-600",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
        </div>
      </div>
      {trend !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1 mt-1",
            trendUp
              ? "bg-green-50 text-green-700"
              : trend < 0
                ? "bg-red-50 text-red-700"
                : "bg-gray-50 text-gray-500",
          )}
        >
          {trendUp ? (
            <TrendingUp className="h-3 w-3" />
          ) : trend < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {trend !== 0 ? `${trend > 0 ? "+" : ""}${trend}%` : "0%"}
        </div>
      )}
    </motion.div>
  );
}

const actionButtons = [
  {
    icon: Plus,
    label: "Borrow Item",
    href: "/borrow",
    color: "bg-primary-500 hover:bg-primary-600 text-white",
  },
  {
    icon: QrCode,
    label: "Scan QR",
    href: "/qr-scanner",
    color: "bg-secondary-300 hover:bg-secondary-400 text-gray-800",
  },
  {
    icon: Search,
    label: "View Inventory",
    href: "/inventory",
    color: "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700",
  },
  {
    icon: AlertTriangle,
    label: "Report Issue",
    href: "/maintenance",
    color: "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700",
  },
];

const announcements = [];

export default function Dashboard() {
  const { currentUser } = useAuth();

  // --- Queries ---
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: statsService.getSummary,
  });

  const {
    data: recentTxns,
    isLoading: txnsLoading,
    error: txnsError,
  } = useQuery({
    queryKey: ["transactions-recent"],
    queryFn: () => borrowService.listTransactions({ limit: 10 }),
  });

  const {
    data: lowStock,
    isLoading: lsLoading,
    error: lsError,
  } = useQuery({
    queryKey: ["stats-lowstock"],
    queryFn: statsService.getLowStock,
  });

  const {
    data: itemUsage,
    isLoading: iuLoading,
    error: iuError,
  } = useQuery({
    queryKey: ["stats-itemusage"],
    queryFn: () => statsService.getItemUsage(10),
  });

  const {
    data: stockMovement,
    isLoading: smLoading,
    error: smError,
  } = useQuery({
    queryKey: ["stats-stockmovement"],
    queryFn: () => statsService.getStockMovement(365),
  });

  const isLoading =
    summaryLoading || txnsLoading || lsLoading || iuLoading || smLoading;
  const hasError = summaryError || txnsError || lsError || iuError || smError;

  // --- Derived data ---
  const enrichedTransactions = useMemo(
    () =>
      (recentTxns || []).map((t) => ({
        ...t,
        user: null,
        item: null,
        itemId: t.item_id,
        borrowDate: t.borrowed_at,
        type: t.status === "borrowed" ? "borrow" : "return",
        purpose: t.note,
      })),
    [recentTxns],
  );

  const enrichedReturns = useMemo(
    () =>
      (recentTxns || [])
        .filter((t) => t.status === "borrowed")
        .map((t) => ({
          ...t,
          user: null,
          item: null,
          expectedReturn: null,
        })),
    [recentTxns],
  );

  const lowStockItems = useMemo(
    () =>
      (lowStock || []).map((l) => ({
        id: l.item_id,
        name: l.name,
        quantity: l.available_quantity,
      })),
    [lowStock],
  );

  const popularEquipment = useMemo(
    () =>
      (itemUsage || []).map((u) => ({
        id: u.item_id,
        name: u.name,
        borrowCount: u.borrow_count,
        image: u.image_url || null,
        status: "available",
      })),
    [itemUsage],
  );

  const monthlyBorrowStats = useMemo(
    () =>
      (stockMovement || []).map((s) => ({
        month: s.date,
        borrows: s.borrowed,
        returns: s.returned,
      })),
    [stockMovement],
  );

  const categoryDistribution = [];

  const enrichedMaintenance = [];

  // --- Loading state ---
  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-11 w-36 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </div>
      </PageTransition>
    );
  }

  // --- Error state ---
  if (hasError) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700">
            Failed to load dashboard
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
      <div className="space-y-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="relative">
            <img
              src={
                currentUser?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.full_name || currentUser?.name || "User")}&size=40&background=7C8D7D&color=fff`
              }
              alt={currentUser?.full_name || currentUser?.name || "User"}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome back,{" "}
              {
                (currentUser?.full_name || currentUser?.name || "User").split(
                  " ",
                )[0]
              }
            </h1>
            <p className="text-sm text-gray-500">
              Here&apos;s what&apos;s happening in your lab today.
            </p>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Package}
            label="Total Items"
            value={summary?.total_items || 0}
            trend={8}
            trendUp
            colorClass="bg-primary-50 text-primary-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Available"
            value={(summary?.total_items || 0) - (summary?.active_borrows || 0)}
            trend={5}
            trendUp
            colorClass="bg-green-50 text-green-600"
          />
          <StatCard
            icon={ArrowLeftRight}
            label="Borrowed"
            value={summary?.active_borrows || 0}
            trend={-3}
            trendUp={false}
            colorClass="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={Wrench}
            label="Maintenance"
            value={0}
            trend={2}
            trendUp={false}
            colorClass="bg-amber-50 text-amber-600"
          />
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {actionButtons.map((btn) => (
            <Link
              key={btn.label}
              to={btn.href}
              className={cn(
                "btn inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px]",
                btn.color,
              )}
            >
              <btn.icon className="h-4 w-4" />
              {btn.label}
            </Link>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Health Donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Inventory Health</h3>
              <Link
                to="/inventory"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {categoryDistribution.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No category data available</p>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-48 h-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {categoryDistribution.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "none",
                          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                          fontSize: 13,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {categoryDistribution.map((cat, idx) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              DONUT_COLORS[idx % DONUT_COLORS.length],
                          }}
                        />
                        <span className="text-gray-600">{cat.name}</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {cat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Borrowing Overview Area Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">
                Borrowing Overview
              </h3>
              <span className="text-xs text-gray-400">Monthly</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyBorrowStats}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="borrowedGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#7C8D7D"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#7C8D7D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="returnedGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#C2CCD6"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#C2CCD6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                      fontSize: 13,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="borrows"
                    stroke="#7C8D7D"
                    fill="url(#borrowedGrad)"
                    strokeWidth={2}
                    name="Borrowed"
                  />
                  <Area
                    type="monotone"
                    dataKey="returns"
                    stroke="#C2CCD6"
                    fill="url(#returnedGrad)"
                    strokeWidth={2}
                    name="Returned"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Recent Activity + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <Link
                to="/borrow"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                View all
              </Link>
            </div>
            {enrichedTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-0">
                {enrichedTransactions.map((txn, idx) => (
                  <div
                    key={txn.id}
                    className={cn(
                      "flex items-center gap-3 py-3",
                      idx < enrichedTransactions.length - 1 &&
                        "border-b border-gray-50",
                    )}
                  >
                    <img
                      src={
                        txn.user?.avatar ||
                        `https://ui-avatars.com/api/?name=User&size=32`
                      }
                      alt={txn.user?.name || "User"}
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0 bg-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">
                          {txn.user?.name || "Unknown"}
                        </span>{" "}
                        <span className="text-gray-500">
                          {txn.type === "borrow" ? "borrowed" : "returned"}
                        </span>{" "}
                        {txn.item ? (
                          <Link
                            to={`/inventory/${txn.itemId}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            {txn.item.name.length > 28
                              ? txn.item.name.slice(0, 28) + "..."
                              : txn.item.name}
                          </Link>
                        ) : (
                          <Link
                            to={`/inventory/${txn.itemId}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            Item #{txn.itemId}
                          </Link>
                        )}
                      </p>
                      {txn.purpose && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {txn.purpose}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={cn(
                          "flex items-center justify-center w-7 h-7 rounded-full",
                          txn.type === "borrow"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-green-50 text-green-600",
                        )}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatRelative(txn.borrowDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Side alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-4"
          >
            {/* Low Stock */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Low Stock Alerts
                </h3>
              </div>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No low stock items
                </p>
              ) : (
                <div className="space-y-2">
                  {lowStockItems.map((item) => (
                    <Link
                      key={item.id}
                      to={`/inventory/${item.id}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-red-50/50 hover:bg-red-50 transition-colors"
                    >
                      <span className="text-sm text-gray-800 truncate">
                        {item.name}
                      </span>
                      <span className="badge badge-danger text-xs flex-shrink-0 ml-2">
                        Qty: {item.quantity}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance Due */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Wrench className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Maintenance Due
                </h3>
              </div>
              {enrichedMaintenance.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  All equipment up to date
                </p>
              ) : (
                <div className="space-y-2">
                  {enrichedMaintenance.map((maint) => (
                    <div
                      key={maint.id}
                      className="flex items-start justify-between p-2 rounded-lg bg-amber-50/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 font-medium truncate">
                          {maint.item?.name || "Unknown item"}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {maint.type}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span
                          className={cn(
                            "badge text-xs",
                            maint.status === "scheduled"
                              ? "badge-warning"
                              : maint.status === "in-progress"
                                ? "badge-info"
                                : "badge-neutral",
                          )}
                        >
                          {maint.nextDue ? formatDate(maint.nextDue) : "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link
                to="/maintenance"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-3 inline-block"
              >
                View all maintenance
              </Link>
            </div>

            {/* Upcoming Returns */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Upcoming Returns
                </h3>
              </div>
              {enrichedReturns.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No pending returns
                </p>
              ) : (
                <div className="space-y-2">
                  {enrichedReturns.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-blue-50/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 truncate">
                          {txn.item?.name || "Unknown item"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {txn.user?.name || "Unknown user"}
                        </p>
                      </div>
                      <span className="text-xs text-blue-600 font-medium whitespace-nowrap ml-2">
                        Due{" "}
                        {txn.expectedReturn
                          ? formatDate(txn.expectedReturn)
                          : "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Popular Equipment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-accent-500" />
              <h3 className="font-semibold text-gray-900">Popular Equipment</h3>
            </div>
            <Link
              to="/inventory"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Browse all
            </Link>
          </div>
          {popularEquipment.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No equipment data available
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
              {popularEquipment.map((item) => (
                <Link
                  key={item.id}
                  to={`/inventory/${item.id}`}
                  className="flex-shrink-0 w-44 group"
                >
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 mb-2">
                    <img
                      src={item.image || getPlaceholderImage(item)}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "badge text-[10px]",
                        getStatusColor(item.status),
                      )}
                    >
                      {item.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {item.borrowCount || 0} borrows
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Announcements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-muted-400" />
            <h3 className="font-semibold text-gray-900">Announcements</h3>
          </div>
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No announcements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => {
                const typeIcons = {
                  alert: { icon: AlertCircle, color: "bg-red-50 text-red-600" },
                  warning: {
                    icon: AlertTriangle,
                    color: "bg-amber-50 text-amber-600",
                  },
                  info: { icon: Info, color: "bg-blue-50 text-blue-600" },
                  success: {
                    icon: CheckCircle,
                    color: "bg-green-50 text-green-600",
                  },
                };
                const annStyle = typeIcons[ann.type] || typeIcons.info;
                const AnnIcon = annStyle.icon;
                return (
                  <div
                    key={ann.id}
                    className="flex gap-3 p-3 rounded-lg bg-gray-50/70"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0",
                        annStyle.color,
                      )}
                    >
                      <AnnIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {ann.title}
                        </h4>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(ann.date)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {ann.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
}
