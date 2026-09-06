import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  ChevronRight,
  MapPin,
  Building2,
  DoorOpen,
  QrCode,
  Package,
  Layers,
  BarChart3,
  ShieldAlert,
  Maximize2,
  Plus,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import {
  cn,
  formatDate,
  formatCurrency,
  getStatusColor,
  getConditionColor,
  truncate,
  getPlaceholderImage,
} from "../lib/utils";
import { locationService } from "../services/locationService";
import { useAuth } from "../hooks/useAuth";

/* --- CONSTANTS --- */
const TYPE_ICONS = {
  building: Building2,
  floor: Layers,
  room: DoorOpen,
  storage: Package,
};
const TYPE_COLORS = {
  building: "text-primary-600 bg-primary-50",
  floor: "text-blue-600 bg-blue-50",
  room: "text-amber-600 bg-amber-50",
  storage: "text-purple-600 bg-purple-50",
};

/* --- SKELETONS --- */
function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
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

/* --- HELPER: infer location type from name --- */
function inferLocationType(name) {
  const n = name.toLowerCase();
  if (n.includes("building") || n.includes("hall") || n.includes("center"))
    return "building";
  if (n.includes("floor") || n.includes("level")) return "floor";
  if (n.includes("storage") || n.includes("cabinet") || n.includes("closet"))
    return "storage";
  return "room";
}

