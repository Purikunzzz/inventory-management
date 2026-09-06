import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { itemService } from "../services/itemService";
import { locationService } from "../services/locationService";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";

export default function AddItemModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [lowStockThreshold, setLowStockThreshold] = useState(1);
  const [locationId, setLocationId] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.listLocations,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: itemService.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      // Also refresh dashboard/admin stat cards (total item count, low-stock
      // list, etc.) so a newly created item is reflected without a full page
      // reload — this modal is reused from both Inventory and Admin.
      queryClient.invalidateQueries({ queryKey: ["stats-summary"] });
      queryClient.invalidateQueries({ queryKey: ["stats-lowstock"] });
      toast.success("Item created successfully");
      resetForm();
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to create item"),
  });

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("");
    setTotalQuantity(1);
    setLowStockThreshold(1);
    setLocationId("");
    setImageUrl("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      total_quantity: totalQuantity,
      low_stock_threshold: lowStockThreshold,
      location_id: locationId ? parseInt(locationId) : null,
      image_url: imageUrl.trim() || null,
    });
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Package className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Add Item</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="label">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g., Oscilloscope Tektronix TBS1052C"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="label">Description</label>
              <textarea
                rows={2}
                className="input resize-y"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label">Category</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Electronics"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="label">Location</label>
                <select
                  className="input"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">None</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label">Image URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label">Total Quantity</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={totalQuantity}
                  onChange={(e) =>
                    setTotalQuantity(Math.max(0, parseInt(e.target.value) || 0))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="label">Low Stock Threshold</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={lowStockThreshold}
                  onChange={(e) =>
                    setLowStockThreshold(
                      Math.max(0, parseInt(e.target.value) || 0),
                    )
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost flex-1 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
                className="btn btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Item
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
