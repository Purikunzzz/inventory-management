import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  Camera,
  Search,
  ArrowLeftRight,
  MapPin,
  ExternalLink,
  CheckCircle,
  X,
  History,
  Maximize2,
  ChevronUp,
  ScanLine,
  Hash,
  Package,
  ShieldAlert,
} from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { itemService } from "../services/itemService";
import { EmptyState, Skeleton } from "../components/ui";

function CardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

/* --- SCANNER OVERLAY --- */
function ScannerOverlay({ isScanning }) {
  return (
    <div className="relative w-full max-w-sm mx-auto aspect-square">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 rounded-3xl overflow-hidden">
        {/* Transparent viewfinder center */}
        <div className="absolute inset-[15%] border-2 border-white/30 rounded-2xl">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-accent-400 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-accent-400 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-accent-400 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-accent-400 rounded-br-lg" />

          {/* Animated scanning line */}
          {isScanning && (
            <div className="absolute left-2 right-2 h-0.5 bg-accent-400/80 shadow-[0_0_12px_rgba(217,150,110,0.5)] animate-scan" />
          )}
        </div>
      </div>

      {/* Instruction text */}
      <div className="absolute -bottom-10 left-0 right-0 text-center">
        <p className="text-sm text-gray-400">Position QR code within frame</p>
      </div>
    </div>
  );
}

/* --- ITEM DETAIL CARD --- */
function ScannedItemCard({ item, onBorrow, onReturn, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-2xl shadow-modal max-h-[70vh] overflow-y-auto scrollbar-thin"
    >
      <div className="sticky top-0 bg-white pt-3 pb-1 flex justify-center rounded-t-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>

      <div className="px-6 pb-8">
        {/* Item image and basic info */}
        <div className="flex items-start gap-4 mt-2">
          <img
            src={item.image_url || getPlaceholderImage(item)}
            alt={item.name}
            className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                {item.name}
              </h3>
              <button
                onClick={onDismiss}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <ChevronUp className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="badge badge-neutral">{item.category}</span>
              <span className={cn("badge", getStatusColor(item.status))}>
                {item.status}
              </span>
              <span className={cn("badge", getConditionColor(item.condition))}>
                {item.condition}
              </span>
            </div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Location</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">
              {item.locationId}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Serial Number</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">
              {item.serialNumber}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Available</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">
              {item.availableQuantity} / {item.quantity}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Value</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">
              {formatCurrency(item.value)}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">
          {item.description}
        </p>

        {/* Action buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onBorrow}
            disabled={
              item.status !== "available" || item.availableQuantity === 0
            }
            className="btn btn-primary min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Borrow Item
          </button>
          <button
            onClick={onReturn}
            disabled={item.status !== "borrowed" && item.status !== "in-use"}
            className="btn btn-outline min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-4 w-4" />
            Return Item
          </button>
          <Link
            to={`/inventory/${item.id}`}
            className="btn btn-outline min-h-[44px] col-span-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Details
          </Link>
          <button
            onClick={onDismiss}
            className="btn btn-outline min-h-[44px] col-span-2"
          >
            <MapPin className="h-4 w-4" />
            Locate Item
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* --- RECENT SCANS --- */
function RecentScans({ scans, onSelect, onClear }) {
  if (scans.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No Recent Scans"
        description="Scanned items will appear here for quick access."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Recent Scans ({Math.min(scans.length, 10)})
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors min-h-[44px] px-3 flex items-center focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-2">
        {scans.slice(0, 10).map((scan, idx) => (
          <motion.button
            key={`${scan.item.id}-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => onSelect(scan.item)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/20 transition-all text-left min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <img
              src={scan.item.image_url || getPlaceholderImage(scan.item)}
              alt={scan.item.name}
              className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {scan.item.name}
              </p>
              <p className="text-xs text-gray-400">
                {scan.item.category} · {formatRelative(scan.timestamp)}
              </p>
            </div>
            <span className={cn("badge", getStatusColor(scan.item.status))}>
              {scan.item.status}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* --- MAIN PAGE --- */
export default function QrScanner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [scannedItem, setScannedItem] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [recentScans, setRecentScans] = useState([]);

  const { data: apiItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.listItems({ limit: 1000 }),
  });
  const scanTimerRef = useRef(null);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
    }, 4000);
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const handleScannedItem = useCallback(
    (item) => {
      setScannedItem(item);
      stopScanning();
      setRecentScans((prev) => {
        const filtered = prev.filter((s) => s.item.id !== item.id);
        return [
          { item, timestamp: new Date().toISOString() },
          ...filtered,
        ].slice(0, 10);
      });
    },
    [stopScanning],
  );

  const handleSimulateScan = useCallback(() => {
    startScanning();
    setLoading(true);
    setTimeout(() => {
      const randomItem = apiItems[Math.floor(Math.random() * apiItems.length)];
      setLoading(false);
      handleScannedItem(randomItem);
    }, 1500);
  }, [startScanning, handleScannedItem, apiItems]);

  const handleManualScan = useCallback(() => {
    if (!manualCode.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const code = manualCode.trim();
      const found = apiItems.find(
        (i) => String(i.id) === code || `QR-${i.id}` === code,
      );
      setLoading(false);
      if (found) {
        handleScannedItem(found);
        setManualCode("");
      } else {
        setError(`No item found matching "${code}"`);
      }
    }, 600);
  }, [manualCode, handleScannedItem]);

  const clearRecentScans = useCallback(() => {
    setRecentScans([]);
  }, []);

  const dismissScannedItem = useCallback(() => {
    setScannedItem(null);
  }, []);

  return (
    <PageTransition>
      <div className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              QR Scanner
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Scan QR codes to identify items instantly
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Scanner */}
          <div className="lg:col-span-3 space-y-6">
            {/* Scanner View */}
            <div className="card flex flex-col items-center p-6">
              <ScannerOverlay isScanning={isScanning && !scannedItem} />

              {/* Simulate Scan Button */}
              <div className="mt-12 w-full max-w-sm space-y-4">
                <button
                  onClick={handleSimulateScan}
                  disabled={loading || isScanning}
                  className="btn btn-primary w-full min-h-[44px] disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scanning...
                    </>
                  ) : loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-4 w-4" />
                      Simulate Scan
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Manual Entry */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Enter item code (e.g. ITEM-001)"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualScan();
                    }}
                  />
                  <button
                    onClick={handleManualScan}
                    disabled={!manualCode.trim() || loading}
                    className="btn btn-primary min-h-[44px] disabled:opacity-50"
                  >
                    <QrCode className="h-4 w-4" />
                    <span className="hidden sm:inline">Scan</span>
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700"
                  >
                    <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p>{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="text-xs text-red-500 underline mt-1 hover:text-red-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Recent Scans */}
          <div className="lg:col-span-2">
            <div className="card">
              <RecentScans
                scans={recentScans}
                onSelect={(item) => handleScannedItem(item)}
                onClear={clearRecentScans}
              />
            </div>
          </div>
        </div>

        {/* Scanned Item Slide-up Panel */}
        <AnimatePresence>
          {scannedItem && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black/30"
                onClick={dismissScannedItem}
              />
              <ScannedItemCard
                item={scannedItem}
                onBorrow={() => {
                  navigate("/borrow");
                  dismissScannedItem();
                }}
                onReturn={() => {
                  navigate("/borrow");
                  dismissScannedItem();
                }}
                onDismiss={dismissScannedItem}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