/* --- LOCATION DETAIL --- */
function LocationDetail({ location, items }) {
  if (!location) {
    return (
      <EmptyState
        icon={MapPin}
        title="Select a Location"
        description="Choose a location from the list to view its details and items."
      />
    );
  }

  const type = location.type || inferLocationType(location.name);
  const TypeIcon = TYPE_ICONS[type] || MapPin;
  const capacity = 50;
  const utilization =
    capacity > 0 ? Math.round((items.length / capacity) * 100) : 0;

  const enrichedItems = useMemo(() => {
    return items.map((item) => ({
      ...item,
      image: item.image_url || getPlaceholderImage(item),
      status: item.is_active
        ? item.available_quantity > 0
          ? "available"
          : "unavailable"
        : "retired",
      condition: "good",
      value: 0,
    }));
  }, [items]);

  return (
    <motion.div
      key={location.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Location header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl flex-shrink-0",
              TYPE_COLORS[type] || "text-gray-500 bg-gray-100",
            )}
          >
            <TypeIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{location.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={cn(
                  "badge capitalize",
                  type === "building" && "badge-primary",
                  type === "floor" && "badge-info",
                  type === "room" && "badge-warning",
                  type === "storage" && "badge-neutral",
                )}
              >
                {type}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              {location.description || "No description available."}
            </p>
          </div>

          {/* QR Code placeholder */}
          <div className="hidden sm:flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 flex-shrink-0">
            <QrCode className="h-10 w-10 text-gray-300" />
            <span className="text-[10px] text-gray-400 font-mono">
              QR-LOC-{location.id}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
              <Maximize2 className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Capacity</p>
              <p className="text-lg font-bold text-gray-900">{capacity}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Current Items</p>
              <p className="text-lg font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50">
              <BarChart3 className="h-4 w-4 text-accent-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Utilization</p>
              <p className="text-lg font-bold text-gray-900">{utilization}%</p>
              <div className="mt-1.5 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(utilization, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    utilization > 80
                      ? "bg-red-400"
                      : utilization > 50
                        ? "bg-accent-400"
                        : "bg-primary-400",
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items at this location */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Items at this Location ({items.length})
        </h3>

        {items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Items Here"
            description="This location currently has no items assigned."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrichedItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                className="card card-interactive p-4"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-gray-400">
                        {item.category}
                      </span>
                      <span
                        className={cn(
                          "badge text-[10px]",
                          getStatusColor(item.status),
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                      <span>
                        {item.available_quantity}/{item.total_quantity} avail.
                      </span>
                      <span>{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* --- MAIN PAGE --- */
export default function Locations() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  const {
    data: locationList = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.listLocations,
  });

  const { data: locationItems = [] } = useQuery({
    queryKey: ["location-items", selectedId],
    queryFn: () => locationService.getLocationItems(selectedId),
    enabled: !!selectedId,
  });

  // ── Mutations for admin ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: locationService.createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location created");
      setShowForm(false);
    },
    onError: (err) => toast.error(err.message || "Failed to create location"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => locationService.updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location updated");
      setShowForm(false);
      setEditingLocation(null);
    },
    onError: (err) => toast.error(err.message || "Failed to update location"),
  });

  const deleteMutation = useMutation({
    mutationFn: locationService.deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      if (selectedId === editingLocation?.id) setSelectedId(null);
      toast.success("Location deleted");
      setEditingLocation(null);
    },
    onError: (err) => toast.error(err.message || "Failed to delete location"),
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      description: form.description.value.trim() || null,
    };
    if (!data.name) return;

    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (loc) => {
    setEditingLocation(loc);
    setShowForm(true);
    // Pre-fill form — will be handled via defaultValue on inputs
  };

  const handleDelete = (loc) => {
    toast.custom(
      (t) => (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 max-w-sm">
          <p className="text-sm font-medium text-gray-900 mb-1">
            Delete &ldquo;{loc.name}&rdquo;?
          </p>
          <p className="text-xs text-gray-500 mb-3">
            This will deactivate the location. It can be restored later.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t)}
              className="btn btn-ghost min-h-0 py-1.5 px-3 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(t);
                deleteMutation.mutate(loc.id);
              }}
              className="btn bg-red-500 text-white min-h-0 py-1.5 px-3 text-xs hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const openCreateForm = () => {
    setEditingLocation(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLocation(null);
  };

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locationList;
    const q = searchQuery.toLowerCase();
    return locationList.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)),
    );
  }, [locationList, searchQuery]);

  const selectedLocation = useMemo(
    () => locationList.find((l) => l.id === selectedId),
    [locationList, selectedId],
  );

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleRetry = () => {
    // React Query will automatically retry on refetch
    window.location.reload();
  };

  return (
    <PageTransition>
      <div className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Locations
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse and manage lab locations and storage areas
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openCreateForm}
              className="btn btn-primary flex items-center gap-2 min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          )}
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Location list */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="card p-3 lg:sticky lg:top-6">
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  className="input pl-10 py-2.5 text-sm"
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Location list */}
              {isLoading ? (
                <ListSkeleton />
              ) : isError ? (
                <div className="p-4 text-sm text-red-500 text-center">
                  {error?.message || "Failed to load locations"}
                </div>
              ) : filteredLocations.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No Locations Found"
                  description="Try a different search term."
                />
              ) : (
                <div className="max-h-[60vh] overflow-y-auto scrollbar-thin -mx-1">
                  {filteredLocations.map((loc) => {
                    const type = inferLocationType(loc.name);
                    const TypeIcon = TYPE_ICONS[type] || MapPin;
                    const isSelected = selectedId === loc.id;
                    return (
                      <button
                        key={loc.id}
                        onClick={() => handleSelect(loc.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 min-h-[44px]",
                          isSelected
                            ? "bg-primary-50 text-primary-700 font-medium"
                            : "text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0",
                            TYPE_COLORS[type] || "text-gray-500 bg-gray-100",
                          )}
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{loc.name}</p>
                          <p className="text-[11px] text-gray-400 capitalize">
                            {type}
                          </p>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(loc);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                              title="Edit location"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(loc);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete location"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <ChevronRight
                          className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isSelected ? "text-primary-500" : "text-gray-300",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Location detail */}
          <div className="lg:col-span-8 xl:col-span-9">
            {isLoading ? (
              <DetailSkeleton />
            ) : isError ? (
              <div className="card flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
                  <ShieldAlert className="h-8 w-8 text-red-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-700">
                  Something went wrong
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {error?.message || "Failed to load locations"}
                </p>
                <button
                  onClick={handleRetry}
                  className="btn btn-outline mt-4 min-h-[44px]"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <LocationDetail
                location={selectedLocation}
                items={locationItems}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Create/Edit Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={closeForm}
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
                  {editingLocation ? "Edit Location" : "Add Location"}
                </h3>
                <button
                  onClick={closeForm}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="loc-name" className="label">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="loc-name"
                    name="name"
                    type="text"
                    required
                    className="input"
                    placeholder="e.g., Cabinet C3"
                    defaultValue={editingLocation?.name || ""}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="loc-desc" className="label">
                    Description
                  </label>
                  <textarea
                    id="loc-desc"
                    name="description"
                    rows={3}
                    className="input"
                    placeholder="Optional description..."
                    defaultValue={editingLocation?.description || ""}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="btn btn-ghost flex-1 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {editingLocation ? "Save Changes" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
