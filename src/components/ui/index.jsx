import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

/* ── Skeleton ─────────────────────────────────────────────────────────── */
export function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

/* ── EmptyState ───────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 mb-4">
          <Icon className="h-8 w-8 text-gray-300" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── ErrorState ───────────────────────────────────────────────────────── */
import { ShieldAlert, RefreshCw } from "lucide-react";

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
        <ShieldAlert className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">
        Something went wrong
      </h3>
      <p className="mt-1 text-sm text-gray-400 max-w-xs">
        {message || "An unexpected error occurred."}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-outline mt-4 min-h-[44px]">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

/* ── ConfirmDialog ────────────────────────────────────────────────────── */
import { X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  variant = "primary",
}) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="card max-w-md w-full p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={onCancel} className="btn btn-outline min-h-[44px]">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                "btn min-h-[44px]",
                variant === "danger" ? "btn-danger" : "btn-primary",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── StatCard ─────────────────────────────────────────────────────────── */
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function StatCard({ icon: Icon, label, value, trend, trendUp, colorClass }) {
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

/* ── Badge ────────────────────────────────────────────────────────────── */
export function Badge({ children, className }) {
  return <span className={cn("badge", className)}>{children}</span>;
}

/* ── TableSkeleton ────────────────────────────────────────────────────── */
export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
