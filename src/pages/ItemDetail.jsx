import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  Share2,
  QrCode,
  Printer,
  Wrench,
  AlertTriangle,
  Package,
  MapPin,
  Calendar,
  DollarSign,
  BarChart3,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Shield,
  Download,
  Play,
  Pause,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
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
  getPlaceholderImage,
} from "../lib/utils";
import { itemService } from "../services/itemService";
import { locationService } from "../services/locationService";
import { borrowService } from "../services/borrowService";

function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

const actionIcons = {
  borrowed: ArrowLeftRight,
  returned: CheckCircle,
  maintenance: Wrench,
  reserved: Calendar,
  "in-use": Package,
};

const actionColors = {
  borrowed: "bg-blue-50 text-blue-600",
  returned: "bg-green-50 text-green-600",
  maintenance: "bg-amber-50 text-amber-600",
  reserved: "bg-purple-50 text-purple-600",
  "in-use": "bg-primary-50 text-primary-600",
};

const maintTypeIcons = {
  repair: AlertTriangle,
  calibration: Wrench,
  replacement: Package,
  inspection: Shield,
};

function enrichItem(apiItem) {
  if (!apiItem) return null;
  return {
    ...apiItem,
    quantity: apiItem.total_quantity,
    availableQuantity: apiItem.available_quantity,
    image: apiItem.image_url || getPlaceholderImage(apiItem),
    images: apiItem.image_url ? [apiItem.image_url] : null,
    qrCode: `QR-${apiItem.id}`,
    value: 0,
    borrowCount: 0,
    brand: "",
    model: "",
    subcategory: apiItem.category,
    serialNumber: "",
    favorite: false,
    tags: apiItem.category ? [apiItem.category] : [],
    status: !apiItem.is_active
      ? "retired"
      : apiItem.available_quantity > 0
        ? "available"
        : "borrowed",
    condition: "good",
    specs: {},
    purchaseDate: apiItem.created_at,
    createdAt: apiItem.created_at,
    lastCalibrated: null,
    lastMaintenance: null,
    nextMaintenance: null,
    description: apiItem.description || "",
    locationId: apiItem.location_id,
  };
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [relatedScroll, setRelatedScroll] = useState(0);

  const {
    data: apiItem,
    isLoading: itemLoading,
    isError: itemError,
  } = useQuery({
    queryKey: ["item", id],
    queryFn: () => itemService.getItem(id),
    enabled: !!id,
  });

  const enrichedItem = useMemo(() => enrichItem(apiItem), [apiItem]);

  const { data: locationList = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.listLocations,
  });

  const { data: apiTransactions = [] } = useQuery({
    queryKey: ["transactions", id],
    queryFn: () => borrowService.listTransactions({ item_id: id }),
    enabled: !!id,
  });

  const { data: relatedApiItems = [] } = useQuery({
    queryKey: ["items", "category", enrichedItem?.category],
    queryFn: () =>
      itemService.listItems({
        category: enrichedItem.category,
        limit: 1000,
      }),
    enabled: !!enrichedItem?.category,
  });

  if (itemLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <Skeleton className="h-8 w-24 rounded-md" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <Skeleton className="aspect-[4/3] rounded-lg mb-3" />
              <div className="flex gap-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="w-20 h-16 rounded-md" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-7 w-72" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-32 rounded-md" />
                ))}
              </div>
              <Skeleton className="h-32 rounded-lg" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (itemError || (!itemLoading && !enrichedItem)) {
    return (
      <PageTransition>
        <div className="card text-center py-20">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">
            Item Not Found
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            The item you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/inventory" className="btn btn-primary mt-6 inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Link>
        </div>
      </PageTransition>
    );
  }

  const item = enrichedItem;

  const locationMap = {};
  locationList.forEach((l) => {
    locationMap[l.id] = l.name;
  });

  const borrowHistory = apiTransactions.map((txn) => ({
    ...txn,
    type: txn.status === "returned" ? "return" : "borrow",
    user: { name: txn.user_id || "Unknown" },
    purpose: txn.note || "",
    borrowDate: txn.borrowed_at,
  }));

  const maintenanceHistory = [];

  // `id` comes from useParams() as a string, `i.id` from the API as a
  // number — compare as strings so the current item is actually excluded
  // from its own "related items" list instead of always passing the filter.
  const relatedItems = relatedApiItems
    .filter((i) => String(i.id) !== id)
    .slice(0, 6)
    .map((i) => enrichItem(i));

  const recommendedItems = [];

  const locationObj = locationList.find((l) => l.id === item.locationId);
  const locationName = locationObj ? locationObj.name : "Unknown Location";
  const statusColor = getStatusColor(item.status);
  const conditionColor = getConditionColor(item.condition);

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/inventory")}
          className="btn btn-ghost text-sm px-3 inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </button>

        {/* Top Section - Image + Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 mb-3 relative group">
              <img
                src={(item.images && item.images[activeImage]) || item.image}
                alt={item.name}
                className="w-full h-full object-cover"
              />
              {item.images && item.images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActiveImage((p) =>
                        p === 0 ? item.images.length - 1 : p - 1,
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveImage((p) =>
                        p === item.images.length - 1 ? 0 : p + 1,
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-700" />
                  </button>
                </>
              )}
            </div>
            {item.images && item.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {item.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      "w-20 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 transition-all",
                      idx === activeImage
                        ? "ring-2 ring-primary-500 ring-offset-1"
                        : "opacity-60 hover:opacity-100",
                    )}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
          >
            {/* Name + Badges */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {item.name}
                </h1>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setIsFav(!isFav)}
                    className="btn btn-ghost p-2"
                    aria-label="Favorite"
                  >
                    <Heart
                      className={cn(
                        "h-5 w-5",
                        isFav ? "fill-red-400 text-red-400" : "text-gray-400",
                      )}
                    />
                  </button>
                  <button
                    onClick={() => toast.success("Link copied to clipboard")}
                    className="btn btn-ghost p-2"
                    aria-label="Share"
                  >
                    <Share2 className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="badge badge-neutral">{item.category}</span>
                <span className={cn("badge", statusColor)}>{item.status}</span>
                <span className={cn("badge", conditionColor)}>
                  {item.condition}
                </span>
                {item.tags &&
                  item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="badge bg-gray-50 text-gray-500 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Package,
                  label: "Quantity",
                  value: item.quantity,
                  sub: item.quantity <= 2 ? "Low stock" : null,
                  alert: item.quantity <= 2,
                },
                {
                  icon: BarChart3,
                  label: "Condition",
                  value: item.condition,
                  color: conditionColor,
                },
                {
                  icon: MapPin,
                  label: "Location",
                  value: locationName,
                },
                {
                  icon: DollarSign,
                  label: "Value",
                  value: formatCurrency(item.value),
                },
                {
                  icon: ArrowLeftRight,
                  label: "Times Borrowed",
                  value: item.borrowCount,
                },
                {
                  icon: Calendar,
                  label: "Added",
                  value: formatDate(item.createdAt),
                },
              ].map((stat, idx) => (
                <div key={idx} className="card p-3 flex items-start gap-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                      stat.alert
                        ? "bg-red-50 text-red-600"
                        : "bg-gray-50 text-gray-500",
                    )}
                  >
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        stat.color
                          ? getStatusColor(stat.value)?.includes("success")
                            ? "text-green-700"
                            : "text-gray-900"
                          : "text-gray-900",
                      )}
                    >
                      {stat.value}
                    </p>
                    {stat.sub && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {stat.sub}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  toast.success(`${item.name} added to borrow list`)
                }
                className="btn btn-primary text-sm"
              >
                <ArrowLeftRight className="h-4 w-4" /> Borrow
              </button>
              <button
                onClick={() => toast.success("Return request submitted")}
                className="btn btn-outline text-sm"
              >
                <CheckCircle className="h-4 w-4" /> Return
              </button>
              <button
                onClick={() => toast.success("Reservation confirmed")}
                className="btn btn-outline text-sm"
              >
                <Calendar className="h-4 w-4" /> Reserve
              </button>
              <button
                onClick={() => toast.success("Damage report submitted")}
                className="btn btn-outline text-sm text-red-600 hover:bg-red-50"
              >
                <AlertTriangle className="h-4 w-4" /> Report Issue
              </button>
              <button
                onClick={() => toast.success("Maintenance request created")}
                className="btn btn-outline text-sm"
              >
                <Wrench className="h-4 w-4" /> Maintenance
              </button>
              <button
                onClick={() => toast.success("QR code ready to print")}
                className="btn btn-outline text-sm"
              >
                <Printer className="h-4 w-4" /> Print QR
              </button>
            </div>
          </motion.div>
        </div>

        {/* Description & QR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card lg:col-span-2"
          >
            <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {item.description}
            </p>
            {item.lastCalibrated && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-blue-50/50 text-sm">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-blue-700">
                  Last calibrated: {formatDate(item.lastCalibrated)}
                </span>
              </div>
            )}
          </motion.div>

          {/* QR Code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card text-center"
          >
            <h3 className="font-semibold text-gray-900 mb-4">QR Code</h3>
            <div className="w-40 h-40 mx-auto bg-white rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center mb-3">
              <div className="text-center">
                <QrCode className="h-20 w-20 text-gray-800 mx-auto" />
              </div>
            </div>
            <p className="text-xs font-mono text-gray-500 mb-3">
              {item.qrCode}
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => toast.success("QR code downloaded")}
                className="btn btn-outline text-xs px-3 py-1.5"
              >
                <Download className="h-3 w-3" /> Download
              </button>
              <button
                onClick={() => toast.success("Ready to print")}
                className="btn btn-outline text-xs px-3 py-1.5"
              >
                <Printer className="h-3 w-3" /> Print
              </button>
            </div>
          </motion.div>
        </div>

        {/* Specifications */}
        {item.specs && Object.keys(item.specs).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h3 className="font-semibold text-gray-900 mb-4">Specifications</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(item.specs).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-gray-50">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {key}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Borrow History + Maintenance History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Borrow History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card"
          >
            <h3 className="font-semibold text-gray-900 mb-4">Borrow History</h3>
            {borrowHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No borrow history yet</p>
              </div>
            ) : (
              <div className="space-y-0">
                {borrowHistory.map((txn, idx) => (
                  <div
                    key={txn.id}
                    className={cn(
                      "flex items-center gap-3 py-3",
                      idx < borrowHistory.length - 1 &&
                        "border-b border-gray-50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
                        txn.type === "borrow"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-green-50 text-green-600",
                      )}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">
                          {txn.user?.name || "Unknown"}
                        </span>{" "}
                        <span className="text-gray-500">
                          {txn.type === "borrow" ? "borrowed" : "returned"}
                        </span>
                      </p>
                      {txn.purpose && (
                        <p className="text-xs text-gray-400 truncate">
                          {txn.purpose}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatRelative(txn.borrowDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Maintenance History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h3 className="font-semibold text-gray-900 mb-4">
              Maintenance History
            </h3>
            {maintenanceHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No maintenance history</p>
              </div>
            ) : (
              <div className="relative pl-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
                {maintenanceHistory.map((entry, idx) => {
                  const TypeIcon = maintTypeIcons[entry.type] || Wrench;
                  return (
                    <div key={entry.id} className="relative pb-6 last:pb-0">
                      <div className="absolute -left-[22px] top-1 w-4 h-4 rounded-full bg-white border-2 border-primary-300" />
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600 flex-shrink-0">
                          <TypeIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-gray-900 capitalize">
                              {entry.type}
                            </h4>
                            <span className="text-xs text-gray-400">
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {entry.notes}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-gray-400">
                              by {entry.technician}
                            </span>
                            {(entry.cost || 0) > 0 && (
                              <span className="text-[10px] font-medium text-gray-600">
                                {formatCurrency(entry.cost)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Related Equipment */}
        {relatedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Related Equipment</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setRelatedScroll((p) => Math.max(0, p - 1))}
                  className="btn btn-ghost p-1.5"
                  disabled={relatedScroll === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRelatedScroll((p) => p + 1)}
                  className="btn btn-ghost p-1.5"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
              {relatedItems.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/inventory/${rel.id}`}
                  className="flex-shrink-0 w-44 group"
                >
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 mb-2">
                    <img
                      src={rel.image}
                      alt={rel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                    {rel.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "badge text-[10px]",
                        getStatusColor(rel.status),
                      )}
                    >
                      {rel.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {rel.borrowCount} borrows
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recommended for You */}
        {recommendedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                You Might Also Need
              </h3>
              <Link
                to="/recommendations"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                View all recommendations
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recommendedItems.map((rec) => (
                <Link
                  key={rec.id}
                  to={`/inventory/${rec.id}`}
                  className="group p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <img
                    src={rec.image}
                    alt={rec.name}
                    className="w-full aspect-[4/3] rounded-md object-cover bg-gray-200 mb-2"
                    loading="lazy"
                  />
                  <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                    {rec.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge badge-neutral text-[10px]">
                      {rec.category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatCurrency(rec.value)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
