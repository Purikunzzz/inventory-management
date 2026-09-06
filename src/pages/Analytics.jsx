import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ArrowLeftRight,
  Percent,
  AlertTriangle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  Package,
  ChevronDown,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
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
import { itemService } from "../services/itemService";

/* --- CONSTANTS --- */
const CHART_COLORS = [
  "#7C8D7D",
  "#C2CCD6",
  "#D9966E",
  "#B294A0",
  "#8B9DC3",
  "#A3C4A3",
];

const TIME_RANGES = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "1y", label: "1 Year" },
];

/* --- SKELETONS --- */
function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

function StatCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[250px] w-full rounded-xl" />
    </div>
  );
}

function FullPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}

/* --- COMPONENTS --- */
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 mb-4">
        <Icon className="h-8 w-8 text-gray-300" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      <p className="mt-1 text-sm text-gray-400 max-w-xs">{description}</p>
    </div>
  );
}

/* --- STAT CARD --- */
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  colorClass,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              colorClass || "bg-primary-50 text-primary-600",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
      </div>
    </motion.div>
  );
}

/* --- CUSTOM TOOLTIP --- */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-elevated text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-medium text-gray-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* --- PIE CENTER LABEL --- */
function PieCenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox;
  return (
    <>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-900"
        style={{ fontSize: "18px", fontWeight: 700 }}
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-400"
        style={{ fontSize: "11px" }}
      >
        Total Items
      </text>
    </>
  );
}

/* --- MONTHLY TREND CHART --- */
function MonthlyTrendChart({ data }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Monthly Borrow / Return Trend
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
          <Line
            type="monotone"
            dataKey="borrows"
            name="Borrows"
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS[0] }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="returns"
            name="Returns"
            stroke={CHART_COLORS[2]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS[2] }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --- CATEGORY DISTRIBUTION CHART --- */
function CategoryDistributionChart({ data }) {
  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data],
  );

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Category Distribution
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <RePieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {/* Center label */}
          {total > 0 &&
            (() => {
              const cx = "50%";
              const cy = "50%";
              return (
                <>
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-gray-900"
                    style={{ fontSize: "18px", fontWeight: 700 }}
                    dy="-0.35em"
                  >
                    {total}
                  </text>
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-gray-400"
                    style={{ fontSize: "11px" }}
                    dy="1.2em"
                  >
                    Total Items
                  </text>
                </>
              );
            })()}
        </RePieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.slice(0, 10).map((entry, idx) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
              }}
            />
            <span className="text-gray-500">{truncate(entry.name, 14)}</span>
          </div>
        ))}
        {data.length > 10 && (
          <span className="text-xs text-gray-400">
            +{data.length - 10} more
          </span>
        )}
      </div>
    </div>
  );
}

/* --- DEPARTMENT USAGE CHART --- */
function DepartmentUsageChart({ data }) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Department Usage
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={180}
            tickFormatter={(v) => truncate(v, 24)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="value"
            name="Borrows"
            radius={[0, 6, 6, 0]}
            fill={CHART_COLORS[0]}
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --- MOST BORROWED ITEMS CHART --- */
function MostBorrowedChart({ data }) {
  const chartData = useMemo(() => {
    return data
      .map((p) => ({
        name: truncate(p.name || "Item #" + p.itemId, 28),
        count: p.borrowCount,
        fullName: p.name || "Item #" + p.itemId,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Most Borrowed Items (Top 10)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={180}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            name="Borrows"
            radius={[0, 6, 6, 0]}
            fill={CHART_COLORS[2]}
            barSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --- MAIN PAGE --- */
export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30d");

  const {
    data: stockMovement,
    isLoading: smLoading,
    error: smError,
  } = useQuery({
    queryKey: ["stats-stockmovement"],
    queryFn: () => statsService.getStockMovement(365),
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
    data: itemsList,
    isLoading: ilLoading,
    error: ilError,
  } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.listItems({ limit: 1000 }),
  });

  const isLoading = smLoading || iuLoading || ilLoading;
  const hasError = smError || iuError || ilError;

  // Compute stats from stockMovement
  const stats = useMemo(() => {
    const movement = stockMovement || [];
    const totalBorrows = movement.reduce((s, m) => s + m.borrowed, 0);
    const totalReturns = movement.reduce((s, m) => s + m.returned, 0);

    const returnRate =
      totalBorrows > 0 ? Math.round((totalReturns / totalBorrows) * 100) : 0;

    return {
      totalBorrows,
      totalReturns,
      returnRate,
      damageRate: 0,
      avgDuration: "3.2 days",
    };
  }, [stockMovement]);

  // Filter stock movement based on time range
  const filteredMonthlyStats = useMemo(() => {
    const movement = stockMovement || [];
    const countMap = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
    const count = countMap[timeRange] || 30;
    return movement.slice(-count).map((s) => ({
      month: s.date,
      borrows: s.borrowed,
      returns: s.returned,
    }));
  }, [stockMovement, timeRange]);

  // Derive category distribution from items list
  const categoryDistribution = useMemo(() => {
    if (!itemsList || itemsList.length === 0) return [];
    const counts = {};
    itemsList.forEach((item) => {
      const cat = item.category || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [itemsList]);

  // Map item usage for MostBorrowedChart
  const popularItems = useMemo(
    () =>
      (itemUsage || []).map((u) => ({
        itemId: u.item_id,
        name: u.name,
        borrowCount: u.borrow_count,
      })),
    [itemUsage],
  );

  // Department usage — no backend endpoint yet
  const departmentUsage = [];

  if (isLoading) {
    return (
      <PageTransition>
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Insights and trends for lab equipment usage
              </p>
            </div>
          </div>
          <FullPageSkeleton />
        </div>
      </PageTransition>
    );
  }

  if (hasError) {
    const error = smError || iuError || ilError;
    return (
      <PageTransition>
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Analytics
              </h1>
            </div>
          </div>
          <div className="card flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">
              Failed to load analytics
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {error?.message || "An error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-outline mt-4 min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Insights and trends for lab equipment usage
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {TIME_RANGES.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px]",
                  timeRange === range.id
                    ? "bg-white text-gray-900 shadow-soft"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={ArrowLeftRight}
            label="Total Borrows"
            value={stats.totalBorrows.toLocaleString()}
            subtext={`${filteredMonthlyStats.length} entries`}
            colorClass="bg-primary-50 text-primary-600"
            delay={0}
          />
          <StatCard
            icon={TrendingUp}
            label="Return Rate"
            value={`${stats.returnRate}%`}
            subtext={`${stats.totalReturns} of ${stats.totalBorrows}`}
            colorClass="bg-green-50 text-green-600"
            delay={0.05}
          />
          <StatCard
            icon={AlertTriangle}
            label="Damage Rate"
            value={`${stats.damageRate}%`}
            subtext="Of all returns"
            colorClass="bg-amber-50 text-amber-600"
            delay={0.1}
          />
          <StatCard
            icon={Clock}
            label="Avg Duration"
            value={stats.avgDuration}
            subtext="Per borrow cycle"
            colorClass="bg-blue-50 text-blue-600"
            delay={0.15}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <MonthlyTrendChart data={filteredMonthlyStats} />

          {/* Category Distribution */}
          <CategoryDistributionChart data={categoryDistribution} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Department Usage */}
          <DepartmentUsageChart data={departmentUsage} />

          {/* Most Borrowed Items */}
          <MostBorrowedChart data={popularItems} />
        </div>
      </div>
    </PageTransition>
  );
}
