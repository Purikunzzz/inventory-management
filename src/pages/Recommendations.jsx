import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Package,
  TrendingUp,
  ChevronDown,
  Plus,
  ShoppingCart,
  ArrowRight,
  Filter,
  BarChart3,
  Zap,
  Star,
  RefreshCw,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import { cn, truncate } from "../lib/utils";
import { statsService } from "../services/statsService";
import { itemService } from "../services/itemService";
import { Skeleton, ErrorState, EmptyState } from "../components/ui";

// ---- Category Filter ----
function CategoryFilter({ categories, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = selected === "all" ? "All Categories" : selected;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-outline justify-between min-w-[200px]"
      >
        <span className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors min-h-[44px] hover:bg-gray-50",
                  selected === cat
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-gray-700",
                )}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Recommendation Card ----
function RecommendationCard({ recommendation, onBorrowAll }) {
  const confidencePercent = Math.round((recommendation.confidence || 0) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3 }}
      className="card card-interactive p-5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="font-semibold text-gray-900 leading-snug">
            Borrowing{" "}
            <span className="text-accent-600">{recommendation.item_name}</span>?
          </h3>
        </div>
        <span className="badge bg-accent-50 text-accent-700 font-semibold text-xs">
          {confidencePercent}% match
        </span>
      </div>

      {/* Related Items */}
      <div className="flex-1 space-y-3 mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          You might also need:
        </p>
        {recommendation.related_items.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No related items found.</p>
        ) : (
          recommendation.related_items.slice(0, 4).map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                <Package className="h-5 w-5 text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.category}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Reason */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
        <p className="text-xs text-gray-600 leading-relaxed">
          <span className="font-medium text-gray-700">Based on: </span>
          {recommendation.reason}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={() => onBorrowAll(recommendation)}
        className="btn btn-accent w-full"
        disabled={recommendation.related_items.length === 0}
      >
        <ShoppingCart className="h-4 w-4" />
        Add all to borrow list
        <ArrowRight className="h-4 w-4 ml-auto" />
      </button>
    </motion.div>
  );
}

// ---- FBT Group — built from category clusters ----
function FBTGroup({ group, onAddAll, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent-600" />
            <h4 className="font-semibold text-gray-900">{group.groupName}</h4>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {group.borrow_count} borrows &middot; {group.category}
          </p>
        </div>
        <button
          onClick={() => onAddAll(group)}
          className="btn btn-accent text-xs min-h-0 py-1.5 px-3"
        >
          <Plus className="h-3 w-3" />
          Borrow Set
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {group.items.map((item, idx) => (
          <React.Fragment key={item.id}>
            {idx > 0 && <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />}
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-200 flex-shrink-0">
                <Package className="h-3 w-3 text-gray-500" />
              </div>
              <span className="text-xs font-medium text-gray-700">
                {truncate(item.name, 20)}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

// ---- Main Component ----
export default function Recommendations() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const navigate = useNavigate();

  const {
    data: recommendations = [],
    isLoading: recsLoading,
    isError: recsError,
    error: recsErr,
    refetch,
  } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => statsService.getRecommendations(12),
    staleTime: 5 * 60 * 1000,
  });

  // Extract unique categories from recommendations
  const categories = useMemo(() => {
    const cats = new Set(["all"]);
    recommendations.forEach((rec) => {
      if (rec.category) cats.add(rec.category);
    });
    return Array.from(cats);
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    if (selectedCategory === "all") return recommendations;
    return recommendations.filter((rec) => rec.category === selectedCategory);
  }, [recommendations, selectedCategory]);

  // Build FBT groups: cluster first item + related items as a set
  const frequentlyBorrowedTogether = useMemo(() => {
    return recommendations
      .filter((rec) => rec.related_items.length >= 2)
      .slice(0, 6)
      .map((rec) => ({
        id: rec.id,
        groupName: `${rec.item_name} Bundle`,
        borrow_count: rec.borrow_count,
        category: rec.category,
        items: [
          { id: rec.item_id, name: rec.item_name },
          ...rec.related_items.map((ri) => ({ id: ri.id, name: ri.name })),
        ],
      }));
  }, [recommendations]);

  const handleAddAll = (rec) => {
    toast.success(`Added ${rec.item_name} and ${rec.related_items?.length || 0} related items`, {
      description: `${(rec.related_items?.length || 0) + 1} items ready for checkout`,
      action: {
        label: "Go to Borrow",
        onClick: () => navigate("/borrow"),
      },
      duration: 4000,
    });
  };

  const handleAddSet = (group) => {
    toast.success(`Added "${group.groupName}" set`, {
      description: `${group.items.length} items ready for checkout`,
      action: {
        label: "Go to Borrow",
        onClick: () => navigate("/borrow"),
      },
      duration: 4000,
    });
  };

  if (recsLoading) {
    return (
      <PageTransition>
        <div className="page-container space-y-6">
          <div className="page-header">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-11 w-48 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (recsError) {
    return (
      <PageTransition>
        <div className="page-container">
          <ErrorState message={recsErr?.message} onRetry={refetch} />
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Smart Recommendations
              </h1>
            </div>
            <p className="text-sm text-gray-500 max-w-2xl">
              Based on real borrowing patterns in the inventory. We analyze checkout
              data to suggest complementary equipment you might need.
            </p>
          </div>
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onChange={setSelectedCategory}
          />
        </div>

        {/* Recommendations Grid */}
        {filteredRecommendations.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No Recommendations Yet"
            description={
              selectedCategory === "all"
                ? "Recommendations will appear once items have been borrowed. Try borrowing some equipment first!"
                : `No recommendations found for "${selectedCategory}". Try selecting "All Categories".`
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onBorrowAll={handleAddAll}
              />
            ))}
          </div>
        )}

        {/* Frequently Borrowed Together */}
        {frequentlyBorrowedTogether.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Frequently Borrowed Together
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {frequentlyBorrowedTogether.map((group, idx) => (
                <FBTGroup
                  key={group.id}
                  group={group}
                  onAddAll={handleAddSet}
                  index={idx}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
