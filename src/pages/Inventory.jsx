import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  SlidersHorizontal,
  Grid3X3,
  List,
  Plus,
  Download,
  Upload,
  Heart,
  QrCode,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Package,
  ArrowUpDown,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageTransition from "../components/PageTransition";
import AddItemModal from "../components/AddItemModal";
import EditItemModal from "../components/EditItemModal";
import { ConfirmDialog } from "../components/ui";
import {
  cn,
  formatDate,
  formatCurrency,
  getStatusColor,
  getConditionColor,
  truncate,
  getPlaceholderImage,
} from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { itemService } from "../services/itemService";
import { locationService } from "../services/locationService";

const statuses = ["All Statuses", "Available", "Borrowed", "Retired"];

// Backend has no per-item pagination UI here — this fetches "all" items for
// client-side search/filter/sort. Must stay comfortably above the real
// catalog size (224 seeded items) or items silently disappear from the page.
const FETCH_ALL_LIMIT = 1000;

const ITEMS_PER_PAGE = 12;

function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

function Badge({ children, className }) {
  return <span className={cn("badge", className)}>{children}</span>;
}

export default function Inventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const debounceRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const {
    data: apiItems = [],
    isLoading: itemsLoading,
    isError: itemsError,
  } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.listItems({ limit: FETCH_ALL_LIMIT }),
  });

  const { data: locationList = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.listLocations,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => itemService.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats-summary"] });
      queryClient.invalidateQueries({ queryKey: ["stats-lowstock"] });
      toast.success("Item deleted");
      setDeleteTarget(null);
      setSelectedItems((prev) => {
        if (!deleteTarget) return prev;
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
    },
    onError: (err) => toast.error(err.message || "Failed to delete item"),
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const enrichedItems = useMemo(
    () =>
      apiItems.map((item) => ({
        ...item,
        quantity: item.total_quantity,
        availableQuantity: item.available_quantity,
        image: item.image_url || getPlaceholderImage(item),
        qrCode: `QR-${item.id}`,
        value: 0,
        borrowCount: 0,
        brand: "",
        model: "",
        subcategory: item.category,
        serialNumber: "",
        favorite: false,
        tags: item.category ? [item.category] : [],
        status: !item.is_active
          ? "retired"
          : item.available_quantity > 0
            ? "available"
            : "borrowed",
        condition: "good",
        specs: {},
        purchaseDate: item.created_at,
        lastMaintenance: null,
        nextMaintenance: null,
        description: item.description || "",
        locationId: item.location_id,
        createdAt: item.created_at,
      })),
    [apiItems],
  );

  const categories = useMemo(
    () => [...new Set(apiItems.map((i) => i.category).filter(Boolean))],
    [apiItems],
  );

  const locationMap = useMemo(() => {
    const map = {};
    locationList.forEach((l) => {
      map[l.id] = l.name;
    });
    return map;
  }, [locationList]);

  const filteredItems = useMemo(() => {
    let result = [...enrichedItems];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.category || "").toLowerCase().includes(q) ||
          (locationMap[item.locationId] || "").toLowerCase().includes(q) ||
          item.qrCode.toLowerCase().includes(q) ||
          (item.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (categoryFilter !== "All Categories") {
      result = result.filter((item) => item.category === categoryFilter);
    }
    if (locationFilter !== "All Locations") {
      result = result.filter(
        (item) => locationMap[item.locationId] === locationFilter,
      );
    }
    if (statusFilter === "All Statuses") {
      // Retired items are hidden by default — the "All Statuses" option
      // means "everything currently in active circulation", not literally
      // every row. Pick the explicit "Retired" filter to see those.
      result = result.filter((item) => item.status !== "retired");
    } else {
      result = result.filter(
        (item) => item.status === statusFilter.toLowerCase().replace(" ", "-"),
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "category":
          cmp = (a.category || "").localeCompare(b.category || "");
          break;
        case "date":
          cmp = new Date(a.purchaseDate) - new Date(b.purchaseDate);
          break;
        case "quantity":
          cmp = a.quantity - b.quantity;
          break;
        case "value":
          cmp = a.value - b.value;
          break;
        default:
          cmp = 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    enrichedItems,
    debouncedSearch,
    categoryFilter,
    locationFilter,
    statusFilter,
    sortBy,
    sortDir,
    locationMap,
  ]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const toggleSelectAll = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map((i) => i.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategoryFilter("All Categories");
    setLocationFilter("All Locations");
    setStatusFilter("All Statuses");
    setSortBy("name");
    setSortDir("asc");
    setPage(1);
  };

  const hasActiveFilters =
    categoryFilter !== "All Categories" ||
    locationFilter !== "All Locations" ||
    statusFilter !== "All Statuses" ||
    debouncedSearch !== "";

  if (itemsLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
          <Skeleton className="h-11 w-full rounded-md" />
          <div className="flex gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (itemsError) {
    return (
      <PageTransition>
        <div className="card text-center py-20">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">
            Failed to Load Inventory
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Could not fetch items from the server. Please try again later.
          </p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}{" "}
              found
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.success("Import dialog would open")}
              className="btn btn-outline text-sm px-3"
            >
              <Upload className="h-4 w-4" /> Import
            </button>
            <button
              onClick={() => toast.success("Exporting inventory...")}
              className="btn btn-outline text-sm px-3"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary text-sm px-3"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Search + View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, category, location, or QR code..."
              className="input pl-10"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "btn btn-outline text-sm px-3 min-h-[44px]",
                showFilters &&
                "bg-primary-50 border-primary-300 text-primary-700",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-accent-500 ml-0.5" />
              )}
            </button>
            <div className="flex rounded-md border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2.5 min-h-[44px] flex items-center",
                  viewMode === "grid"
                    ? "bg-primary-50 text-primary-600"
                    : "bg-white text-gray-400 hover:text-gray-600",
                )}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2.5 min-h-[44px] flex items-center",
                  viewMode === "list"
                    ? "bg-primary-50 text-primary-600"
                    : "bg-white text-gray-400 hover:text-gray-600",
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="card p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setPage(1);
                      }}
                      className="input"
                    >
                      <option value="All Categories">All Categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Location</label>
                    <select
                      value={locationFilter}
                      onChange={(e) => {
                        setLocationFilter(e.target.value);
                        setPage(1);
                      }}
                      className="input"
                    >
                      <option value="All Locations">All Locations</option>
                      {locationList.map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                      className="input"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Sort by:</span>
                    {["name", "category", "date", "quantity"].map((field) => (
                      <button
                        key={field}
                        onClick={() => handleSort(field)}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-full font-medium transition-colors min-h-[36px]",
                          sortBy === field
                            ? "bg-primary-100 text-primary-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        )}
                      >
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                        {sortBy === field && (
                          <ArrowUpDown className="h-3 w-3 inline ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-xs text-accent-600 hover:text-accent-700 font-medium"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedItems.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card bg-primary-50/50 border-primary-200 flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-primary-600" />
                <span className="text-sm font-medium text-primary-700">
                  {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""}{" "}
                  selected
                </span>
                <button
                  onClick={() => setSelectedItems(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Deselect all
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const selected = enrichedItems.filter((i) => selectedItems.has(i.id));
                    navigate('/borrow', { state: { selectedItems: selected } });
                  }}
                  className="btn btn-primary text-sm px-3 h-9"
                >
                  Borrow Selected
                </button>
                <button
                  onClick={() => toast.success("Exporting selected items...")}
                  className="btn btn-outline text-sm px-3 h-9"
                >
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card text-center py-20"
          >
            <Package className="h-14 w-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">
              No items match your filters
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Try adjusting your search or filter criteria.
            </p>
            <button
              onClick={resetFilters}
              className="btn btn-outline mt-4 text-sm"
            >
              Reset Filters
            </button>
          </motion.div>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedItems.map((item, idx) => {
              const isSelected = selectedItems.has(item.id);
              const isFav = favorites.has(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={cn(
                    "card group relative",
                    isSelected && "ring-2 ring-primary-400",
                  )}
                >
                  {/* Select checkbox */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSelect(item.id);
                    }}
                    className={cn(
                      "absolute top-3 left-3 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-primary-500 border-primary-500 text-white"
                        : "bg-white/90 border-gray-300 hover:border-primary-400",
                    )}
                    aria-label={`Select ${item.name}`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>

                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(item.id);
                    }}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors shadow-sm"
                    aria-label={`Favorite ${item.name}`}
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isFav ? "fill-red-400 text-red-400" : "text-gray-400",
                      )}
                    />
                  </button>

                  <Link to={`/inventory/${item.id}`} className="block">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 mb-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {item.name}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="badge badge-neutral text-[10px]">
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
                        <span
                          className={cn(
                            "badge text-[10px]",
                            getConditionColor(item.condition),
                          )}
                        >
                          {item.condition}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 truncate text-xs">
                          {locationMap[item.locationId] || "Unknown"}
                        </span>
                        <span className="font-medium text-gray-900 text-xs">
                          Qty: {item.quantity}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <QrCode className="h-3 w-3" /> {item.qrCode}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingItem(item);
                                }}
                                className="btn btn-outline p-1.5 h-8 w-8 min-h-0"
                                aria-label={`Edit ${item.name}`}
                                title="Edit item"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeleteTarget(item);
                                }}
                                className="btn btn-outline p-1.5 h-8 w-8 min-h-0 text-red-500 hover:bg-red-50 hover:border-red-200"
                                aria-label={`Delete ${item.name}`}
                                title="Delete item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate('/borrow', { state: { selectedItem: item } });
                            }}
                            className="btn btn-primary text-xs px-3 py-1.5 h-8"
                          >
                            Borrow
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-3 px-4 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          selectedItems.size === paginatedItems.length &&
                            paginatedItems.length > 0
                            ? "bg-primary-500 border-primary-500 text-white"
                            : "border-gray-300 hover:border-primary-400",
                        )}
                      >
                        {selectedItems.size === paginatedItems.length &&
                          paginatedItems.length > 0 && (
                            <Check className="h-3 w-3" />
                          )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-left font-medium text-gray-500">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 hover:text-gray-700 min-h-[32px]"
                      >
                        Name{" "}
                        {sortBy === "name" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-left font-medium text-gray-500 hidden md:table-cell">
                      <button
                        onClick={() => handleSort("category")}
                        className="flex items-center gap-1 hover:text-gray-700 min-h-[32px]"
                      >
                        Category{" "}
                        {sortBy === "category" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-left font-medium text-gray-500 hidden sm:table-cell">
                      Status
                    </th>
                    <th className="py-3 px-3 text-left font-medium text-gray-500 hidden lg:table-cell">
                      Condition
                    </th>
                    <th className="py-3 px-3 text-left font-medium text-gray-500 hidden xl:table-cell">
                      Location
                    </th>
                    <th className="py-3 px-3 text-right font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="py-3 px-3 text-right font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => {
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          "border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                          isSelected && "bg-primary-50/30",
                        )}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-primary-500 border-primary-500 text-white"
                                : "border-gray-300 hover:border-primary-400",
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <Link
                            to={`/inventory/${item.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-gray-100"
                              loading="lazy"
                            />
                            <span className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors truncate max-w-[200px]">
                              {item.name}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-gray-500 hidden md:table-cell">
                          <span className="badge badge-neutral text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell">
                          <span
                            className={cn(
                              "badge text-[10px]",
                              getStatusColor(item.status),
                            )}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 hidden lg:table-cell">
                          <span
                            className={cn(
                              "badge text-[10px]",
                              getConditionColor(item.condition),
                            )}
                          >
                            {item.condition}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-xs hidden xl:table-cell">
                          {locationMap[item.locationId] || "Unknown"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={cn(
                              "font-medium",
                              item.quantity <= 2
                                ? "text-red-600"
                                : "text-gray-900",
                            )}
                          >
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => toggleFavorite(item.id)}
                              className="btn btn-ghost p-2"
                              aria-label={`Favorite ${item.name}`}
                            >
                              <Heart
                                className={cn(
                                  "h-4 w-4",
                                  favorites.has(item.id)
                                    ? "fill-red-400 text-red-400"
                                    : "text-gray-400",
                                )}
                              />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="btn btn-ghost p-2"
                                  aria-label={`Edit ${item.name}`}
                                  title="Edit item"
                                >
                                  <Pencil className="h-4 w-4 text-gray-400" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(item)}
                                  className="btn btn-ghost p-2 text-red-500 hover:bg-red-50"
                                  aria-label={`Delete ${item.name}`}
                                  title="Delete item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/borrow', { state: { selectedItem: item } });
                              }}
                              className="btn btn-primary text-xs px-3 py-1.5 h-8"
                            >
                              Borrow
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({filteredItems.length} items)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-ghost p-2 disabled:opacity-30 min-h-[44px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-10 h-10 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center",
                      page === pageNum
                        ? "bg-primary-500 text-white"
                        : "text-gray-600 hover:bg-gray-100",
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-ghost p-2 disabled:opacity-30 min-h-[44px]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddItemModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <EditItemModal
        open={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete item"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from the inventory? It will be hidden from listings but its borrow history is kept.`
            : ""
        }
        confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete"}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageTransition>
  );
}
