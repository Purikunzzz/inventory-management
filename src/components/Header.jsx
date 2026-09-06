import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Home,
  Command,
  BellOff,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getInitials } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";

// Breadcrumb builder from pathname
function buildBreadcrumbs(pathname) {
  if (pathname === "/") return [{ label: "Dashboard", to: "/" }];

  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Dashboard", to: "/" }];

  let current = "";
  for (const part of parts) {
    current += "/" + part;
    const label = part
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Don't add IDs as breadcrumb entries
    if (/^[a-f0-9]+$/i.test(part) || /^\d+$/.test(part)) {
      breadcrumbs.push({ label: "Detail", to: current });
    } else {
      breadcrumbs.push({ label, to: current });
    }
  }

  return breadcrumbs;
}

export default function Header({
  onMenuToggle,
  sidebarCollapsed,
  onCommandPaletteOpen,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const breadcrumbs = buildBreadcrumbs(location.pathname);

  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const searchInputRef = useRef(null);

  // ── Notification state backed by localStorage ──
  const NOTIF_LS_KEY = "lab_header_notifications";

  const defaultNotifications = [
    {
      id: 1,
      title: "New item added",
      desc: "Centrifuge X-200 was added to inventory",
      time: "5m ago",
      unread: true,
    },
    {
      id: 2,
      title: "Maintenance due",
      desc: "Spectrophotometer requires calibration",
      time: "1h ago",
      unread: true,
    },
    {
      id: 3,
      title: "Borrow approved",
      desc: "Your request for 3 pipettes was approved",
      time: "3h ago",
      unread: true,
    },
  ];

  function loadNotifications() {
    try {
      const stored = localStorage.getItem(NOTIF_LS_KEY);
      return stored ? JSON.parse(stored) : defaultNotifications;
    } catch {
      return defaultNotifications;
    }
  }

  const [notifications, setNotifications] = useState(loadNotifications);

  // Persist notifications to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_LS_KEY, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  const notificationCount = notifications.filter((n) => n.unread).length;

  const handleMarkOneRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cmd+K is handled globally by DashboardLayout — no duplicate listener here.

  const userInitials = currentUser
    ? getInitials(currentUser.full_name || currentUser.name || "")
    : "??";
  const userName = currentUser
    ? currentUser.full_name || currentUser.name
    : "Not signed in";
  const userEmail = currentUser ? currentUser.email : "signin@labflow.dev";
  const userRole = currentUser
    ? (currentUser.role || "").charAt(0).toUpperCase() +
      (currentUser.role || "").slice(1).replace("-", " ")
    : "Guest";

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-100 backdrop-blur-md px-4 lg:px-6"
      style={{ backgroundColor: 'var(--color-header-bg)' }}
    >
      {/* Menu toggle (mobile) + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="btn btn-ghost h-9 w-9 p-0 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar toggle when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={onMenuToggle}
            className="hidden lg:flex btn btn-ghost h-9 w-9 p-0"
            aria-label="Expand sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Breadcrumbs */}
        <nav
          className="hidden sm:flex items-center gap-1.5 text-sm min-w-0"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.to} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
              )}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900 truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="text-gray-500 hover:text-gray-700 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search - triggers command palette */}
        <div
          className={cn(
            "relative hidden sm:flex items-center",
            searchFocused && "flex-1 sm:max-w-xs",
          )}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search..."
            onFocus={() => {
              setSearchFocused(true);
              // Blur immediately to avoid showing the input as focused,
              // instead open the command palette
              searchInputRef.current?.blur();
              if (onCommandPaletteOpen) {
                onCommandPaletteOpen();
              }
            }}
            readOnly
            className="h-9 w-48 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-9 text-sm placeholder:text-gray-400 cursor-pointer focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
            aria-label="Search (opens command palette)"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 text-[10px] font-medium text-gray-400">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setUserMenuOpen(false);
            }}
            className="btn btn-ghost relative h-9 w-9 p-0"
            aria-label={`Notifications, ${notificationCount} unread`}
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Notifications dropdown */}
          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-100 bg-white shadow-elevated p-1"
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900">
                    Notifications
                  </p>
                  {notificationCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                      <BellOff className="h-8 w-8" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkOneRead(n.id)}
                        className={cn(
                          "flex gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-gray-50 cursor-pointer group",
                          n.unread && "bg-primary-50/50",
                        )}
                      >
                        {n.unread ? (
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                        ) : (
                          <Check className="mt-1 h-3 w-3 flex-shrink-0 text-gray-300" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            n.unread ? "text-gray-900" : "text-gray-500",
                          )}>
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.desc}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {n.time}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-gray-50 p-2">
                  <Link
                    to="/settings"
                    className="block text-center text-xs font-medium text-gray-500 hover:text-gray-700 rounded-md py-1.5 hover:bg-gray-50 transition-colors"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    Notification settings
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationsOpen(false);
            }}
            className="btn btn-ghost flex items-center gap-2 h-9 px-2"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            {currentUser && currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.full_name || currentUser.name}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <span className="text-xs font-semibold">{userInitials}</span>
              </div>
            )}
            <span className="hidden md:inline text-sm font-medium text-gray-700">
              {userName}
            </span>
            <ChevronDown
              className={cn(
                "hidden md:block h-3.5 w-3.5 text-gray-400 transition-transform",
                userMenuOpen && "rotate-180",
              )}
            />
          </button>

          {/* User dropdown */}
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-100 bg-white shadow-elevated p-1"
                role="menu"
              >
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 mb-1">
                  {currentUser && currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.full_name || currentUser.name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                      <span className="text-sm font-semibold">
                        {userInitials}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {userEmail}
                    </p>
                  </div>
                </div>

                <Link
                  to="/settings"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User className="h-4 w-4 text-gray-400" />
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  Settings
                </Link>
                <button
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
