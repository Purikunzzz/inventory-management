import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart3,
  DollarSign,
  Package,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  Users,
  Boxes,
  RefreshCw,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import DatePicker from "../components/DatePicker";
import { cn, formatDate } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { statsService } from "../services/statsService";
import { reportService } from "../services/reportService";

// ---- Constants ----
const REPORT_CARDS = [
  {
    id: "inventory",
    icon: Package,
    title: "Inventory Report",
    description:
      "Complete inventory status with quantities, locations, and conditions.",
    color: "bg-primary-50 text-primary-600",
  },
  {
    id: "borrowing",
    icon: ArrowLeftRight,
    title: "Borrowing Report",
    description: "Borrowing activity, return rates, and overdue item analysis.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "maintenance",
    icon: Wrench,
    title: "Maintenance Report",
    description: "Low-stock equipment and overdue borrows that need attention.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    id: "damage",
    icon: AlertTriangle,
    title: "Damage Report",
    description: "Late returns and overdue incidents for the selected period.",
    color: "bg-red-50 text-red-600",
  },
  {
    id: "usage",
    icon: BarChart3,
    title: "Usage Analytics",
    description: "Equipment utilization rates, peak usage times, and trends.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    id: "financial",
    icon: DollarSign,
    title: "Financial Summary",
    description: "Stock composition per category with utilization overview.",
    color: "bg-green-50 text-green-600",
  },
];

const EXPORT_FORMATS = [
  {
    id: "pdf",
    label: "PDF",
    icon: FileText,
    color: "bg-red-50 text-red-600 hover:bg-red-100",
  },
  {
    id: "csv",
    label: "CSV",
    icon: FileSpreadsheet,
    color: "bg-green-50 text-green-600 hover:bg-green-100",
  },
  {
    id: "excel",
    label: "Excel",
    icon: FileSpreadsheet,
    color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
  },
];

const FORMAT_ICONS = {
  PDF: { icon: FileText, color: "bg-red-50 text-red-600" },
  Excel: { icon: FileSpreadsheet, color: "bg-green-50 text-green-600" },
  CSV: { icon: FileSpreadsheet, color: "bg-blue-50 text-blue-600" },
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// ---- Skeleton ----
function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

// ---- Stat Card ----
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
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
      {trend !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1 mt-1",
            trendUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
          )}
        >
          {trendUp ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {trend > 0 ? `+${trend}%` : `${trend}%`}
        </div>
      )}
    </motion.div>
  );
}

// ---- Report Card ----
function ReportCard({ report, onGenerate, isGenerating, generatingId }) {
  const Icon = report.icon;
  const isLoading = generatingId === report.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="card flex flex-col p-5"
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl mb-4",
          report.color,
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {report.title}
      </h3>
      <p className="text-sm text-gray-500 flex-1 mb-4">{report.description}</p>
      <button
        onClick={() => onGenerate(report)}
        disabled={isLoading}
        className={cn(
          "btn w-full",
          isLoading ? "btn-secondary" : "btn-primary",
        )}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate
          </span>
        )}
      </button>
    </motion.div>
  );
}

// ---- Recent Report Item ----
function RecentReportItem({ report, index }) {
  const formatInfo = FORMAT_ICONS[report.format] || FORMAT_ICONS.PDF;
  const FormatIcon = formatInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors"
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          formatInfo.color,
        )}
      >
        <FormatIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{report.type}</p>
        <p className="text-xs text-gray-500">
          {report.generatedBy} &middot; {formatDate(report.date)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="badge bg-gray-100 text-gray-600 text-xs">
          {report.format}
        </span>
        <p className="text-xs text-gray-400 mt-0.5">{report.size}</p>
      </div>
    </motion.div>
  );
}

