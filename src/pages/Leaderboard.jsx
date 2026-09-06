import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Medal,
  Star,
  Zap,
  Flame,
  Heart,
  Handshake,
  CheckCircle,
  MapPin,
  Shield,
  Database,
  Crown,
  TrendingUp,
  Users,
  Award,
  Sparkles,
  Sun,
  Lock,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import { cn } from "../lib/utils";
import { statsService } from "../services/statsService";
import { Skeleton, ErrorState, EmptyState } from "../components/ui";

// ---- Constants ----
const TABS = [
  { id: "individual", label: "Individual Rankings", icon: Users },
  { id: "department", label: "Department Rankings", icon: BarChart3 },
  { id: "badges", label: "Badge Showcase", icon: Award },
];

const PODIUM_COLORS = {
  1: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "text-yellow-500",
    accent: "bg-yellow-400",
  },
  2: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-600",
    icon: "text-gray-400",
    accent: "bg-gray-300",
  },
  3: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "text-amber-500",
    accent: "bg-amber-600",
  },
};

const ALL_BADGES = [
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Return items before due date 10 times",
    icon: Sun,
    points: 100,
    threshold: 5,
  },
  {
    id: "power-borrower",
    name: "Power Borrower",
    description: "Borrow 20+ items total",
    icon: Zap,
    points: 200,
    threshold: 20,
  },
  {
    id: "perfect-return",
    name: "Perfect Return",
    description: "Zero late returns for 3 months",
    icon: CheckCircle,
    points: 150,
    threshold: 10,
  },
  {
    id: "lab-star",
    name: "Lab Star",
    description: "Top 3 borrowers in any week",
    icon: Star,
    points: 300,
    threshold: 30,
  },
  {
    id: "community-helper",
    name: "Community Helper",
    description: "Help 10 other students with equipment",
    icon: Heart,
    points: 100,
    threshold: 15,
  },
  {
    id: "helper-badge",
    name: "Helper Badge",
    description: "Assist lab staff 5 times",
    icon: Handshake,
    points: 80,
    threshold: 8,
  },
  {
    id: "streak-master",
    name: "Streak Master",
    description: "30-day borrowing streak",
    icon: Flame,
    points: 250,
    threshold: 25,
  },
  {
    id: "inventory-guru",
    name: "Inventory Guru",
    description: "Know all lab equipment locations",
    icon: MapPin,
    points: 150,
    threshold: 12,
  },
  {
    id: "safety-first",
    name: "Safety First",
    description: "Complete all safety training modules",
    icon: Shield,
    points: 100,
    threshold: 6,
  },
  {
    id: "data-wizard",
    name: "Data Wizard",
    description: "Submit 20 accurate data logs",
    icon: Database,
    points: 120,
    threshold: 20,
  },
];

// ---- Podium Card ----
function PodiumCard({ user, rank, index }) {
  const colors = PODIUM_COLORS[rank] || PODIUM_COLORS[3];
  const isFirst = rank === 1;
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C8D7D&color=fff&size=128`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      className={cn(
        "card relative flex flex-col items-center text-center p-5 pt-8 border-2",
        colors.border,
        isFirst
          ? "md:-mt-4 md:order-1 order-2"
          : rank === 2
            ? "order-1"
            : "order-3",
      )}
    >
      {isFirst && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-white shadow-lg">
            <Crown className="h-5 w-5" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold mb-3 text-white",
          colors.accent,
        )}
      >
        {rank}
      </div>

      <img
        src={avatarUrl}
        alt={user.name}
        className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-md mb-3"
        loading="lazy"
      />

      <h3 className="font-semibold text-gray-900 mb-0.5">{user.name}</h3>
      <p className="text-xs text-gray-500 mb-2">{user.department}</p>

      <div className="flex items-center gap-1 mb-2">
        <BarChart3 className="h-4 w-4 text-primary-500" />
        <span className="text-lg font-bold text-gray-900">{user.borrow_count}</span>
        <span className="text-xs text-gray-400">borrows</span>
      </div>

      {/* Earned badges based on borrow_count */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {ALL_BADGES.filter((b) => user.borrow_count >= b.threshold)
          .slice(0, 3)
          .map((badge) => (
            <span
              key={badge.id}
              className="badge bg-primary-50 text-primary-700 text-[10px]"
            >
              {badge.name}
            </span>
          ))}
      </div>
    </motion.div>
  );
}

// ---- Ranked List Item ----
function RankedListItem({ user, rank, index }) {
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7C8D7D&color=fff&size=64`;
  const earnedBadgeCount = ALL_BADGES.filter(
    (b) => user.borrow_count >= b.threshold,
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ x: 4 }}
      className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors rounded-lg"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 flex-shrink-0">
        {rank}
      </div>

      <img
        src={avatarUrl}
        alt={user.name}
        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
        loading="lazy"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs text-gray-500">{user.department}</p>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Award className="h-3.5 w-3.5" />
        {earnedBadgeCount}
      </div>

      <div className="text-right flex-shrink-0 w-24">
        <p className="text-sm font-bold text-gray-900">{user.borrow_count}</p>
        <p className="text-[10px] text-gray-400">borrows</p>
      </div>
    </motion.div>
  );
}

