import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { itemService } from "../services/itemService";
import { locationService } from "../services/locationService";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../lib/utils";

/**
 * Edit an existing item — PATCH /items/{id}. Mirrors AddItemModal's layout
 * but pre-fills from `item` and only sends fields that actually changed.
 */
export default function EditItemModal({ open, item, onClose }) {
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

  // Re-seed form fields whenever a new item is opened for editing.
  useEffect(() => {
    if (!item) return;
    setName(item.name || "");
    setDescription(item.description || "");
    setCategory(item.category || "");
    setTotalQuantity(item.total_quantity ?? 1);
    setLowStockThreshold(item.low_stock_threshold ?? 1);
    setLocationId(item.location_id ? String(item.location_id) : "");
    setImageUrl(item.image_url || "");
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (data) => itemService.updateItem(item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats-summary"] });
      queryClient.invalidateQueries({ queryKey: ["stats-lowstock"] });
      toast.success("Item updated successfully");
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to update item"),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !item) return;

    // Only send fields that changed from the original item — PATCH is
    // partial-update, no need to resend everything untouched.
    const data = {};
    if (name.trim() !== item.name) data.name = name.trim();
    const newDescription = description.trim() || null;
    if (newDescription !== (item.description || null)) data.description = newDescription;
    const newCategory = category.trim() || null;
    if (newCategory !== (item.category || null)) data.category = newCategory;
    if (totalQuantity !== item.total_quantity) data.total_quantity = totalQuantity;
    if (lowStockThreshold !== item.low_stock_threshold) data.low_stock_threshold = lowStockThreshold;
    const newLocationId = locationId ? parseInt(locationId) : null;
    if (newLocationId !== (item.location_id || null)) data.location_id = newLocationId;
    const newImageUrl = imageUrl.trim() || null;
    if (newImageUrl !== (item.image_url || null)) data.image_url = newImageUrl;

    if (Object.keys(data).length === 0) {
      toast.info("No changes to save");
      onClose();
      return;
    }

    updateMutation.mutate(data);
  }

  if (!open || !item) return null;

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
              <h3 className="text-lg font-semibold text-gray-900">Edit Item</h3>
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
                <p className="text-xs text-gray-400">
                  Currently {item.available_quantity} available on the shelf.
                  Raising/lowering this shifts availability by the same amount.
                </p>
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
                disabled={updateMutation.isPending || !name.trim()}
                className={cn(
                  "btn btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2",
                )}
              >
                {updateMutation.isPending ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
