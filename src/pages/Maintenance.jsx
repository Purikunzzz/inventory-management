import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Wrench,
  Target,
  RefreshCw,
  Search,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ChevronDown,
  FileText,
  DollarSign,
  Package,
  TrendingUp,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import DatePicker from "../components/DatePicker";
import {
  cn,
  formatDate,
  formatRelative,
  formatCurrency,
  getStatusColor,
  getConditionColor,
  truncate,
} from "../lib/utils";
import { maintenanceService } from "../services/maintenanceService";
import { itemService } from "../services/itemService";
import { userService } from "../services/userService";
import { useAuth } from "../hooks/useAuth";

const CURRENCY = "THB";
const money = (v) => formatCurrency(Number(v) || 0, CURRENCY);
const todayISO = () => new Date().toISOString().split("T")[0];

/** A scheduled job whose date has passed is shown as Overdue. */
function displayStatus(record) {
  if (record.status === "scheduled" && record.scheduled_date < todayISO()) {
    return "overdue";
  }
  return record.status;
}

// ---- Constants ----
const TABS = [
  { id: "all", label: "All", icon: Package },
  { id: "scheduled", label: "Scheduled", icon: Calendar },
  { id: "in_progress", label: "In Progress", icon: Clock },
  { id: "completed", label: "Completed", icon: CheckCircle },
];

const TYPE_ICONS = {
  repair: { icon: Wrench, color: "bg-amber-50 text-amber-600" },
  calibration: { icon: Target, color: "bg-blue-50 text-blue-600" },
  replacement: { icon: RefreshCw, color: "bg-purple-50 text-purple-600" },
  inspection: { icon: Search, color: "bg-green-50 text-green-600" },
};

const TYPE_LABELS = {
  repair: "Repair",
  calibration: "Calibration",
  replacement: "Replacement",
  inspection: "Inspection",
};

const TYPE_OPTIONS = [
  { value: "repair", label: "Repair" },
  { value: "calibration", label: "Calibration" },
  { value: "replacement", label: "Replacement" },
  { value: "inspection", label: "Inspection" },
];

const STATUS_CONFIG = {
  scheduled: { bg: "bg-blue-50", text: "text-blue-700", label: "Scheduled" },
  in_progress: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "In Progress",
  },
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-600", label: "Cancelled" },
  overdue: { bg: "bg-red-50", text: "text-red-700", label: "Overdue" },
};

// ---- Skeleton ----
function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

