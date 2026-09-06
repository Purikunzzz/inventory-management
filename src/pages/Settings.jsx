import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Bell,
  Palette,
  Shield,
  Camera,
  Mail,
  Building,
  FileText,
  Save,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Key,
  Lock,
  LogOut,
  CheckCircle,
  Eye,
  EyeOff,
  Sliders,
  Laptop,
  Smartphone,
  Globe,
  Info,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import { cn } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { userService } from "../services/userService";

// ---- Constants ----
const SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: Shield },
];

const NOTIFICATION_ITEMS = [
  {
    id: "borrow-updates",
    label: "Borrow Confirmations",
    description: "Status changes for your borrow requests",
  },
  {
    id: "due-reminders",
    label: "Return Reminders",
    description: "Reminders before items are due",
  },
  {
    id: "maintenance",
    label: "Maintenance Alerts",
    description: "Equipment maintenance and calibration notices",
  },
  {
    id: "system",
    label: "Announcements",
    description: "Platform updates and announcements",
  },
];

const THEME_SWATCHES = [
  { id: "light", name: "Light", primary: "#FFFFFF", accent: "#7C8D7D", bg: "#F5F5F3" },
  { id: "dark", name: "Dark", primary: "#1a1a2e", accent: "#7C8D7D", bg: "#16213e" },
  { id: "warm", name: "Warm", primary: "#FFF8F0", accent: "#D9966E", bg: "#FFF5EC" },
  { id: "cool", name: "Cool", primary: "#F0F4F8", accent: "#C2CCD6", bg: "#E8EEF4" },
  { id: "system", name: "System", primary: "#F5F5F3", accent: "#7C8D7D", bg: "#E5E5E3" },
];

const NOTIF_DEFAULTS = {
  email: { "borrow-updates": true, "due-reminders": true, maintenance: true, system: false },
  push: { "borrow-updates": true, "due-reminders": true, maintenance: false, system: true },
};

// ---- Helper: load from localStorage ----
function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---- Skeleton ----
function Skeleton({ className }) {
  return <div className={cn("skeleton", className)} />;
}

