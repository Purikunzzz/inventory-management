import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  QrCode,
  MapPin,
  BarChart3,
  Wrench,
  Lightbulb,
  Trophy,
  FileText,
  Shield,
  Settings,
  CornerDownLeft,
  Command,
  Plus,
  Boxes,
  ClipboardCheck,
  UserPlus,
  LogIn,
} from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";

const commandItems = [
  {
    section: "Pages",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        to: "/",
        shortcut: "G D",
      },
      {
        id: "inventory",
        label: "Inventory",
        icon: Package,
        to: "/inventory",
        shortcut: "G I",
      },
      {
        id: "borrow",
        label: "Borrow / Return",
        icon: ArrowLeftRight,
        to: "/borrow",
        shortcut: "G B",
      },
      {
        id: "qr",
        label: "QR Scanner",
        icon: QrCode,
        to: "/qr-scanner",
        shortcut: "G Q",
      },
      {
        id: "locations",
        label: "Locations",
        icon: MapPin,
        to: "/locations",
        shortcut: "G L",
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        to: "/analytics",
        shortcut: "G A",
      },
      {
        id: "maintenance",
        label: "Maintenance",
        icon: Wrench,
        to: "/maintenance",
        shortcut: "G M",
      },
      {
        id: "recommendations",
        label: "Recommendations",
        icon: Lightbulb,
        to: "/recommendations",
        shortcut: "G R",
      },
      {
        id: "leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        to: "/leaderboard",
        shortcut: "G T",
      },
      {
        id: "reports",
        label: "Reports",
        icon: FileText,
        to: "/reports",
        shortcut: "G P",
      },
      {
        id: "admin",
        label: "Admin Panel",
        icon: Shield,
        to: "/admin",
        shortcut: "G X",
      },
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        to: "/settings",
        shortcut: "G S",
      },
    ],
  },
  {
    section: "Actions",
    items: [
      {
        id: "add_item",
        label: "Add new item",
        icon: Plus,
        action: "add_item",
        shortcut: "N I",
      },
      {
        id: "add_location",
        label: "Add new location",
        icon: MapPin,
        action: "add_location",
        shortcut: "N L",
      },
      {
        id: "scan_qr",
        label: "Scan QR code",
        icon: QrCode,
        action: "scan_qr",
        shortcut: "N Q",
      },
      {
        id: "add_user",
        label: "Add new user",
        icon: UserPlus,
        action: "add_user",
        shortcut: "N U",
      },
      {
        id: "view_logs",
        label: "View activity logs",
        icon: ClipboardCheck,
        action: "view_logs",
        shortcut: "N V",
      },
      {
        id: "manage_items",
        label: "Manage inventory",
        icon: Boxes,
        action: "manage_items",
        shortcut: "N M",
      },
    ],
  },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Flatten filtered results
  const filteredSections = commandItems
    .map((section) => ({
      section: section.section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase().trim()),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const allFilteredItems = filteredSections.flatMap((s) => s.items);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && allFilteredItems.length > 0) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, allFilteredItems.length]);

  // Handle item selection
  const handleSelect = useCallback(
    (item) => {
      if (item.to) {
        navigate(item.to);
        onClose();
        return;
      }

      // Handle actions
      if (item.action) {
        toast.info("Action triggered", {
          description: `${item.label} - coming soon`,
        });
        onClose();
        return;
      }

      onClose();
    },
    [navigate, onClose],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < allFilteredItems.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : allFilteredItems.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (allFilteredItems[selectedIndex]) {
            handleSelect(allFilteredItems[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [selectedIndex, allFilteredItems, onClose, handleSelect],
  );

  // Build flat index mapping
  let flatIdx = 0;
  const itemsWithIndex = allFilteredItems.map((item) => ({
    ...item,
    flatIndex: flatIdx++,
  }));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-lg rounded-xl border border-gray-100 bg-white shadow-modal overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4">
              <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, actions..."
                className="flex-1 h-12 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                aria-label="Search command"
              />
              <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 text-[11px] font-medium text-gray-400">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-80 overflow-y-auto scrollbar-thin p-2"
            >
              {filteredSections.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Search className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">No results found</p>
                  <p className="text-xs text-gray-400">
                    Try a different search term
                  </p>
                </div>
              ) : (
                filteredSections.map((section) => (
                  <div key={section.section} className="mb-1">
                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {section.section}
                    </p>
                    {section.items.map((item) => {
                      const match = itemsWithIndex.find(
                        (i) => i.id === item.id,
                      );
                      const isSelected = match?.flatIndex === selectedIndex;

                      return (
                        <button
                          key={item.id}
                          data-index={match?.flatIndex}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => {
                            if (match?.flatIndex !== undefined) {
                              setSelectedIndex(match.flatIndex);
                            }
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                            isSelected
                              ? "bg-primary-50 text-primary-700"
                              : "text-gray-700 hover:bg-gray-50",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isSelected ? "text-primary-500" : "text-gray-400",
                            )}
                            aria-hidden="true"
                          />
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.shortcut && (
                            <span className="hidden sm:inline text-[11px] text-gray-400 font-mono">
                              {item.shortcut}
                            </span>
                          )}
                          {isSelected && (
                            <CornerDownLeft className="h-3.5 w-3.5 text-primary-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <kbd className="inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 text-[10px] font-medium text-gray-500">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <kbd className="inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 text-[10px] font-medium text-gray-500">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <kbd className="inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 text-[10px] font-medium text-gray-500">
                  esc
                </kbd>
                Dismiss
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
