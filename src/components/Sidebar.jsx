import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
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
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { cn, getInitials } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";

const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/borrow", label: "Borrow / Return", icon: ArrowLeftRight },
  { to: "/qr-scanner", label: "QR Scanner", icon: QrCode },
  { to: "/locations", label: "Locations", icon: MapPin },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-100 transition-all duration-300 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: 'var(--color-sidebar-bg)' }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-gray-100 px-4 flex-shrink-0",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <NavLink to="/" className="flex items-center gap-3 flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500 text-white flex-shrink-0">
              <Wrench className="h-5 w-5" />
            </div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <span className="text-lg font-semibold tracking-tight text-gray-900">
                    LabInventory
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </NavLink>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggle}
            className={cn(
              "hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0",
              collapsed && "lg:hidden",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                collapsed && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2 space-y-0.5">
          {allNavItems
            .filter((item) => !item.adminOnly || currentUser?.role === "admin")
            .map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 min-h-[40px]",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-primary-600"
                      : "text-gray-400 group-hover:text-gray-600",
                  )}
                  aria-hidden="true"
                />

                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.1 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-primary-500" />
                )}

                {/* Tooltip for collapsed mode */}
                {collapsed && (
                  <div
                    className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none"
                    role="tooltip"
                  >
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div
          className={cn(
            "border-t border-gray-100 p-2 flex-shrink-0",
            collapsed ? "px-2" : "px-3",
          )}
        >
          {currentUser ? (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg p-2",
                !collapsed &&
                  "hover:bg-gray-50 transition-colors cursor-pointer",
              )}
              onClick={() => {
                if (!collapsed) {
                  onMobileClose();
                  navigate("/settings");
                }
              }}
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.full_name || currentUser.name}
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <span className="text-xs font-semibold">
                    {getInitials(currentUser.full_name || currentUser.name)}
                  </span>
                </div>
              )}
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.1 }}
                    className="overflow-hidden whitespace-nowrap min-w-0 flex-1"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {currentUser.full_name || currentUser.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate capitalize">
                      {currentUser.role.replace("-", " ")}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Logout button when expanded */}
              {!collapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }}
                  className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg p-2",
                collapsed && "justify-center",
              )}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <span className="text-xs font-semibold">?</span>
              </div>
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.1 }}
                    className="overflow-hidden whitespace-nowrap min-w-0"
                  >
                    <p className="text-sm font-medium text-gray-400">
                      Not signed in
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