// ---- Main Component ----
export default function Reports() {
  const { currentUser } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [generatingId, setGeneratingId] = useState(null);
  const [selectedExportFormat, setSelectedExportFormat] = useState("pdf");
  const [recentReports, setRecentReports] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lab_recent_reports")) || [];
    } catch {
      return [];
    }
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () => statsService.getSummary(),
  });

  const computedStats = useMemo(
    () => ({
      totalItems: summary?.total_items || 0,
      activeBorrows: summary?.active_borrows || 0,
      lowStockItems: summary?.low_stock_items || 0,
      totalUsers: summary?.total_users || 0,
    }),
    [summary],
  );

  const handleGenerate = async (report) => {
    setGeneratingId(report.id);
    try {
      const { filename, size } = await reportService.download(
        report.id,
        selectedExportFormat,
        { startDate, endDate },
      );
      const entry = {
        id: crypto.randomUUID(),
        type: report.title,
        format: selectedExportFormat.toUpperCase(),
        generatedBy: currentUser?.full_name || "You",
        date: new Date().toISOString(),
        size: formatBytes(size),
      };
      const next = [entry, ...recentReports].slice(0, 10);
      setRecentReports(next);
      try {
        localStorage.setItem("lab_recent_reports", JSON.stringify(next));
      } catch {
        // localStorage may be unavailable.
      }
      toast.success(`${report.title} downloaded`, {
        description: filename,
        duration: 4000,
      });
    } catch (err) {
      toast.error(`Failed to generate ${report.title}`, {
        description: err.message,
        duration: 5000,
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleExportFormat = (format) => {
    setSelectedExportFormat(format);
    toast.success(`Export format set to ${format.toUpperCase()}`, {
      duration: 2000,
    });
  };

  // Loading state
  if (summaryLoading) {
    return (
      <PageTransition>
        <div className="page-container space-y-6">
          <div className="page-header">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card space-y-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card space-y-3 p-5">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="page-container space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">
              Generate and export reports for inventory, borrowing, maintenance,
              and more
            </p>
          </div>
        </div>

        {/* Quick Stat Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            icon={Package}
            label="Total Items"
            value={computedStats.totalItems.toLocaleString()}
            colorClass="bg-primary-50 text-primary-600"
          />
          <StatCard
            icon={ArrowLeftRight}
            label="Active Borrows"
            value={computedStats.activeBorrows}
            colorClass="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={Boxes}
            label="Low Stock Items"
            value={computedStats.lowStockItems}
            colorClass="bg-red-50 text-red-600"
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value={computedStats.totalUsers.toLocaleString()}
            colorClass="bg-green-50 text-green-600"
          />
        </motion.div>

        {/* Date Range & Export Format */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5"
        >
          {/* Date Range */}
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-2">
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                max={endDate}
                clearable={false}
                className="w-40 min-h-[40px] px-3 py-1.5 text-sm"
                ariaLabel="Start date"
              />
              <span className="text-gray-400 text-sm">to</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                min={startDate}
                clearable={false}
                className="w-40 min-h-[40px] px-3 py-1.5 text-sm"
                ariaLabel="End date"
              />
            </div>
          </div>

          {/* Export Format */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">Export as:</span>
            {EXPORT_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => handleExportFormat(fmt.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all min-h-[40px] focus-visible:outline-2 focus-visible:outline-primary-500",
                  selectedExportFormat === fmt.id
                    ? fmt.color + " ring-2 ring-offset-1 ring-current"
                    : "text-gray-500 hover:bg-gray-100",
                )}
              >
                <fmt.icon className="h-4 w-4" />
                {fmt.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Report Type Grid */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Generate Report
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_CARDS.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onGenerate={handleGenerate}
                isGenerating={!!generatingId}
                generatingId={generatingId}
              />
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Reports
            </h2>
          </div>

          <div className="card p-0 overflow-hidden">
            {recentReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <FileText className="h-10 w-10 text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  No recent reports
                </h3>
                <p className="text-xs text-gray-500">
                  Generated reports will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentReports.map((report, i) => (
                  <RecentReportItem key={report.id} report={report} index={i} />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Error state: if stats query failed */}
        {summaryError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card flex flex-col items-center justify-center py-12 px-4"
          >
            <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Failed to load statistics
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Unable to fetch report data. Please try again.
            </p>
            <button
              onClick={() => refetchSummary()}
              className="btn btn-secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