// ---- Department Bar ----
function DepartmentBar({ dept, maxBorrows, index }) {
  const percent = maxBorrows > 0 ? (dept.total_borrows / maxBorrows) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{dept.department}</span>
          <span className="text-xs text-gray-400">({dept.member_count} members)</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">
          {dept.total_borrows} borrows
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ delay: index * 0.1 + 0.3, duration: 0.6, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            index === 0
              ? "bg-primary-500"
              : index === 1
                ? "bg-accent-500"
                : "bg-secondary-300",
          )}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Avg: {dept.avg_borrows} borrows/member</span>
        <span>Rank #{index + 1}</span>
      </div>
    </motion.div>
  );
}

// ---- Badge Card ----
function BadgeCard({ badge, earned, index }) {
  const Icon = badge.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "card flex flex-col items-center text-center p-4 transition-all",
        !earned && "opacity-50 grayscale",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full mb-3",
          earned ? "bg-primary-50 text-primary-600" : "bg-gray-100 text-gray-400",
        )}
      >
        {earned ? <Icon className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
      </div>
      <h4 className="text-sm font-semibold text-gray-900 mb-1">{badge.name}</h4>
      <p className="text-xs text-gray-500 mb-2">{badge.description}</p>
      <div className="flex items-center gap-1">
        <Star className="h-3 w-3 text-yellow-500" />
        <span className="text-xs font-medium text-gray-700">{badge.points} pts</span>
      </div>
      {!earned && (
        <span className="badge bg-gray-100 text-gray-500 mt-2 text-[10px]">Locked</span>
      )}
    </motion.div>
  );
}

// ---- Main Component ----
export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState("individual");

  const {
    data: leaderboardData = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => statsService.getLeaderboard(20),
    staleTime: 2 * 60 * 1000,
  });

  // Derive department rankings from real leaderboard data
  const departmentRankings = useMemo(() => {
    if (!leaderboardData.length) return [];
    const deptMap = {};
    leaderboardData.forEach((user) => {
      const dept = user.department || "Unknown";
      if (!deptMap[dept]) {
        deptMap[dept] = { department: dept, total_borrows: 0, member_count: 0 };
      }
      deptMap[dept].total_borrows += user.borrow_count;
      deptMap[dept].member_count += 1;
    });
    return Object.values(deptMap)
      .map((d) => ({
        ...d,
        avg_borrows: Math.round(d.total_borrows / d.member_count),
      }))
      .sort((a, b) => b.total_borrows - a.total_borrows);
  }, [leaderboardData]);

  const maxDeptBorrows = Math.max(...departmentRankings.map((d) => d.total_borrows), 1);

  // Earned badges for the current community (based on top user's borrow count)
  const earnedBadgeIds = useMemo(() => {
    const maxBorrows = leaderboardData.length > 0 ? leaderboardData[0].borrow_count : 0;
    return new Set(ALL_BADGES.filter((b) => maxBorrows >= b.threshold).map((b) => b.id));
  }, [leaderboardData]);

  const podiumUsers = leaderboardData.slice(0, 3);
  const rankedUsers = leaderboardData.slice(3, 10);

  // Loading state
  if (isLoading) {
    return (
      <PageTransition>
        <div className="page-container space-y-6">
          <div className="page-header">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
          <div className="card space-y-3">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (isError) {
    return (
      <PageTransition>
        <div className="page-container">
          <ErrorState message={error?.message} onRetry={refetch} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="page-container space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600">
                <Trophy className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
            </div>
            <p className="text-sm text-gray-500">
              Live rankings based on real borrow activity — updated in real time
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px]",
                activeTab === tab.id
                  ? "text-primary-600"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="leaderboard-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {/* Individual Rankings */}
          {activeTab === "individual" && (
            <motion.div
              key="individual"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {leaderboardData.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No Borrows Yet"
                  description="Leaderboard will appear once users start borrowing items."
                />
              ) : (
                <>
                  {/* Podium — Top 3 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    {podiumUsers.map((user, i) => (
                      <PodiumCard
                        key={user.user_id}
                        user={user}
                        rank={user.rank}
                        index={i}
                      />
                    ))}
                  </div>

                  {/* Ranked list 4–10 */}
                  {rankedUsers.length > 0 && (
                    <div className="card p-0 overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          Rankings 4–{Math.min(10, leaderboardData.length)}
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {rankedUsers.map((user, i) => (
                          <RankedListItem
                            key={user.user_id}
                            user={user}
                            rank={user.rank}
                            index={i}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Department Rankings */}
          {activeTab === "department" && (
            <motion.div
              key="department"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="card space-y-6 p-6"
            >
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Department Rankings by Total Borrows
                </h3>
              </div>
              {departmentRankings.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No Department Data"
                  description="Rankings will appear once users from different departments borrow items."
                />
              ) : (
                <div className="space-y-5">
                  {departmentRankings.map((dept, i) => (
                    <DepartmentBar
                      key={dept.department}
                      dept={dept}
                      maxBorrows={maxDeptBorrows}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Badge Showcase */}
          {activeTab === "badges" && (
            <motion.div
              key="badges"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Badge Showcase</h3>
                <span className="text-sm text-gray-400 ml-2">
                  ({earnedBadgeIds.size}/{ALL_BADGES.length} earned by community)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {ALL_BADGES.map((badge, i) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    earned={earnedBadgeIds.has(badge.id)}
                    index={i}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