// ---- Toggle Switch ----
function ToggleSwitch({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
        enabled ? "bg-primary-500" : "bg-gray-200",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      role="switch"
      aria-checked={enabled}
    >
      <motion.span
        animate={{ x: enabled ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

// ---- Main Component ----
export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const { currentUser, logout } = useAuth();
  const queryClient = useQueryClient();

  // Profile state — uses full_name from API
  const [profile, setProfile] = useState({ full_name: "", email: "", department: "" });

  // Notification state — persisted to localStorage
  const [notifications, setNotifications] = useState(
    loadLS("lab_notifications", NOTIF_DEFAULTS),
  );

  // Appearance state — driven by ThemeProvider
  const { theme: selectedTheme, fontSize, setTheme: setSelectedTheme, setFontSize } = useTheme();

  // Security state
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  // ── Load current user into profile form ──
  useEffect(() => {
    if (currentUser) {
      setProfile({
        full_name: currentUser.full_name || "",
        email: currentUser.email || "",
        department: currentUser.department || "",
      });
    }
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [currentUser]);

  // ── Profile save mutation ──
  const profileMutation = useMutation({
    mutationFn: () => userService.updateMe({ full_name: profile.full_name }),
    onSuccess: (updatedUser) => {
      // Update localStorage so useAuth reflects the new name
      try {
        const stored = JSON.parse(localStorage.getItem("lab_currentUser") || "{}");
        localStorage.setItem(
          "lab_currentUser",
          JSON.stringify({ ...stored, full_name: profile.full_name }),
        );
      } catch {}
      toast.success("Profile updated", { description: "Your name has been saved." });
    },
    onError: (err) => toast.error(err.message || "Failed to save profile"),
  });

  // ── Password change mutation ──
  const passwordMutation = useMutation({
    mutationFn: (data) => userService.updateUser(currentUser.id, { password: data.new }),
    onSuccess: () => {
      setPasswordForm({ current: "", new: "", confirm: "" });
      toast.success("Password changed", { description: "Your password has been updated." });
    },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });

  // ── Handlers ──
  const handleSaveProfile = () => {
    if (!profile.full_name.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }
    profileMutation.mutate();
  };

  const handleSaveNotifications = () => {
    saveLS("lab_notifications", notifications);
    toast.success("Notification preferences saved", {
      description: "Your preferences are stored locally on this device.",
    });
  };

  const handleToggleNotification = (channel, id) => {
    setNotifications((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [id]: !prev[channel][id] },
    }));
  };

  const handleSaveAppearance = () => {
    // Theme and font size are already applied live via useTheme.
    // Just show a confirmation toast.
    toast.success("Appearance saved", {
      description: `Theme: "${THEME_SWATCHES.find((t) => t.id === selectedTheme)?.name}", Font: ${fontSize}px`,
    });
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.new.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (currentUser?.auth_provider === "google") {
      toast.error("Google accounts cannot change password here", {
        description: "Manage your password at myaccount.google.com",
      });
      return;
    }
    passwordMutation.mutate(passwordForm);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <PageTransition>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-52 flex-shrink-0 space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1 card space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="lg:sticky lg:top-6 space-y-1">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage your preferences</p>
            </div>
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]",
                  activeTab === tab.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <tab.icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* ── Profile Tab ── */}
            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="card p-6 space-y-6"
              >
                <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || "User")}&background=7C8D7D&color=fff&size=128`}
                      alt={profile.full_name}
                      className="h-20 w-20 rounded-full object-cover border-2 border-gray-100"
                    />
                    <button
                      onClick={() => toast.info("Avatar upload is not available yet")}
                      className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white shadow-md hover:bg-primary-600 transition-colors"
                      title="Change avatar"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{profile.full_name || "—"}</p>
                    <p className="text-xs text-gray-500">{profile.email}</p>
                    <span className={cn(
                      "badge mt-1 text-[10px]",
                      currentUser?.role === "admin" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"
                    )}>
                      {currentUser?.role}
                    </span>
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="profile-name">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="profile-name"
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        className="input pl-9"
                        placeholder="Your full name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="profile-email">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="profile-email"
                        type="email"
                        value={profile.email}
                        disabled
                        className="input pl-9 opacity-60 cursor-not-allowed"
                        title="Email cannot be changed here"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Email changes require admin assistance</p>
                  </div>
                  <div>
                    <label className="label" htmlFor="profile-dept">Department</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="profile-dept"
                        type="text"
                        value={profile.department}
                        disabled
                        className="input pl-9 opacity-60 cursor-not-allowed"
                        title="Department is auto-detected from your email"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Auto-detected from your email</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileMutation.isPending}
                    className="btn btn-primary"
                  >
                    {profileMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        Save Changes
                      </span>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Notifications Tab ── */}
            {activeTab === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                {/* Info banner */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Notification preferences are saved locally on this device.
                  </p>
                </div>

                {/* Email Notifications */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {NOTIFICATION_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 mr-4">
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        </div>
                        <ToggleSwitch
                          enabled={notifications.email[item.id]}
                          onChange={() => handleToggleNotification("email", item.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Push Notifications */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-accent-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Push Notifications</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {NOTIFICATION_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 mr-4">
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        </div>
                        <ToggleSwitch
                          enabled={notifications.push[item.id]}
                          onChange={() => handleToggleNotification("push", item.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveNotifications} className="btn btn-primary">
                    <Save className="h-4 w-4" />
                    Save Preferences
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Appearance Tab ── */}
            {activeTab === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                {/* Theme Swatches */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Theme</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {THEME_SWATCHES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={cn(
                          "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-h-[44px]",
                          selectedTheme === theme.id
                            ? "border-primary-500 shadow-sm"
                            : "border-gray-100 hover:border-gray-200",
                        )}
                      >
                        <div
                          className="h-12 w-12 rounded-lg border border-gray-200 overflow-hidden"
                          style={{ backgroundColor: theme.bg }}
                        >
                          <div className="h-2 w-full" style={{ backgroundColor: theme.accent }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{theme.name}</span>
                        {selectedTheme === theme.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white"
                          >
                            <CheckCircle className="h-3 w-3" />
                          </motion.div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Font Size</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">A</span>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      step="1"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
                      aria-label="Font size"
                    />
                    <span className="text-lg text-gray-500 font-bold">A</span>
                    <span className="text-sm font-medium text-gray-700 w-10 text-right">
                      {fontSize}px
                    </span>
                  </div>
                  <div
                    className="p-4 rounded-lg bg-gray-50 border border-gray-100"
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    <p className="text-gray-900 font-medium">Preview Text</p>
                    <p className="text-gray-500">This is how your content will look at {fontSize}px.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveAppearance} className="btn btn-primary">
                    <Save className="h-4 w-4" />
                    Save Appearance
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Security Tab ── */}
            {activeTab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                {/* Google account notice */}
                {currentUser?.auth_provider === "google" && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-100">
                    <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Google Account</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Your account uses Google Sign-In. Password management is handled
                        by Google at{" "}
                        <a
                          href="https://myaccount.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          myaccount.google.com
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* Change Password */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                  </div>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {[
                      { id: "current", label: "Current Password" },
                      { id: "new", label: "New Password" },
                      { id: "confirm", label: "Confirm New Password" },
                    ].map((field) => (
                      <div key={field.id}>
                        <label className="label" htmlFor={`pw-${field.id}`}>
                          {field.label}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            id={`pw-${field.id}`}
                            type={showPasswords[field.id] ? "text" : "password"}
                            value={passwordForm[field.id]}
                            onChange={(e) =>
                              setPasswordForm({ ...passwordForm, [field.id]: e.target.value })
                            }
                            className="input pl-9 pr-10"
                            placeholder={field.label}
                            disabled={currentUser?.auth_provider === "google"}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords({
                                ...showPasswords,
                                [field.id]: !showPasswords[field.id],
                              })
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            tabIndex={-1}
                          >
                            {showPasswords[field.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="submit"
                      disabled={passwordMutation.isPending || currentUser?.auth_provider === "google"}
                      className="btn btn-primary disabled:opacity-50"
                    >
                      {passwordMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Updating...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Save className="h-4 w-4" />
                          Update Password
                        </span>
                      )}
                    </button>
                  </form>
                </div>

                {/* Active Session */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Current Session</h2>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-100">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">This Browser</p>
                        <p className="text-xs text-gray-500">Logged in as {currentUser?.email}</p>
                      </div>
                    </div>
                    <span className="badge bg-green-100 text-green-700 text-xs">Active Now</span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        logout();
                        toast.success("Logged out successfully");
                      }}
                      className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
