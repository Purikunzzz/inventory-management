import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ArrowLeftRight,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronDown,
  Calendar,
  User,
  BookOpen,
  Hash,
  FileText,
  Camera,
  Upload,
  QrCode,
  Trash2,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Info,
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
  getPlaceholderImage,
} from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";
import { borrowService } from "../services/borrowService";
import { itemService } from "../services/itemService";
import { Skeleton, EmptyState, ErrorState, ConfirmDialog, TableSkeleton } from "../components/ui";

/* --- TABS --- */
const TABS = [
  { id: "borrow", label: "Borrow", icon: ArrowLeftRight },
  { id: "return", label: "Return", icon: CheckCircle },
  { id: "my-items", label: "My Items", icon: Package },
  { id: "overdue", label: "Overdue", icon: AlertTriangle },
];

/* --- CONSTANTS --- */
const CONDITIONS = ["excellent", "good", "fair", "poor", "damaged"];

/* --- BORROW TAB --- */
function BorrowTab({ currentUser, items, borrowMutation, preselectedItem }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [course, setCourse] = useState("");
  const [professor, setProfessor] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const searchRef = useRef(null);
  const hasAutoSelected = useRef(false);

  // Auto-select item passed via navigation state.
  useEffect(() => {
    if (preselectedItem && !hasAutoSelected.current && items.length > 0) {
      const match = items.find((i) => i.id === preselectedItem.id);
      if (match) {
        setSelectedItem(match);
        setSearchQuery(match.name);
        hasAutoSelected.current = true;
      }
    }
  }, [preselectedItem, items]);

  const availableItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return items
      .filter(
        (i) =>
          i.is_active &&
          i.available_quantity > 0 &&
          (i.name.toLowerCase().includes(q) ||
            (i.category || "").toLowerCase().includes(q) ||
            String(i.id).toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [searchQuery, items]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectItem(item) {
    setSelectedItem(item);
    setShowResults(false);
    setSearchQuery(item.name);
    setQuantity(1);
  }

  function handleRequestBorrow() {
    if (!selectedItem) return;
    setShowConfirm(true);
  }

  function handleConfirmBorrow() {
    borrowMutation.mutate(
      {
        item_id: selectedItem.id,
        quantity,
        note: [purpose, course && `Course: ${course}`, professor && `Professor: ${professor}`]
          .filter(Boolean)
          .join(" | ") || null,
        due_date: expectedReturn ? new Date(expectedReturn).toISOString() : null,
      },
      {
        onSettled: () => {
          setShowConfirm(false);
          setSelectedItem(null);
          setSearchQuery("");
          setQuantity(1);
          setPurpose("");
          setCourse("");
          setProfessor("");
          setExpectedReturn("");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <label className="label">Search Available Items</label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-11 pr-10"
            placeholder="Search by name, category, tag..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
              setSelectedItem(null);
            }}
            onFocus={() => setShowResults(true)}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedItem(null);
                setShowResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showResults && searchQuery.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 mt-1 w-full rounded-lg border border-gray-100 bg-white shadow-elevated max-h-72 overflow-y-auto scrollbar-thin"
            >
              {availableItems.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">
                  No available items found
                </div>
              ) : (
                availableItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  >
                    <img
                      src={item.image || getPlaceholderImage(item)}
                      alt={item.name}
                      className="h-10 w-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.category} · {item.available_quantity} available
                      </p>
                    </div>
                    <span className={cn("badge", getStatusColor(item.status))}>
                      {item.available_quantity > 0 ? "Available" : "Out of stock"}
                    </span>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected Item Card */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="card"
          >
            <div className="flex items-start gap-4">
              <img
                src={selectedItem.image || getPlaceholderImage(selectedItem)}
                alt={selectedItem.name}
                className="h-20 w-20 rounded-xl object-cover flex-shrink-0 bg-gray-100"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  {selectedItem.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="badge badge-neutral">
                    {selectedItem.category}
                  </span>
                  <span
                    className={cn("badge", getStatusColor(selectedItem.status))}
                  >
                    {selectedItem.available_quantity} available
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                  {selectedItem.description}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Borrow Form */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-11 w-11 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    className="input text-center w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.min(
                          Math.max(1, parseInt(e.target.value) || 1),
                          selectedItem.available_quantity,
                        ),
                      )
                    }
                    min={1}
                    max={selectedItem.available_quantity}
                  />
                  <button
                    onClick={() =>
                      setQuantity(
                        Math.min(selectedItem.available_quantity, quantity + 1),
                      )
                    }
                    className="h-11 w-11 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-400">
                    of {selectedItem.available_quantity}
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Expected Return Date</label>
                <DatePicker
                  value={expectedReturn}
                  onChange={setExpectedReturn}
                  min={new Date().toISOString().split("T")[0]}
                  ariaLabel="Expected return date"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label">Purpose</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  placeholder="Describe what you'll use this item for..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="label">Course</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. ECE 301 - Embedded Systems"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Professor</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Dr. Sarah Chen"
                  value={professor}
                  onChange={(e) => setProfessor(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleRequestBorrow}
                disabled={
                  !expectedReturn || !purpose.trim() || borrowMutation.isPending
                }
                className="btn btn-primary min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Request Borrow
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Default state when no item selected */}
      {!selectedItem && !searchQuery && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 mb-4">
            <Search className="h-8 w-8 text-primary-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700">
            Search for an Item to Borrow
          </h3>
          <p className="mt-1 text-sm text-gray-400 max-w-xs">
            Search by name, category, or tag to find available items in the lab.
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Confirm Borrow Request"
        message={
          selectedItem
            ? `You are about to borrow "${selectedItem.name}" (${quantity}x). Return by ${formatDate(expectedReturn)}.`
            : ""
        }
        confirmLabel={
          borrowMutation.isPending ? "Processing..." : "Confirm Borrow"
        }
        onConfirm={handleConfirmBorrow}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

/* --- ITEM HELPER: find item by id --- */
function findItem(items, id) {
  return items.find((i) => i.id === id) || null;
}

/* --- RETURN TAB --- */
function ReturnTab({ currentUser, items, transactions, returnMutation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [condition, setCondition] = useState("good");
  const [damageNotes, setDamageNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const searchRef = useRef(null);

  const activeBorrows = useMemo(() => {
    return transactions.filter((t) => t.status === "borrowed");
  }, [transactions]);

  const filteredBorrows = useMemo(() => {
    if (!searchQuery.trim()) return activeBorrows;
    const q = searchQuery.toLowerCase();
    return activeBorrows.filter((t) => {
      const item = findItem(items, t.item_id);
      return (
        item &&
        (item.name.toLowerCase().includes(q) ||
          String(item.id).toLowerCase().includes(q) ||
          (item.category || "").toLowerCase().includes(q) ||
          (t.note && t.note.toLowerCase().includes(q)))
      );
    });
  }, [activeBorrows, searchQuery, items]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectBorrow(txn) {
    const item = findItem(items, txn.item_id);
    setSelectedTransaction(txn);
    setSelectedItem(item);
    setShowResults(false);
    setSearchQuery(item ? item.name : "");
    setCondition("good");
    setDamageNotes("");
  }

  function handleConfirmReturn() {
    returnMutation.mutate(
      { borrow_id: selectedTransaction.id, note: damageNotes },
      {
        onSettled: () => {
          setShowConfirm(false);
          setSelectedTransaction(null);
          setSelectedItem(null);
          setSearchQuery("");
          setCondition("good");
          setDamageNotes("");
        },
      },
    );
  }

  if (activeBorrows.length === 0 && !searchQuery) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No Active Borrows"
        description="You don't have any items to return right now."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <label className="label">Search Your Active Borrows</label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-11 pr-10"
            placeholder="Search by item name or purpose..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
              if (!selectedTransaction) setSelectedItem(null);
            }}
            onFocus={() => !selectedTransaction && setShowResults(true)}
          />
          {searchQuery && !selectedTransaction && (
            <button
              onClick={() => {
                setSearchQuery("");
                setShowResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showResults && !selectedTransaction && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-20 mt-1 w-full rounded-lg border border-gray-100 bg-white shadow-elevated max-h-72 overflow-y-auto scrollbar-thin"
            >
              {filteredBorrows.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">
                  No matching borrows found
                </div>
              ) : (
                filteredBorrows.map((txn) => {
                  const item = findItem(items, txn.item_id);
                  return (
                    <button
                      key={txn.id}
                      onClick={() => handleSelectBorrow(txn)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors min-h-[44px]"
                    >
                      <img
                        src={item?.image || getPlaceholderImage(item)}
                        alt={item?.name || ""}
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item?.name || "Unknown Item"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Borrowed {formatDate(txn.borrowed_at)}
                        </p>
                      </div>
                      <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected Borrow Details */}
      <AnimatePresence>
        {selectedTransaction && selectedItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="card"
          >
            <div className="flex items-start gap-4">
              <img
                src={selectedItem.image || getPlaceholderImage(selectedItem)}
                alt={selectedItem.name}
                className="h-20 w-20 rounded-xl object-cover flex-shrink-0 bg-gray-100"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  {selectedItem.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="badge badge-neutral">
                    {selectedItem.category}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Borrowed</span>
                    <p className="text-gray-700">
                      {formatDate(selectedTransaction.borrowed_at)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Due Date</span>
                    <p className="text-gray-700">
                      {selectedTransaction.due_date
                        ? formatDate(selectedTransaction.due_date)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Quantity</span>
                    <p className="text-gray-700">
                      {selectedTransaction.quantity}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Purpose</span>
                    <p className="text-gray-700 truncate">
                      {selectedTransaction.note || "—"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTransaction(null);
                  setSelectedItem(null);
                  setSearchQuery("");
                }}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Return Form */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="label">Return Condition</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={cn(
                        "btn min-h-[44px] capitalize text-sm transition-all",
                        condition === c ? "btn-primary" : "btn-outline",
                      )}
                    >
                      {condition === c && (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Damage Notes (if any)</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  placeholder="Describe any damage, missing parts, or issues..."
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="label">Photo Upload</label>
                <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 transition-colors hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer">
                  <div className="text-center">
                    <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">
                      Tap to upload photos
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowConfirm(true)}
                disabled={returnMutation.isPending}
                className="btn btn-primary min-h-[44px] disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm Return
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Confirm Return"
        message={
          selectedItem
            ? `You are about to return "${selectedItem.name}". Condition: ${condition}.`
            : ""
        }
        confirmLabel={
          returnMutation.isPending ? "Processing..." : "Confirm Return"
        }
        onConfirm={handleConfirmReturn}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

/* --- MY ITEMS TAB --- */
function MyItemsTab({ currentUser, items, transactions }) {
  const myItems = useMemo(() => {
    return transactions
      .filter((t) => t.status === "borrowed")
      .sort((a, b) => new Date(b.borrowed_at) - new Date(a.borrowed_at));
  }, [transactions]);

  if (myItems.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No Active Items"
        description="You haven't borrowed any items yet."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100">
      {/* Table header */}
      <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div className="col-span-4">Item</div>
        <div className="col-span-2">Borrowed</div>
        <div className="col-span-2">Due Date</div>
        <div className="col-span-2">Purpose</div>
        <div className="col-span-2">Status</div>
      </div>

      {/* Table body */}
      <div className="divide-y divide-gray-50">
        {myItems.map((txn) => {
          const item = findItem(items, txn.item_id);
          const isOverdue = txn.due_date
            ? new Date(txn.due_date) < new Date()
            : false;
          return (
            <motion.div
              key={txn.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 px-6 py-4 items-center",
                isOverdue && "bg-red-50/50",
              )}
            >
              {/* Item info */}
              <div className="sm:col-span-4 flex items-center gap-3">
                <img
                  src={item?.image || getPlaceholderImage(item)}
                  alt={item?.name || ""}
                  className="h-10 w-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item?.name || "Unknown Item"}
                  </p>
                  <p className="text-xs text-gray-400">{item?.category}</p>
                </div>
              </div>

              <div className="sm:col-span-2 text-sm text-gray-600">
                <span className="sm:hidden text-xs text-gray-400 mr-1">
                  Borrowed:{" "}
                </span>
                {formatDate(txn.borrowed_at)}
              </div>

              <div className="sm:col-span-2 text-sm">
                <span className="sm:hidden text-xs text-gray-400 mr-1">
                  Due:{" "}
                </span>
                <span className={cn(isOverdue && "text-red-600 font-medium")}>
                  {txn.due_date ? formatDate(txn.due_date) : "—"}
                </span>
              </div>

              <div className="sm:col-span-2 text-sm text-gray-600 truncate">
                <span className="sm:hidden text-xs text-gray-400 mr-1">
                  Purpose:{" "}
                </span>
                {truncate(txn.note || "—", 20)}
              </div>

              <div className="sm:col-span-2">
                <span
                  className={cn(
                    "badge",
                    isOverdue ? "badge-danger" : "badge-primary",
                  )}
                >
                  {isOverdue ? "Overdue" : "Active"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* --- OVERDUE TAB --- */
function OverdueTab({ currentUser, items, transactions }) {
  const overdueItems = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.status === "borrowed" &&
          t.due_date &&
          new Date(t.due_date) < new Date(),
      )
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }, [transactions]);

  if (overdueItems.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No Overdue Items"
        description="Great job! You have no overdue items."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-100">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            {overdueItems.length} overdue item
            {overdueItems.length > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Please return these items as soon as possible to avoid penalties.
          </p>
        </div>
      </div>

      {overdueItems.map((txn) => {
        const item = findItem(items, txn.item_id);
        const dueDate = txn.due_date ? new Date(txn.due_date) : null;
        const daysOverdue = dueDate
          ? Math.max(1, Math.ceil((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 1;
        return (
          <motion.div
            key={txn.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="card border-red-200 bg-red-50/30"
          >
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={item?.image || getPlaceholderImage(item)}
                  alt={item?.name || ""}
                  className="h-16 w-16 rounded-xl object-cover bg-gray-100"
                />
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  !
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900">
                  {item?.name || "Unknown Item"}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="badge badge-neutral text-xs">
                    {item?.category}
                  </span>
                  <span className="badge badge-danger text-xs">
                    {daysOverdue} day{daysOverdue > 1 ? "s" : ""} overdue
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <div>
                    <span className="text-gray-400">Borrowed</span>
                    <p className="text-gray-600">
                      {formatDate(txn.borrowed_at)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Was Due</span>
                    <p className="text-red-600 font-medium">
                      {dueDate ? formatDate(dueDate) : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Purpose</span>
                    <p className="text-gray-600 truncate">{txn.note || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* --- MAIN PAGE --- */
export default function BorrowReturn() {
  const [activeTab, setActiveTab] = useState("borrow");
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const preselectedItem = location.state?.selectedItem || null;

  const {
    data: rawItems = [],
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErr,
  } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.listItems({ limit: 1000 }),
  });

  const {
    data: myTransactions = [],
    isLoading: txnsLoading,
    isError: txnsError,
    error: txnsErr,
  } = useQuery({
    queryKey: ["transactions", currentUser?.id],
    queryFn: () =>
      borrowService.listTransactions({
        user_id: currentUser?.id,
        limit: 100,
      }),
    enabled: !!currentUser?.id,
  });

  const items = useMemo(() => {
    return rawItems.map((item) => ({
      ...item,
      image: item.image_url || getPlaceholderImage(item),
      status: item.is_active
        ? item.available_quantity > 0
          ? "available"
          : "unavailable"
        : "retired",
      condition: "good",
    }));
  }, [rawItems]);

  const borrowMutation = useMutation({
    mutationFn: borrowService.borrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item borrowed successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const returnMutation = useMutation({
    mutationFn: borrowService.returnItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item returned successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const loading = itemsLoading || txnsLoading;
  const error = itemsError
    ? itemsErr?.message
    : txnsError
      ? txnsErr?.message
      : null;

  const ActiveComponent = {
    borrow: BorrowTab,
    return: ReturnTab,
    "my-items": MyItemsTab,
    overdue: OverdueTab,
  }[activeTab];

  return (
    <PageTransition>
      <div className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Borrow & Return
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage equipment borrowing and returns
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isOverdue = tab.id === "overdue";
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] relative",
                    activeTab === tab.id
                      ? "bg-white text-gray-900 shadow-soft"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isOverdue && activeTab === tab.id ? "text-red-500" : "",
                    )}
                  />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {isOverdue && (
                    <span
                      className={cn(
                        "absolute -top-1 -right-1 h-5 w-5 text-[10px] font-bold rounded-full flex items-center justify-center",
                        activeTab === tab.id
                          ? "bg-red-500 text-white"
                          : "bg-red-100 text-red-600",
                      )}
                    >
                      !
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              queryClient.invalidateQueries({ queryKey: ["items"] });
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
            }}
          />
        ) : (
          <ActiveComponent
            currentUser={currentUser}
            items={items}
            transactions={myTransactions}
            borrowMutation={borrowMutation}
            returnMutation={returnMutation}
            preselectedItem={preselectedItem}
          />
        )}

        <AnimatePresence>
          {/* Note: tabs' ConfirmDialogs are rendered inside the tab components themselves */}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
