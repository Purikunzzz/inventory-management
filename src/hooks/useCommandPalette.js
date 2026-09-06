import { useState, useCallback, useEffect } from "react";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: "LayoutDashboard",
    category: "main",
  },
  {
    id: "inventory",
    label: "Inventory",
    path: "/inventory",
    icon: "Package",
    category: "main",
  },
  {
    id: "locations",
    label: "Locations",
    path: "/locations",
    icon: "MapPin",
    category: "main",
  },
  {
    id: "transactions",
    label: "Transactions",
    path: "/transactions",
    icon: "ArrowLeftRight",
    category: "main",
  },
  {
    id: "users",
    label: "Users",
    path: "/users",
    icon: "Users",
    category: "main",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    path: "/maintenance",
    icon: "Wrench",
    category: "main",
  },
  {
    id: "recommendations",
    label: "Recommendations",
    path: "/recommendations",
    icon: "Lightbulb",
    category: "main",
  },
  {
    id: "analytics",
    label: "Analytics",
    path: "/analytics",
    icon: "BarChart3",
    category: "main",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    path: "/leaderboard",
    icon: "Trophy",
    category: "main",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: "Settings",
    category: "secondary",
  },
  {
    id: "help",
    label: "Help & Docs",
    path: "/help",
    icon: "HelpCircle",
    category: "secondary",
  },
];

const ACTIONS = [
  {
    id: "add-item",
    label: "Add Inventory Item",
    shortcut: "Ctrl+I",
    section: "Inventory",
  },
  {
    id: "checkout",
    label: "Check Out Equipment",
    shortcut: "Ctrl+O",
    section: "Transactions",
  },
  {
    id: "checkin",
    label: "Check In Equipment",
    shortcut: "Ctrl+R",
    section: "Transactions",
  },
  {
    id: "report-damage",
    label: "Report Damage",
    shortcut: "Ctrl+D",
    section: "Maintenance",
  },
  {
    id: "scan-qr",
    label: "Scan QR Code",
    shortcut: "Ctrl+Q",
    section: "General",
  },
  {
    id: "search-items",
    label: "Search Items",
    shortcut: "Ctrl+K",
    section: "General",
  },
];

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);
  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, toggle, close]);

  const q = query.toLowerCase().trim();
  const filteredNav = NAV_ITEMS.filter(
    (n) => !q || n.label.toLowerCase().includes(q) || n.category.includes(q),
  );
  const filteredActions = ACTIONS.filter(
    (a) =>
      !q ||
      a.label.toLowerCase().includes(q) ||
      a.section.toLowerCase().includes(q) ||
      a.shortcut.toLowerCase().includes(q),
  );
  const allResults = [...filteredNav, ...filteredActions];

  return {
    isOpen,
    query,
    selectedIndex,
    open,
    close,
    toggle,
    setQuery,
    setSelectedIndex,
    filteredNav,
    filteredActions,
    allResults,
    navItems: NAV_ITEMS,
    actions: ACTIONS,
  };
}