// ---- Stat Card ----
function StatCard({ icon: Icon, label, value, sub, colorClass }) {
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
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ---- Schedule Modal ----
function ScheduleModal({ isOpen, onClose, onSchedule, itemsList, technicians, isSubmitting }) {
  const emptyForm = () => ({
    itemId: "",
    type: "repair",
    date: todayISO(),
    technicianId: "",
    cost: "",
    notes: "",
  });
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (isOpen) setForm(emptyForm());
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.itemId || !form.date) {
      toast.error("Please fill in all required fields");
      return;
    }
    onSchedule({
      item_id: Number(form.itemId),
      type: form.type,
      scheduled_date: form.date,
      technician_id: form.technicianId ? Number(form.technicianId) : null,
      cost: form.cost === "" ? 0 : Number(form.cost),
      notes: form.notes.trim() || null,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="card w-full max-w-lg p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Schedule Maintenance
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Create a new maintenance record
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost p-2 rounded-lg min-h-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="label" htmlFor="m-item">
                Equipment *
              </label>
              <select
                id="m-item"
                className="input"
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                required
              >
                <option value="">Select equipment...</option>
                {itemsList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (#{item.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="m-type">
                Maintenance Type *
              </label>
              <select
                id="m-type"
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="m-date">
                Scheduled Date *
              </label>
              <DatePicker
                id="m-date"
                value={form.date}
                onChange={(date) => setForm({ ...form, date })}
                ariaLabel="Scheduled date"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="m-tech">
                  Technician
                </label>
                <select
                  id="m-tech"
                  className="input"
                  value={form.technicianId}
                  onChange={(e) => setForm({ ...form, technicianId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="m-cost">
                  Estimated Cost ({CURRENCY})
                </label>
                <input
                  id="m-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder="0"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="m-notes">
                Notes
              </label>
              <textarea
                id="m-notes"
                className="input min-h-[100px] resize-y"
                placeholder="Describe the maintenance needed..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary flex-1"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Scheduling...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Detail Modal ----
const NEXT_ACTIONS = {
  scheduled: [
    { status: "in_progress", label: "Start", className: "btn-primary" },
    { status: "cancelled", label: "Cancel Job", className: "btn-secondary" },
  ],
  in_progress: [
    { status: "completed", label: "Mark Completed", className: "btn-primary" },
    { status: "cancelled", label: "Cancel Job", className: "btn-secondary" },
  ],
};

function DetailModal({ record, isOpen, onClose, isAdmin, onUpdate, onDelete, isSaving }) {
  const [cost, setCost] = useState("");
  const [nextDue, setNextDue] = useState("");

  useEffect(() => {
    if (record) {
      setCost(String(record.cost ?? 0));
      setNextDue(record.next_due || "");
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const actions = isAdmin ? NEXT_ACTIONS[record.status] || [] : [];
  const handleAction = (status) => {
    const body = { status };
    if (status === "completed") {
      body.cost = cost === "" ? 0 : Number(cost);
      body.next_due = nextDue || null;
    }
    onUpdate(record.id, body);
  };

  const TypeIcon = TYPE_ICONS[record.type]?.icon || Wrench;
  const TypeColor =
    TYPE_ICONS[record.type]?.color || "bg-gray-50 text-gray-600";
  const statusConfig = STATUS_CONFIG[displayStatus(record)] || STATUS_CONFIG.scheduled;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card w-full max-w-md p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              Maintenance Details
            </h3>
            <button
              onClick={onClose}
              className="btn btn-ghost p-2 rounded-lg min-h-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  TypeColor,
                )}
              >
                <TypeIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {record.item_name || `Item #${record.item_id}`}
                </p>
                <p className="text-sm text-gray-500">
                  {TYPE_LABELS[record.type] || record.type}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Status</span>
                <span
                  className={cn(
                    "ml-2 badge",
                    statusConfig.bg,
                    statusConfig.text,
                  )}
                >
                  {statusConfig.label}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Date</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatDate(record.scheduled_date)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Cost</span>
                <span className="ml-2 font-medium text-gray-900">
                  {money(record.cost)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Technician</span>
                <span className="ml-2 font-medium text-gray-900">
                  {record.technician_name || "Unassigned"}
                </span>
              </div>
            </div>

            {record.completed_at && (
              <div className="text-sm">
                <span className="text-gray-500">Completed</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatDate(record.completed_at)}
                </span>
              </div>
            )}

            {record.next_due && (
              <div className="text-sm">
                <span className="text-gray-500">Next Due</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatDate(record.next_due)}
                </span>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                {record.notes || "No notes provided."}
              </p>
            </div>

            {actions.some((a) => a.status === "completed") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="d-cost">
                    Final Cost ({CURRENCY})
                  </label>
                  <input
                    id="d-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="d-next">
                    Next Due
                  </label>
                  <DatePicker
                    id="d-next"
                    value={nextDue}
                    onChange={setNextDue}
                    ariaLabel="Next due date"
                  />
                </div>
              </div>
            )}

            {actions.length > 0 && (
              <div className="flex gap-3">
                {actions.map((a) => (
                  <button
                    key={a.status}
                    disabled={isSaving}
                    onClick={() => handleAction(a.status)}
                    className={cn("btn flex-1", a.className)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              {isAdmin && (
                <button
                  disabled={isSaving}
                  onClick={() => onDelete(record.id)}
                  className="btn btn-ghost text-red-600 flex-1"
                >
                  Delete
                </button>
              )}
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Main Component ----
export default function Maintenance() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const {
    data: records = [],
    isLoading: recordsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => maintenanceService.listRecords(),
  });
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items", { limit: 1000 }],
    queryFn: () => itemService.listItems({ limit: 1000 }),
  });
  // Listing users is admin-only; technicians are only needed for scheduling.
  const { data: technicians = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => userService.listUsers({ limit: 500 }),
    enabled: isAdmin,
  });
  const loading = recordsLoading || itemsLoading;
  const selectedRecord = records.find((r) => r.id === selectedId) || null;

  const onMutationError = (err) => toast.error(err.message || "Something went wrong");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["maintenance"] });

  const createMutation = useMutation({
    mutationFn: (body) => maintenanceService.createRecord(body),
    onSuccess: () => {
      refresh();
      setShowScheduleModal(false);
      toast.success("Maintenance scheduled successfully");
    },
    onError: onMutationError,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => maintenanceService.updateRecord(id, body),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Marked as ${STATUS_CONFIG[updated.status]?.label || updated.status}`);
    },
    onError: onMutationError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => maintenanceService.deleteRecord(id),
    onSuccess: () => {
      refresh();
      setSelectedId(null);
      toast.success("Maintenance record deleted");
    },
    onError: onMutationError,
  });

  const stats = useMemo(() => {
    const total = items.length;
    const inProgress = records.filter((r) => r.status === "in_progress").length;
    const scheduled = records.filter((r) => r.status === "scheduled").length;
    const now = new Date();
    const thisMonth = records.filter((r) => {
      if (r.status !== "completed" || !r.completed_at) return false;
      const d = new Date(r.completed_at);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    return { total, inProgress, scheduled, completedThisMonth: thisMonth };
  }, [records, items.length]);

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    if (activeTab !== "all") {
      if (activeTab === "in_progress") {
        filtered = filtered.filter((r) => r.status === "in_progress");
      } else {
        filtered = filtered.filter((r) => r.status === activeTab);
      }
    }
    filtered.sort((a, b) => {
      const value = (r) =>
        sortField === "date"
          ? new Date(r.scheduled_date).getTime()
          : Number(r[sortField]) || 0;
      const aVal = value(a);
      const bVal = value(b);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return filtered;
  }, [records, activeTab, sortField, sortDir]);

  const handleDelete = (id) => {
    if (window.confirm("Delete this maintenance record?")) deleteMutation.mutate(id);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Loading state
  if (loading) {
    return (
      <PageTransition>
        <div className="page-container space-y-6">
          <div className="page-header">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-11 w-48 rounded-lg" />
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
          <div className="card space-y-4">
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-lg" />
              ))}
            </div>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (isError) {
    return (
      <PageTransition>
        <div className="page-container">
          <div className="card flex flex-col items-center py-16 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">
              Failed to load maintenance records
            </h3>
            <p className="text-sm text-gray-500 mt-1">{error?.message}</p>
            <button onClick={() => refetch()} className="btn btn-primary mt-4">
              Retry
            </button>
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
            <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track equipment maintenance, calibrations, and repairs
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              Schedule Maintenance
            </button>
          )}
        </div>

        {/* Stat Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            icon={Package}
            label="Total Equipment"
            value={stats.total}
            colorClass="bg-primary-50 text-primary-600"
          />
          <StatCard
            icon={Clock}
            label="In Maintenance"
            value={stats.inProgress}
            colorClass="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={Calendar}
            label="Scheduled"
            value={stats.scheduled}
            colorClass="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Completed This Month"
            value={stats.completedThisMonth}
            colorClass="bg-green-50 text-green-600"
          />
        </motion.div>

        {/* Tabs */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center border-b border-gray-100 px-2">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-500",
                  activeTab === tab.id
                    ? "text-primary-600"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="maintenance-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    transition={{ duration: 0.2 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                <Wrench className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No records found
              </h3>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                {activeTab === "all"
                  ? "No maintenance records yet."
                  : `No ${activeTab.replace("_", " ")} records found.`}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="btn btn-primary mt-4"
                >
                  <Plus className="h-4 w-4" />
                  Schedule Maintenance
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Sort controls */}
              <div className="flex items-center gap-2 px-6 pt-4 pb-2">
                <span className="text-xs text-gray-400">Sort by:</span>
                <button
                  onClick={() => handleSort("date")}
                  className={cn(
                    "btn btn-ghost text-xs min-h-0 py-1.5 px-3",
                    sortField === "date" && "bg-gray-100 text-gray-900",
                  )}
                >
                  Date
                  {sortField === "date" && (
                    <ArrowUpDown
                      className={cn(
                        "h-3 w-3 ml-1",
                        sortDir === "asc" && "rotate-180",
                      )}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort("cost")}
                  className={cn(
                    "btn btn-ghost text-xs min-h-0 py-1.5 px-3",
                    sortField === "cost" && "bg-gray-100 text-gray-900",
                  )}
                >
                  Cost
                  {sortField === "cost" && (
                    <ArrowUpDown
                      className={cn(
                        "h-3 w-3 ml-1",
                        sortDir === "asc" && "rotate-180",
                      )}
                    />
                  )}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Equipment
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Type
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Status
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Date
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Cost
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Technician
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRecords.map((record, idx) => {
                      const typeInfo =
                        TYPE_ICONS[record.type] || TYPE_ICONS.repair;
                      const TypeIconComp = typeInfo.icon;
                      const statusInfo =
                        STATUS_CONFIG[displayStatus(record)] || STATUS_CONFIG.scheduled;

                      return (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          onClick={() => setSelectedId(record.id)}
                          className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                                <Package className="h-4 w-4 text-gray-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {record.item_name || `Item #${record.item_id}`}
                                </p>
                                <p className="text-xs text-gray-400">
                                  #{record.item_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={cn("badge", typeInfo.color)}>
                              <TypeIconComp className="h-3 w-3" />
                              {TYPE_LABELS[record.type] || record.type}
                            </div>
                          </td>
                          <td className="px-6 py-4">
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
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(record.scheduled_date)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {money(record.cost)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {record.technician_name || "Unassigned"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px]">
                            {truncate(record.notes || "—", 50)}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={(body) => createMutation.mutate(body)}
          itemsList={items}
          technicians={technicians.filter((u) => u.is_active)}
          isSubmitting={createMutation.isPending}
        />

        <DetailModal
          record={selectedRecord}
          isOpen={!!selectedRecord}
          onClose={() => setSelectedId(null)}
          isAdmin={isAdmin}
          onUpdate={(id, body) => updateMutation.mutate({ id, body })}
          onDelete={handleDelete}
          isSaving={updateMutation.isPending || deleteMutation.isPending}
        />
      </div>
    </PageTransition>
  );
}
